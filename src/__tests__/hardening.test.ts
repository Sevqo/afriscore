import {deliverLegacyWebhooks} from '../services/webhookService';
import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import { configureTestEnv, truncateAll, removeSqliteFile } from "./helpers";

const { sqlitePath } = configureTestEnv("hardening");

import { migrate, dbRun, dbAll } from "../db";
import { createBusiness } from "../services/businessService";
import { createApiClient } from "../services/apiClientService";
import { grantConsent, revokeConsent } from "../services/consentService";
import { subscribe, emitEvent } from "../services/webhookService";
import { ipRateLimit, clientRateLimit, resetRateLimitState, IP_LIMIT, CLIENT_LIMIT } from "../middleware/rateLimit";

interface FakeResponse {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  setHeader(key: string, value: string): void;
  status(code: number): FakeResponse;
  json(body: unknown): FakeResponse;
}

function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(key, value) {
      res.headers[key.toLowerCase()] = value;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe("Phase 1 hardening", () => {
  before(async () => {
    await migrate();
    await truncateAll(dbRun);
    resetRateLimitState();
  });

  after(() => {
    resetRateLimitState();
    removeSqliteFile(sqlitePath);
  });

  test("webhook delivery is scoped by consent, environment and event type", async () => {
    const bizA = await createBusiness({ legal_name: "Consented Partner Ltd" });
    const bizB = await createBusiness({ legal_name: "Unconsented Partner Ltd" });
    const { client } = await createApiClient("scoped-webhook-client");

    await subscribe({
      client: { id: client.id, name: client.name },
      event_pattern: "transaction.created",
      target_url: "https://webhook.invalid/hook",
      environment: "live",
    });
    const consent = await grantConsent({
      subject_type: "business",
      subject_id: bizA.id,
      grantee: client.name,
      purpose: "testing",
      scope: ["transactions"],
    });

    // Business A consented: delivery is attempted (and fails to the invalid
    // host, which is recorded as an attempt).
    await emitEvent("transaction.created", { business_id: bizA.id }, { type: "business", id: bizA.id, is_sandbox: false });
    // Business B has no grant: the event must not even be attempted.
    await emitEvent("transaction.created", { business_id: bizB.id }, { type: "business", id: bizB.id, is_sandbox: false });

    await deliverLegacyWebhooks(async()=>new Response(null,{status:503}),async()=>({allowed:true}));
    const eventsA = await dbAll(`SELECT * FROM webhook_events WHERE subject_id = ?`, [bizA.id]);
    const eventsB = await dbAll(`SELECT * FROM webhook_events WHERE subject_id = ?`, [bizB.id]);
    assert.strictEqual(eventsA.length, 1);
    assert.strictEqual(eventsB.length, 1, "events are still recorded for audit");
    assert.strictEqual(eventsA[0].delivery_attempts, 1, "consented subscriber should receive the event");
    assert.strictEqual(eventsB[0].delivery_attempts, 0, "no cross-tenant delivery without consent");

    // Revoking consent stops future deliveries immediately.
    await revokeConsent(consent.id);
    await emitEvent("transaction.created", { business_id: bizA.id }, { type: "business", id: bizA.id, is_sandbox: false });
    const afterRevoke = await dbAll(`SELECT * FROM webhook_events WHERE subject_id = ? ORDER BY created_at`, [bizA.id]);
    assert.strictEqual(afterRevoke[afterRevoke.length - 1].delivery_attempts, 0, "revoked consent must stop delivery");

    // Environment isolation: with consent in place, a live subscription gets
    // live events but never sandbox events; a sandbox subscription gets the
    // sandbox one only.
    await grantConsent({
      subject_type: "business",
      subject_id: bizA.id,
      grantee: client.name,
      purpose: "testing",
      scope: ["transactions"],
    });
    await subscribe({
      client: { id: client.id, name: client.name },
      event_pattern: "transaction.created",
      target_url: "https://webhook.invalid/sandbox-hook",
      environment: "sandbox",
    });

    await emitEvent("transaction.created", { business_id: bizA.id, marker: "live-event" }, { type: "business", id: bizA.id, is_sandbox: false });
    await emitEvent("transaction.created", { business_id: bizA.id, marker: "sandbox-event" }, { type: "business", id: bizA.id, is_sandbox: true });

    await deliverLegacyWebhooks(async()=>new Response(null,{status:503}),async()=>({allowed:true}));
    const liveEvent = await dbAll(`SELECT * FROM webhook_events WHERE subject_id = ? AND payload LIKE ?`, [bizA.id, "%live-event%"]);
    const sandboxEvent = await dbAll(`SELECT * FROM webhook_events WHERE subject_id = ? AND payload LIKE ?`, [bizA.id, "%sandbox-event%"]);
    assert.strictEqual(liveEvent[0].delivery_attempts, 1, "live subscription receives live events");
    assert.strictEqual(sandboxEvent[0].delivery_attempts, 1, "only the sandbox subscription matches a sandbox event");
    assert.strictEqual(sandboxEvent[0].is_sandbox, 1);

    // Unknown event types are audited but never fanned out.
    await emitEvent("mystery.event", { business_id: bizA.id, marker: "unknown-event" }, { type: "business", id: bizA.id, is_sandbox: false });
    const unknown = await dbAll(`SELECT * FROM webhook_events WHERE payload LIKE ?`, ["%unknown-event%"]);
    assert.strictEqual(unknown.length, 1);
    assert.strictEqual(unknown[0].delivery_attempts, 0);
  });

  test("per-IP rate limit cannot be bypassed with rotating x-api-key headers", async () => {
    resetRateLimitState();
    const req = { ip: "198.51.100.10", header: () => `random-${Math.random()}` } as any;

    const ipRes = fakeResponse();
    let allowed = 0;
    let limited = 0;
    for (let i = 0; i < IP_LIMIT + 5; i++) {
      const res = i === 0 ? ipRes : fakeResponse();
      let nextCalled = false;
      ipRateLimit(req, res as any, () => {
        nextCalled = true;
      });
      if (nextCalled) allowed++;
      else if (res.statusCode === 429) limited++;
    }
    assert.strictEqual(allowed, IP_LIMIT);
    assert.strictEqual(limited, 5);
    assert.strictEqual(ipRes.headers["ratelimit-limit"], String(IP_LIMIT));

    // A different IP has its own bucket.
    let otherNext = false;
    ipRateLimit({ ip: "198.51.100.11", header: () => "x" } as any, fakeResponse() as any, () => {
      otherNext = true;
    });
    assert.strictEqual(otherNext, true);
  });

  test("per-client rate limit is keyed by the verified client id", async () => {
    resetRateLimitState();
    const res = fakeResponse();
    let allowed = 0;
    for (let i = 0; i < CLIENT_LIMIT + 1; i++) {
      if (clientRateLimit("client-abc", i === 0 ? (res as any) : (fakeResponse() as any))) allowed++;
    }
    assert.strictEqual(allowed, CLIENT_LIMIT);

    // A different client starts with a full bucket again.
    assert.strictEqual(clientRateLimit("client-def", fakeResponse() as any), true);
  });

  test("webhook target validator blocks IPv6, trailing-dot and private hosts", async () => {
    const { isAllowedWebhookTarget, isDeliverableWebhookTarget } = await import("../services/webhookService");
    // These used to pass the name check before the hostname normalisation.
    assert.strictEqual(isAllowedWebhookTarget("https://[::1]/hook"), false);
    assert.strictEqual(isAllowedWebhookTarget("https://localhost./hook"), false);
    assert.strictEqual(isAllowedWebhookTarget("https://127.0.0.1/hook"), false);
    assert.strictEqual(isAllowedWebhookTarget("https://metadata.internal/hook"), false);
    assert.strictEqual(isAllowedWebhookTarget("http://example.com/hook"), false);
    assert.strictEqual(isAllowedWebhookTarget("https://hooks.partner.example/hook"), true);

    // Delivery additionally resolves DNS and refuses private/loopback targets
    // and hostnames that do not resolve (SSRF / DNS-rebinding guard).
    assert.strictEqual((await isDeliverableWebhookTarget("https://localhost./hook")).allowed, false);
    assert.strictEqual((await isDeliverableWebhookTarget("https://127.0.0.1/hook")).allowed, false);
    assert.strictEqual((await isDeliverableWebhookTarget("https://does-not-resolve.invalid/hook")).allowed, false);
  });

  test("partner-facing counterparties mask raw phone numbers", async () => {
    const { maskPiiCounterparty } = await import("../services/insightsService");
    assert.strictEqual(maskPiiCounterparty("254712345678"), "254***678");
    assert.strictEqual(maskPiiCounterparty("+254 712 345 678"), "254***678");
    assert.strictEqual(maskPiiCounterparty("0712345678"), "0***678");
    assert.strictEqual(maskPiiCounterparty("ACME WHOLESALERS LTD"), "ACME WHOLESALERS LTD");
    assert.strictEqual(maskPiiCounterparty(null), null);
  });
});
