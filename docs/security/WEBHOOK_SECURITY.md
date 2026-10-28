# Webhook security

Legacy events persist jobs transactionally with settlement. A single-process worker processes bounded batches, rechecks current consent/subscription, signs with the retrievable encrypted secret and retries with backoff to a dead-letter state. Event/delivery IDs remain stable across attempts. Receivers must deduplicate: delivery is at least once, not exactly once.

Legacy signing credentials are encrypted at creation/rotation, returned once and excluded from ordinary listing. Existing plaintext compatibility is read-only; the approved development inventory found zero historical legacy subscriptions. Workspace endpoint secrets retain their encrypted representation and now bind tenant/environment/endpoint in authenticated data.

HTTPS destinations require exact host qualification. The actual TLS request uses the validated selected address as its lookup result, with original hostname SNI/certificate validation, no reusable agent, no proxy, no redirect, bounded payload/response and timeout. All returned DNS answers must be public. Private/link-local/loopback/mapped/transition/documentation ranges are denied. Socket peer mismatch fails closed.

Hosted allowlist remains `disabled.invalid`; no real recipient was added or private data delivered as a test. Qualification must verify the actual receiver, signature/replay policy and host ownership. Before multiple backend instances, implement distributed leases and receiver idempotency; the existing busy guard is per process only. See [OWASP webhook guidance](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html).
