import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { dbAll, dbGet, dbRun, dbTransaction } from "../db";
import { hasActiveConsentScope, ConsentScope } from "./consentService";
import {seal,unseal} from '../platform/crypto';
import {pinnedWebhookFetch,resolveWebhookAddress} from './webhook-http';

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
  "profile.ready",
  "workflow.failed",
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
  "profile.ready": "business_profile",
  "workflow.failed": "business_profile",
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
    const records = [await resolveWebhookAddress(hostname)];
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
    {...sub,secret:seal(sub.secret,JSON.stringify(['legacy-webhook',sub.id,sub.environment]))}
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
  await dbRun(`UPDATE webhook_subscriptions SET secret = ? WHERE id = ? AND client_id = ?`, [seal(secret,JSON.stringify(['legacy-webhook',subscriptionId,sub[0].environment])), subscriptionId, clientId]);
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
    const res = await pinnedWebhookFetch(targetUrl, {
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
 * Records the event and queues durable jobs only for
 * subscriptions that are (a) in the same environment (live/sandbox),
 * (b) pattern-matched and (c) backed by an active consent grant from the
 * event's subject to that subscriber's client, covering the scope for that
 * event type.
 *
 * No network delivery occurs here. Persistence failure rolls back an enclosing
 * financial transaction so committed changes cannot silently lose their event.
 */
export async function emitEvent(eventType:string,payload:object,subject:WebhookSubject):Promise<void>{
 await dbTransaction(async()=>{
  const id=randomUUID(),at=new Date().toISOString(),environment=subject.is_sandbox?'sandbox':'live';
  await dbRun('INSERT INTO webhook_events(id,event_type,subject_type,subject_id,is_sandbox,payload,created_at,delivery_attempts,last_delivery_status) VALUES (?,?,?,?,?,?,?,0,NULL)',[id,eventType,subject.type,subject.id,subject.is_sandbox?1:0,JSON.stringify(payload),at]);
  const scope=EVENT_SCOPES[eventType];if(!scope)return;
  const candidates=await dbAll<WebhookSubscription>("SELECT * FROM webhook_subscriptions WHERE status='active' AND environment=?",[environment]);
  for(const sub of candidates){if(!sub.client_id||!matchesPattern(eventType,sub.event_pattern)||!await hasActiveConsentScope(subject.type,subject.id,sub.client_name,scope))continue;
   await dbRun('INSERT INTO ac_legacy_deliveries(id,event_id,subscription_id,next_at,created_at) VALUES (?,?,?,?,?) ON CONFLICT(event_id,subscription_id) DO NOTHING',[randomUUID(),id,sub.id,at,at]);
  }
 });
}
let legacyDelivering=false;
export async function deliverLegacyWebhooks(transport:typeof fetch=pinnedWebhookFetch,validate=isDeliverableWebhookTarget){
 if(legacyDelivering)return {processed:0};legacyDelivering=true;
 try{
  const jobs=await dbAll("SELECT d.*,e.event_type,e.subject_type,e.subject_id,e.is_sandbox,e.payload,s.client_id,s.client_name,s.status AS subscription_status,s.target_url,s.secret,s.environment FROM ac_legacy_deliveries d JOIN webhook_events e ON e.id=d.event_id JOIN webhook_subscriptions s ON s.id=d.subscription_id WHERE d.status='pending' AND d.next_at<=? ORDER BY d.created_at,d.id LIMIT 25",[new Date().toISOString()]);
  for(const job of jobs){let error:string|null=null,cancelled=false;
   const scope=EVENT_SCOPES[job.event_type];
   if(!scope||!job.client_id||job.subscription_status!=='active'||!await hasActiveConsentScope(job.subject_type,job.subject_id,job.client_name,scope)){error='consent_or_subscription_revoked';cancelled=true;}
   else try{
    if(!(await validate(job.target_url)).allowed)throw Error('target_denied');
    const body=JSON.stringify({event:job.event_type,data:JSON.parse(job.payload),id:job.event_id}),timestamp=Math.floor(Date.now()/1000);
    const secret=job.secret.startsWith('whsec_')?job.secret:unseal(job.secret,JSON.stringify(['legacy-webhook',job.subscription_id,job.environment]));
    const response=await transport(job.target_url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json','x-africore-signature':sign(secret,timestamp,body),'x-africore-timestamp':String(timestamp),'AfriCore-Delivery':job.id},body});await response.body?.cancel();if(!response.ok)throw Error('http_'+response.status);
   }catch(e){error=/^(http_\d{3}|target_denied)$/.test((e as Error).message)?(e as Error).message:'delivery_failed';}
   const attempts=Number(job.attempts)+1,status=cancelled?'cancelled':!error?'delivered':attempts>=5?'dead':'pending';
   await dbRun('UPDATE ac_legacy_deliveries SET attempts=?,status=?,last_error=?,next_at=? WHERE id=?',[attempts,status,error,new Date(Date.now()+Math.min(3600000,1000*2**attempts)).toISOString(),job.id]);
   await dbRun('UPDATE webhook_events SET delivery_attempts=delivery_attempts+1,last_delivery_status=? WHERE id=?',[status,job.event_id]);
  }
  return {processed:jobs.length};
 }finally{legacyDelivering=false;}
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
