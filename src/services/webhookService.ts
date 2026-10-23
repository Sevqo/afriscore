import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { dbAll, dbGet, dbRun } from "../db";
import { hasActiveConsentScope, ConsentScope } from "./consentService";

export interface WebhookSubject {
  type: "business" | "person";
  id: string;
  is_sandbox: boolean;
}

export type WebhookEnvironment = "live" | "sandbox";

export const WEBHOOK_EVENT_TYPES = [
  "transaction.created",
  "account.connected",
  "account.disconnected",
  "invoice.paid",
  "invoice.payment_recorded",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/**
 * Each event leaks some business data, so each one requires the consent
 * scope that governs that data — the same scope the equivalent REST
 * endpoint requires. There is deliberately no default: an unknown event
 * type is recorded for audit but never delivered.
 */
const EVENT_SCOPES: Record<string, Exclude<ConsentScope, "all">> = {
  "transaction.created": "transactions",
  "account.connected": "accounts",
  "account.disconnected": "accounts",
  "invoice.paid": "invoices",
  "invoice.payment_recorded": "invoices",
};

interface WebhookSubscription {
  id: string;
  client_id: string | null;
  client_name: string;
  event_pattern: string;
  target_url: string;
  environment: WebhookEnvironment;
  status: string;
  created_at: string;
  secret: string;
}

function matchesPattern(eventType: string, pattern: string): boolean {
  if (pattern === eventType) return true;
  if (pattern.endsWith(".*")) return eventType.startsWith(pattern.slice(0, -1));
  return false;
}

/** Validates a subscription pattern against the event catalogue, so typos
 *  fail at subscribe time instead of silently never delivering. */
export function isValidEventPattern(pattern: string): boolean {
  if ((WEBHOOK_EVENT_TYPES as readonly string[]).includes(pattern)) return true;
  if (!pattern.endsWith(".*")) return false;
  const prefix = pattern.slice(0, -1); // "transaction."
  return WEBHOOK_EVENT_TYPES.some((type) => type.startsWith(prefix));
}

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Reject any IP literal (public or private): partners should use DNS names,
  // and this removes IPv6 bracket / IPv4-mapped bypasses of a name check.
  const bare = h.replace(/^\[|\]$/g, "");
  return isIP(bare) !== 0;
}

/**
 * HTTPS-only delivery. Hostname normalisation blocks the classic
 * validator bypasses (trailing dot, bracketed IPv6, IPv4-mapped loopback);
 * production additionally requires an explicit host allowlist.
 *
 * DNS resolution / egress IP pinning is a separate hardening step: a
 * hostname that resolves to a private address can still pass this syntactic
 * check when no allowlist is configured.
 */
export function isAllowedWebhookTarget(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !!url.username || !!url.password || !!url.port) return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || isPrivateHostname(host)) return false;

  const allowed = (process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV === "production" && allowed.length === 0) return false;
  return allowed.length === 0 || allowed.includes(host);
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 10 || a === 127) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
    return false;
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice("::ffff:".length)); // IPv4-mapped
    return false;
  }
  return true;
}

/**
 * Delivery-time egress guard: the syntactic check above plus actual DNS
 * resolution, rejecting hostnames that resolve to private/loopback/link-local
 * addresses (DNS-rebinding style SSRF). Resolution failures are treated as
 * not-deliverable rather than retried against a fresh resolution.
 */
export async function isDeliverableWebhookTarget(raw: string): Promise<{ allowed: boolean; reason?: string }> {
  if (!isAllowedWebhookTarget(raw)) return { allowed: false, reason: "target_not_allowed" };

  let hostname: string;
  try {
    hostname = new URL(raw).hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  } catch {
    return { allowed: false, reason: "target_not_allowed" };
  }

  try {
    const records = await lookup(hostname, { all: true });
    if (records.length === 0) return { allowed: false, reason: "dns_resolution_failed" };
    if (records.some((record) => isPrivateAddress(record.address))) {
      return { allowed: false, reason: "private_address_resolution" };
    }
  } catch {
    return { allowed: false, reason: "dns_resolution_failed" };
  }

  return { allowed: true };
}

/** Generates a per-subscription signing secret, returned once at subscribe
 *  time. Every delivery to this subscription is signed with it so the
 *  receiver can verify the payload came from AfriScore. */export async function subscribe(input: {
  client: { id: string; name: string };
  event_pattern: string;
  target_url: string;
  environment?: WebhookEnvironment;
}): Promise<WebhookSubscription> {
  const sub: WebhookSubscription = {
    id: randomUUID(),
    client_id: input.client.id,
    client_name: input.client.name,
    event_pattern: input.event_pattern,
    target_url: input.target_url,
    environment: input.environment ?? "live",
    status: "active",
    created_at: new Date().toISOString(),
    secret: `whsec_${crypto.randomBytes(24).toString("hex")}`,
  };
  await dbRun(
    `INSERT INTO webhook_subscriptions (id, client_id, client_name, event_pattern, target_url, environment, status, created_at, secret)
     VALUES (@id, @client_id, @client_name, @event_pattern, @target_url, @environment, @status, @created_at, @secret)`,
    sub
  );
  return sub;
}

export async function listSubscriptions(filter: { clientId?: string } = {}): Promise<WebhookSubscription[]> {
  if (filter.clientId) {
    return dbAll<WebhookSubscription>(`SELECT * FROM webhook_subscriptions WHERE client_id = ?`, [filter.clientId]);
  }
  return dbAll<WebhookSubscription>(`SELECT * FROM webhook_subscriptions`);
}

