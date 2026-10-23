# Security Policy

AfriScore handles business identity, consent-gated financial data and
tamper-evident records. Security reports are taken seriously, and this
document explains how to report an issue and what the current security model
does — and does not — protect.

AfriScore is pre-1.0. Current connectors are synthetic; there are no live
M-Pesa, bank or KRA integrations yet.

## Reporting a vulnerability

**Do not open a public GitHub issue containing exploit details or real data.**

Use GitHub's private vulnerability reporting for this repository:

- <https://github.com/Sevqo/afriscore/security/advisories/new>

If that link is unavailable to you, open a minimal public issue that only asks
the maintainers for a private channel — do not include reproduction steps,
secrets, or personal data.

Please include:

- a description of the issue and its impact;
- the affected endpoint, file or component, and version/commit;
- minimal reproduction steps or a proof of concept;
- any suggested fix or mitigation you have in mind.

### What to expect

- We aim to acknowledge a report within 3 business days.
- We aim to complete an initial triage within 7 business days.
- Valid reports are fixed on the `main` branch first; there is no bug bounty
  programme at this stage. We will credit reporters who ask to be credited.

Please give us a reasonable window to ship a fix before publishing details.
We will not pursue legal action against good-faith research that stays within
the scope below and avoids privacy violations, data destruction and service
disruption.

### In scope

- Authentication and authorization (admin token, API keys, consent checks)
- Consent scoping, expiration and revocation behaviour
- Trust-ledger integrity and trust-record data minimisation
- Webhook SSRF, signature and replay handling
- PII handling (identifier hashing, redaction) and secret handling
- Injection, path traversal, unsafe deserialization, request-body handling
- Rate-limit bypasses
- Sandbox/live data isolation

### Out of scope

- Denial of service through sheer traffic volume
- Social engineering of maintainers
- Vulnerabilities in dependencies without a demonstrated exploit path (please
  still report them — we track dependency advisories in CI)
- Missing hardening headers on static marketing pages with no sensitive data
- Findings that require a compromised host, database or `LEDGER_HMAC_KEY`
  (these are covered as known limitations below)

## Supported versions

AfriScore is pre-1.0 and has no long-term-support branches. Only the current
`main` branch / latest commit is supported. Please reproduce issues against a
recent commit before reporting.

## Security model

### Authentication

- **Admin (control plane):** a single bootstrap credential supplied as
  `x-admin-token`, compared in constant time. Must be at least 32 characters;
  if it is unconfigured, admin routes return 503 rather than accepting
  requests. It is an operator credential, not an end-user login.
- **Partners (data plane):** API keys (`ak_…`) are shown once at creation or
  rotation and stored only as SHA-256 hashes. Revoked and rotated keys stop
  working immediately. Rotate a key if it may have leaked.

### Consent and data access

- Consent is granted per `(subject_type, subject_id, grantee)`, with a
  `purpose` and one or more scopes (`trust_score`, `financial_profile`,
  `insights`, `query`, `accounts`, `transactions`, `invoices`, or `all`).
- Partner reads of business/person data require both a valid API key and an
  active grant covering the scope the endpoint needs.
- Grants may carry an `expires_at`; expired grants are treated as inactive.
  Revocation takes effect immediately.
- `POST /businesses/:id/ask` requires the `query` scope **and** the scope of
  the data the matched intent returns.
- Sandbox and live data are separated by `is_sandbox`; sandbox records use the
  same auth, consent and ledger code paths.

### Trust ledger

- Every subject has an append-only SHA-256 hash chain. Each v2 entry includes a
  per-subject sequence number and chains from the previous entry's hash; a
  unique predecessor-hash index rejects a forked chain once the migration has
  succeeded (if legacy data is already forked, migration logs and skips the
  index, and verification reports the fork).
- A `ledger_heads` row stores the entry count, head hash and an HMAC-SHA256
  anchor keyed with `LEDGER_HMAC_KEY`. Verification detects edits, deletion of
  interior entries, reordering and **tail truncation**, even by an attacker
  with database access but without the server key.
- **Limits:** if the attacker holds `LEDGER_HMAC_KEY`, or can replace every
  ledger row *and* its head/anchor with a self-consistent forgery, the chain
  is not detectable locally. Deleting the entire chain including the anchor
  also leaves nothing to verify. There is no external anchoring/transparency
  log yet, so this is tamper-evident only relative to the server key and the
  database. Pre-upgrade v1 entries use the older unkeyed hash scheme.

### Trust records

`GET /businesses/:id/trust-record` and `GET /persons/:id/trust-record` return
a deliberately minimised shape:

- a `subject` object (status, trust score, timestamps, sandbox flag);
- for persons, `identifiers` booleans only (no hashes, no names);
- `verification_history` with per-event whitelisted data — no KYC fields,
  legal names, registration numbers or amounts outside the whitelist;
- `integrity` with the chain-verification result.

Business legal names, KRA PINs, registration numbers, person names and
identifier hashes are never returned by these endpoints.

### Webhooks

- Targets must be HTTPS, with no embedded credentials and no explicit port.
  Loopback, `.local`/`.internal` names and IP literals are rejected.
- Production requires `AFRISCORE_WEBHOOK_ALLOWED_HOSTS` (exact hostnames).
- Every delivery is signed with the subscription's secret:
  `x-africore-signature` = hex HMAC-SHA256 over `` `${timestamp}.${body}` ``,
  plus `x-africore-timestamp` (Unix seconds). Receivers should reject
  timestamps outside a small window (for example 5 minutes) to stop replay.
- Secrets are shown once at subscription creation or rotation.
  `POST /v1/webhooks/{id}/rotate` retires a leaked secret immediately.
- Deliveries are best-effort with a 5-second timeout and `redirect: error`;
  there is no durable retry queue yet.
- **Limitation:** the target check is syntactic. DNS rebinding / a hostname
  that resolves to a private address is not fully prevented without an
  allowlist and egress controls.

### Rate limiting

- 600 requests/minute per IP applies before authentication (including 404s and
  admin-token guesses).
- 120 requests/minute per verified API client applies after key verification.
- Buckets are in-memory and per-process; a multi-instance deployment must add
  the Redis-backed limiter noted in the README.

### PII and money

- Raw national IDs and phone numbers are never stored — only salted SHA-256
  hashes, so duplicate detection works without retaining the identifiers.
- Money columns are `NUMERIC(18,2)` on PostgreSQL (`REAL` there loses cents);
  the adapter parses them back to JSON numbers.

### Response handling

- JSON bodies are size-limited (1 MB) and validated with `zod`; malformed
  JSON is a `400 invalid_json`, oversized bodies a `413 payload_too_large`.
- Error responses carry a stable `error` code, a `message` and a
  `request_id` (also returned as `x-request-id`); stack traces and internal
  exception messages are not returned to clients.
- Security headers are set on every response (CSP, frame deny, nosniff,
  referrer policy, permissions policy), with HSTS in production/TLS
  deployments. Responses that may contain one-time secrets (API keys, webhook
  signing secrets) are marked `Cache-Control: no-store`.

## Secrets handling

- All configuration comes from environment variables (a local `.env` is loaded
  in development); `.env*` is git-ignored. Never commit secrets.
- Production startup validates the required secrets and refuses to run with
  missing or short values.
- Generate independent random values for `AFRISCORE_ADMIN_TOKEN`,
  `ID_HASH_SALT` and `LEDGER_HMAC_KEY`; do not reuse one for another.
- Rotating `ID_HASH_SALT` breaks duplicate detection against existing hashes;
  rotating `LEDGER_HMAC_KEY` makes previously anchored chains fail
  verification. Treat both as long-lived secrets and plan rotation
  deliberately.
- Do not log request bodies, tokens or signing secrets. Use a secrets manager
  in production where available; environment variables are the current
  mechanism only.

## Known limitations

- No external anchoring of ledger heads (a compromise of the server key is not
  detectable locally).
- No durable webhook retry queue or idempotency keys.
- Rate limiting is single-process and in-memory.
- Connectors are synthetic; there are no live institutional integrations.
- Consent is operator-granted through the admin token, not captured by an
  end-user consent UI/flow.
- No formal security audit, penetration test or compliance certification
  (for example SOC 2 or Kenya Data Protection Act assessment) has been done.
- No secrets manager, HSM or key rotation automation.
- No WAF, mTLS or partner IP allowlisting at the application layer.
- The admin token is a single bootstrap credential without roles or per-action
  scopes.