/** Issues a new signing secret for a subscription owned by the calling
 *  client. The old secret stops validating immediately, so a leaked secret
 *  can be retired without deleting the subscription. Returned once. */
export async function rotateSubscriptionSecret(
  subscriptionId: string,
  clientId: string
): Promise<{ id: string; secret: string } | undefined> {
  const sub = await dbAll<WebhookSubscription>(`SELECT * FROM webhook_subscriptions WHERE id = ? AND client_id = ?`, [
    subscriptionId,
    clientId,
  ]);
  if (sub.length === 0) return undefined;

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  await dbRun(`UPDATE webhook_subscriptions SET secret = ? WHERE id = ? AND client_id = ?`, [secret, subscriptionId, clientId]);
  return { id: subscriptionId, secret };
}

function sign(secret: string, timestamp: number, body: string): string {
  // Signing the timestamp as well as the body (Stripe-style) lets receivers
  // enforce a recency window and reject captured replays.
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

const DELIVERY_TIMEOUT_MS = 5000;

/**
 * Fires a single synthetic, signed delivery at a URL the caller supplied —
 * lets a developer verify their receiver handles the signature correctly
 * without needing a real business event to exist first. The outbound status
 * code is deliberately not echoed back (it would be an internal-network
 * liveness oracle); only whether delivery succeeded.
 */
export async function testWebhookDelivery(targetUrl: string): Promise<{ delivered: boolean; error?: string; signature: string; timestamp: number }> {
  const secret = `whsec_test_${crypto.randomBytes(12).toString("hex")}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    event: "webhook.test",
    data: { message: "This is a test delivery from AfriScore's sandbox." },
    id: randomUUID(),
  });
  const signature = sign(secret, timestamp, body);

  try {
    const target = await isDeliverableWebhookTarget(targetUrl);
    if (!target.allowed) return { delivered: false, error: target.reason ?? "target_not_allowed", signature, timestamp };
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-africore-signature": signature,
        "x-africore-timestamp": String(timestamp),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      redirect: "error",
    });
    return { delivered: res.ok, signature, timestamp };
  } catch (err: any) {
    return { delivered: false, error: err?.message || "delivery_failed", signature, timestamp };
  }
}

/**
 * Records the event (always, for audit/debugging) and delivers it only to
 * subscriptions that are (a) in the same environment (live/sandbox),
 * (b) pattern-matched and (c) backed by an active consent grant from the
 * event's subject to that subscriber's client, covering the scope for that
 * event type.
 *
 * Delivery failures never throw — webhook delivery must not break the
 * operation that triggered the event.
 */
export async function emitEvent(eventType: string, payload: object, subject: WebhookSubject): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const payloadStr = JSON.stringify(payload);
  const environment: WebhookEnvironment = subject.is_sandbox ? "sandbox" : "live";
  const requiredScope = EVENT_SCOPES[eventType];

  await dbRun(
    `INSERT INTO webhook_events (id, event_type, subject_type, subject_id, is_sandbox, payload, created_at, delivery_attempts, last_delivery_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
    [id, eventType, subject.type, subject.id, subject.is_sandbox ? 1 : 0, payloadStr, createdAt]
  );

  // Unknown event types are audited but never delivered.
  if (!requiredScope) return;

  const candidates = (
    await dbAll<WebhookSubscription>(
      `SELECT * FROM webhook_subscriptions WHERE status = 'active' AND environment = ?`,
      [environment]
    )
  ).filter((s) => s.client_id && matchesPattern(eventType, s.event_pattern));

  const body = JSON.stringify({ event: eventType, data: payload, id });
  let attempted = 0;
  let delivered = 0;

  for (const sub of candidates) {
    // Consent is checked per subscriber at delivery time, so revoking a grant
    // stops future deliveries immediately.
    const consented = await hasActiveConsentScope(subject.type, subject.id, sub.client_name, requiredScope);
    if (!consented) continue;

    attempted++;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign(sub.secret, timestamp, body);

    try {
      const target = await isDeliverableWebhookTarget(sub.target_url);
      if (!target.allowed) throw new Error(target.reason ?? "target_not_allowed");
      const response = await fetch(sub.target_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-africore-signature": signature,
          "x-africore-timestamp": String(timestamp),
        },
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`delivery_http_${response.status}`);
      delivered++;
    } catch {
      /* delivery is best-effort; failure is recorded below */
    }
  }

  if (attempted > 0) {
    await dbRun(
      `UPDATE webhook_events SET delivery_attempts = delivery_attempts + ?, last_delivery_status = ? WHERE id = ?`,
      [attempted, delivered === attempted ? "delivered" : "failed", id]
    );
  }
}

export async function listEvents(eventType?: string, limit = 50, offset = 0) {
  if (eventType) {
    return dbAll(`SELECT * FROM webhook_events WHERE event_type = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
      eventType,
      limit,
      offset,
    ]);
  }
  return dbAll(`SELECT * FROM webhook_events ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
}

export async function countEvents(eventType?: string): Promise<number> {
  const row = eventType
    ? await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM webhook_events WHERE event_type = ?`, [eventType])
    : await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM webhook_events`);
  return Number(row?.c ?? 0);
}
