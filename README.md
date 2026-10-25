# AfriScore

Programmable business and financial infrastructure for African
markets, starting in Kenya. The goal is to be the layer other
companies build on — the way Stripe is for payments or Plaid is for
financial connectivity — not another standalone fintech app.

Kenyan businesses run across fragmented systems: M-Pesa, banks, POS,
government tax and registration systems, spreadsheets, WhatsApp.
Every lender, marketplace, or fintech that wants to understand a
business currently has to integrate with all of them separately, or
just guess. AfriScore is building a layer that can normalize authorized
source data into one consistent schema and expose useful capabilities
through a consent-gated API. Current provider connectors are synthetic;
live institutional connections are not yet available.

## What it does

**Identity & Trust.** Verify a business or person and build a
tamper-evident record of every verification event. The ledger is a
SHA-256 hash chain with per-subject sequence numbers and an
HMAC-anchored head: verification detects edits, deletions, reordering
and tail truncation, including by an attacker with database access but
without `LEDGER_HMAC_KEY`. The anchor has limits — someone holding the
key, or who can replace the whole chain plus its anchor with a
self-consistent forgery, is not detectable without external anchoring
(see [Known limitations](#known-limitations)). Nothing about a
subject's record is visible to a third party without their explicit,
revocable consent.

**Data Infrastructure.** Exercise M-Pesa- and bank-shaped feeds in the
synthetic sandbox and normalize their transactions into one canonical shape —
regardless of whether the source called it `CR`, `CREDIT`, or
`CREDIT_TRANSACTION`. From that, compute a standard financial profile:
revenue, expenses, cash flow, growth. Money columns are
`NUMERIC(18,2)` on PostgreSQL, so cents are not lost to float rounding.

**Business Operations.** Create invoices and let the reconciliation
engine match them against incoming payments automatically — including
payments that don't land on the exact invoiced amount (transaction
fees, rounding) or arrive as several installments instead of one.
`paid_amount` records what was actually received, and an invoice's
optional `expected_counterparty` adjusts match confidence: a payment
whose counterparty agrees raises confidence by 0.05, one that disagrees
lowers it by 0.20 and surfaces the reason in `note`.

**Business Intelligence.** Ask which invoices are overdue, get a cash
flow forecast, see statistically unusual transactions, or check how
concentrated revenue is in one customer — all computed from real data
with a clearly stated methodology, never a black-box guess:

- unusual transactions are flagged by z-score computed separately for
  credits and debits (mixing the two used to flag every large sale);
- the cash-flow forecast averages net flow over the observed window up
  to now, excludes future-dated rows, and reports confidence based on
  how much history exists;
- customer concentration uses money actually received
  (`paid_amount`), not invoiced amounts.

**Query Layer.** Ask those same questions in plain language
(`POST /businesses/:id/ask {"question": "which invoices are
overdue?"}`). The `query` scope buys the natural-language door only;
the intent's underlying data scope (`invoices`, `insights`,
`transactions`, `financial_profile`, `trust_score`) is required too, and
a missing grant returns `403` with `required_scope` (and
`matched_intent`). Answers are grounded entirely in the Business
Intelligence layer above — this routes the question, it doesn't
generate the answer, and an unmatched question returns a list of
supported topics rather than a guess.

**Webhooks.** Subscribe to business events with a signed HTTPS
delivery. Subscriptions are scoped per subscriber, to a `live` or
`sandbox` environment, and to event patterns validated against the
event catalogue. An event is delivered only when the subject has an
active consent grant to that subscriber covering the event's data
scope — consent is checked again at delivery time, so revocation stops
future deliveries immediately.

**Sandbox.** Everything above works identically against isolated test
data — same verification, same consent rules, same reconciliation
logic — so a partner can integrate and test failure modes (a failed
payment, a duplicate webhook, a disconnected account) without touching
anything real.

## Business track

AfriScore serves two subject types on one schema: individual borrowers
(`persons`) and businesses (`businesses`). The business track adds
statement-driven onboarding, an owner dashboard, a lender decision card,
receivables and supply-chain readiness — deterministic, auditable and
consent-gated. Nothing here forks the individual path; the subject is a
discriminator (`transactions.subject_type`), not a second product.

**1. Onboarding (statement → normalized transactions).** Record the owner's
consent first (`POST /v1/businesses/:id/onboarding/consent`), then upload a
CSV statement (`POST /v1/businesses/:id/statements`) for an M-Pesa business
till, an M-Pesa paybill or a bank account. A `StatementSource` interface
parses each export shape into the canonical transaction schema, tagged with
`subject_type=business`, the `shortcode` and the `statement_id`. Parse
failures return explicit 400 codes (`unreadable_file`,
`wrong_statement_type`, `insufficient_history` under 30 days,
`missing_shortcode`, `invalid_rows`) and failed uploads are still audited.
Ingestion is one DB transaction and writes one ledger entry per ingested
transaction. CSV only for now; PDF is a deliberate seam, not shipped.

**2. Owner dashboard.** `GET /v1/businesses/:id/business-profile` (API key +
`business_profile` consent) returns a 12-month UTC cash-flow series, inflow
volatility (coefficient of variation), revenue trend (newer-half vs
older-half monthly inflow), peak weekday/hour, average ticket, top-5
customers with concentration, repeat-customer ratio, supplier counts and
cross-month regularity, a deterministic 0–100 health score with five exposed
components, exactly three data-derived tips, receivables when invoices exist
and supply-chain readiness signals. Every response carries its methodology.

Health-score weights: cash-flow stability 30%, revenue trend 20%, payment
discipline 20%, customer concentration 15%, liquidity buffer 15%. Liquidity
is reported as unavailable — statements do not capture running balances — and
excluded with renormalised weights rather than invented. Bands: Strong ≥80,
Stable ≥60, Watch ≥40, At risk <40.

**3. Lender decision card.** `POST /v1/businesses/:id/decision-card` (API key
+ `business_profile` consent) maps those metrics into the shared
`DecisionCard` shape, extended with business fields: recommended limit, risk
band, verdict, evidence, confidence, adverse indicators, receivables,
supply-chain readiness and `audit_trail_ref`. Issuing a card writes the eight
derived metrics plus the decision event to the hash-chained ledger in one
transaction; `audit_trail_ref` is the decision entry id. Confidence's
`reconciliation_score` stays `null` until invoice data exists. Limit formula:
`avg monthly inflow × risk multiplier (low 1.5 / moderate 1.0 / elevated 0.5 /
high 0.25) × concentration haircut × failed-payment haircut × health haircut`,
rounded down to KES 1,000 and capped at KES 10,000,000.

**4. Receivables.** Invoice lifecycle `draft → sent → partially_paid → paid`,
with `overdue` derived from `due_date`. `POST .../invoices/:id/payments`
records a manual receipt or links a completed incoming transaction;
`POST .../receivables/match` runs full-settlement reconciliation first, then
applies partial receipts where the counterparty agrees; anything left over
appears in `GET .../receivables/review-queue`. `GET .../receivables/summary`
computes DSO = open receivables ÷ invoiced sales in the trailing 365 days ×
365, plus average days-to-pay and the matched-receipt ratio. With no invoices
the summary is `null` and DSO is **not** fabricated. Invoice attachments are
metadata-only (file name, SHA-256, size).

**5. Supply-chain-finance readiness.** `supply_chain_readiness` on the
dashboard and card is descriptive, not a financing decision: anchor-buyer
candidate (repeat, regular buyer with ≥3 payments across ≥2 months and ≥25% of
inflow), supplier-relationship regularity, receivable verifiability (share of
open invoices backed by a matched receipt) and a concentration warning when one
buyer exceeds 40% of inflow without anchor-buyer evidence.

**6. Dual-mode linked profiles.** A person may also be a business owner.
Linking is explicit and idempotent (`POST /v1/businesses/:id/links`), writes an
auditable link to **both** ledgers, and never merges transaction streams,
scores or consent grants. `GET /v1/businesses/:id/linked-profiles` shows the two
side by side only when a link exists; without a link they stay isolated.
Consent remains per subject: revoking business consent blocks business reads
and leaves the linked person's reads untouched.

**Local demo.** `npm start` serves a dependency-free dashboard at
`http://localhost:4000/dashboard` (same origin, no CORS): onboarding → consent →
CSV upload → owner dashboard → lender card. It calls only the documented API
and never bypasses auth or consent.

## Orbit Core (async orchestration)

Orbit is the orchestration and state layer that connects ingestion, normalization,
ledger writes, scoring and receivables matching. It extends the existing services
rather than replacing them: workers call the same parsers, ledger and scoring
functions the synchronous endpoints use.

**Queues** (BullMQ on Redis when `REDIS_URL` is set; an in-memory broker with the
same semantics when it is not, so local dev and tests need no Redis):

- `ingestion` — validates subject consent and extracts the raw statement text
- `normalization` — parses, dedupes by receipt id, writes transactions
- `ledger` — writes the ingested rows to the hash chain (idempotently)
- `scoring` — recomputes metrics / health / DSO after data changes
- `matching` — reconciles incoming payments to invoices
- `dead-letter` — jobs that exhausted retries

**State machine** — every workflow has a row in `workflows` and an append-only
`workflow_events` history:

`PENDING → CONSENT_VERIFIED → PARSING → NORMALIZING → RECONCILING → SCORING → READY`

Failures land in a phase-specific terminal state (`FAILED_PARSING`,
`FAILED_NORMALIZATION`, `FAILED_LEDGER`, `FAILED_RECONCILING`, `FAILED_SCORING`).
Transitions are forward-only; retries are idempotent (`advance()` is a no-op if
the workflow is already at/after the target state).

**Idempotency** — three layers:

1. **Jobs**: job ids are `sha256(stage + content + subject)`; a duplicate upload is
   dropped by the queue and the API returns the existing `workflow_id` with
   `duplicate: true`.
2. **Transactions**: the canonical `(account_id, external_id)` uniqueness plus an
   explicit receipt-id check means re-processing cannot duplicate rows.
3. **Ledger**: the ledger worker checks whether the stable id (`transaction_id` /
   `statement_id`) is already in the event data before appending, so a retried
   job cannot duplicate chain entries.

**Retries & DLQ** — every job gets up to **3 attempts with exponential backoff**.
Exhausted jobs are recorded in `dead_letter_jobs` and moved to the `dead-letter`
queue, whose worker logs the failure, sets the workflow to its `FAILED_*` state,
writes a `workflow.failed` ledger event (without breaking the chain) and emits a
`workflow.failed` notification.

**API triggers** — `POST /v1/businesses/:id/statements` returns **`202 Accepted`**
with `{ workflow_id, job_id, duplicate, workflow_url }` immediately;
`POST /v1/businesses/:id/payments/simulate` returns `200` with the matching
workflow id. Poll `GET /v1/orbit/workflows/:id` (admin) for the current state,
transition history and dead-letter errors. The local console at `/dashboard`
polls that endpoint and renders the pipeline live.

The console follows the landing page's design system (paper/mint/ink palette,
Sora + DM Sans + Space Mono, animated system map) and includes a one-click
**Run live demo**: it creates a demo business and API client, records consent,
queues a statement through Orbit, animates the state machine to `READY`, creates
a partially-paid invoice, then renders the owner dashboard and lender card.
Credentials can be pre-filled with `?business=…&key=…&admin=…` (local demo only).

**Running it**

```bash
# Single process (no Redis): the API also runs the in-memory workers.
npm run build && npm start

# Production-style: Redis + a separately scalable worker process.
REDIS_URL=redis://localhost:6379 npm run worker          # terminal 1
REDIS_URL=redis://localhost:6379 npm start               # terminal 2

# Development with hot TypeScript:
npm run start:dev    # API (in-memory workers)
REDIS_URL=... npm run worker:dev
```

`docker compose up --build` starts PostgreSQL, Redis, the API and a standalone
worker.

## Architecture

```
  M-Pesa · Bank · (KRA, later)
            |
      Connector Service            - provider-shaped raw fetch
            |
      Normalization Service        - one canonical transaction schema
            |
      +-----+------------------------------+
      |                                     |
 Identity & Ledger                  Data Infrastructure
 (business/person,                  (accounts, transactions,
  hash-chained trust                 financial profile)
  ledger, consent)                          |
      |                              Business Operations
      |                              (invoices, reconciliation)
      |                                     |
      |                              Business Intelligence
      |                              (overdue, forecast, outliers,
      |                               concentration)
      |                                     |
      +--------------+----------------------+
                      |
              Query Layer (/ask)
                      |
              API Gateway (auth, rate limiting, consent)
                      |
         Lenders . Marketplaces . Insurers . Developers
                      ^
                      |
              Webhooks (signed, consent-scoped)
```

Every service reads/writes through a dual-engine DB adapter
(`src/db/adapter.ts`) — SQLite for local development, PostgreSQL for
production — so the same code runs against either without changes.
Configuration is centralized in `src/config.ts` and validated at startup.
The `## Not built yet` section below keeps the boundary between live,
simulated and institution-dependent capabilities explicit.

## Quickstart

Requires Node.js 22 or newer (CI runs 22 and 24).

```bash
npm ci
npm run build

# Required for admin routes; use independent random values for each secret.
export AFRISCORE_ADMIN_TOKEN="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
export ID_HASH_SALT="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
export LEDGER_HMAC_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

npm start
# No DATABASE_URL set -> SQLite file at DB_PATH
#   (default: africore.db in the repository root)
# DATABASE_URL set     -> PostgreSQL
```

The API reads configuration from environment variables and loads a local
`.env` at startup when present; `.env.example` documents every variable.
Values set in the real environment take precedence over `.env`.

```bash
# Administrative routes require x-admin-token; never expose it to browsers.

# Register a client and get an API key (shown once)
curl -X POST localhost:4000/v1/clients -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"name": "my-app"}'

# Register and verify a business
curl -X POST localhost:4000/v1/businesses -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"legal_name": "Jua Kali Traders Ltd", "registration_number": "PVT-ABC123", "kra_pin": "P051234567X"}'
curl -X POST localhost:4000/v1/businesses/{id}/verify -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN"

# Grant your client access, then pull its financial profile.
# `grantee` must match the API client's name; `scope` is a list of scopes and
# `expires_at` is optional (ISO 8601 with offset, in the future).
curl -X POST localhost:4000/v1/consents -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"subject_type": "business", "subject_id": "{id}", "grantee": "my-app", "purpose": "underwriting", "scope": ["financial_profile"], "expires_at": "2027-01-31T23:59:59Z"}'
curl localhost:4000/v1/businesses/{id}/financial-profile -H "x-api-key: {your key}"
```

Prefer sandbox data to experiment safely. Sandbox management routes also
require the admin token:

```bash
curl -X POST localhost:4000/v1/sandbox/businesses -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"legal_name": "Sandbox Traders Ltd"}'

# Connect a deterministic sandbox account (same business id as above)
curl -X POST localhost:4000/v1/businesses/{id}/accounts/connect -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"provider": "sandbox", "account_identifier": "sandbox-001", "scenario": "success"}'

# Ingest and normalize its transactions
curl -X POST localhost:4000/v1/businesses/{id}/accounts/{accountId}/sync -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN"
```

Sandbox scenarios are `success`, `failure`, `duplicate` and `mixed`.
Reconnecting the same `(business, provider, account_identifier)` returns
`409 account_already_connected` rather than double-ingesting.

## Testing

```bash
npm test                              # full suite against SQLite

TEST_DATABASE_URL=postgres://user:pass@localhost:5432/afriscore_test \
  npm run test:pg                     # same suite against PostgreSQL

npm run typecheck                     # tsc --noEmit
npm run validate:openapi              # checks openapi.json against src/routes
```

`npm test` builds first, removes stale test databases, then runs the
route-level and unit suites. The PostgreSQL run requires a real database via
`TEST_DATABASE_URL` and isolates each suite so runs do not collide.

CI (`.github/workflows/ci.yml`) runs the SQLite suite, the PostgreSQL suite,
type-checking, OpenAPI validation and the website build on every push and
pull request against `main`.

Tests cover the security-critical paths specifically: no request reaches
business data without a valid API key and an active, per-grantee consent grant
(including expiry); revoking consent cuts off access immediately; two tests
actively tamper with the database (editing a stored score, deleting an entry)
and assert the hash chain catches it — and further tests assert tail
truncation and a rewritten chain are caught by the keyed head anchor.

The business track has dedicated suites: `business-onboarding` (parser
fixtures for clean/sparse till, bank and mixed sources; consent-before-parse;
dedupe; per-transaction ledger writes), `business-dashboard` (monthly buckets,
trend, concentration, health-component boundaries), `business-decision`
(limit haircuts, band downgrade, ledger audit trail, static UI), `receivables`
(lifecycle, partial/full payments, overdue, DSO math, auto-matching, review
queue, dashboard/card integration) and `supply-chain-links` (readiness
signals, explicit linking, per-subject consent isolation, person-flow
regression).

`orbit` covers the asynchronous engine deterministically on the in-memory
backend: upload → `PENDING`…`READY` with the full transition history, the
transaction/ledger rows and chain integrity; duplicate uploads producing no new
rows or ledger entries; a corrupted statement reaching the DLQ and
`FAILED_PARSING`; the admin workflow endpoint; payment → invoice matching → DSO
recalculation → ledger; unmatched payments parked for review; and retried
payment webhooks staying idempotent.

## API reference

Full reference: [`openapi.json`](./openapi.json) (OpenAPI 3.0 — import
it into Swagger or Redoc, or run `npm run validate:openapi`). All routes
except `/v1/health` and the explicitly marked partner endpoints require the
bootstrap `x-admin-token`. Partner routes use `x-api-key` and, where
business/person data is involved, an active purpose-specific consent grant.

| Area | Endpoints | Auth |
|---|---|---|
| Platform | `GET /health`, `GET /readiness` | public |
| Developer Platform | `POST/GET /clients`, `POST /clients/:id/rotate`, `DELETE /clients/:id` | admin |
| Identity & Trust | `POST /businesses`, `GET /businesses/:id`, `POST /businesses/:id/verify`, `GET /businesses/:id/ledger/verify` | admin |
| Identity & Trust (partner) | `GET /businesses/:id/trust-record` | API key + `trust_score` |
| Persons | `POST /persons`, `GET /persons/:id`, `POST /persons/:id/verify`, `GET /persons/:id/ledger/verify` | admin |
| Persons (partner) | `GET /persons/:id/trust-record` | API key + `trust_score` |
| Consent | `POST/GET /consents`, `DELETE /consents/:id` | admin |
| Data Infrastructure | `POST /businesses/:id/accounts/connect`, `POST /businesses/:id/accounts/:accountId/disconnect`, `GET /businesses/:id/accounts`, `POST /businesses/:id/accounts/:accountId/sync`, `GET /businesses/:id/transactions` | admin |
| Data Infrastructure (partner) | `GET /businesses/:id/financial-profile` | API key + `financial_profile` |
| Business Operations | `POST/GET /businesses/:id/invoices`, `POST /businesses/:id/reconcile` | admin |
| Business onboarding | `POST /businesses/:id/onboarding/consent`, `POST/GET /businesses/:id/statements` (POST → 202 + `workflow_id`), `GET /businesses/:id/shortcodes` | admin |
| Orbit orchestration | `POST /businesses/:id/payments/simulate`, `GET /orbit/workflows`, `GET /orbit/workflows/:id` | admin |
| Receivables | `GET /businesses/:id/invoices/:invoiceId`, `POST .../invoices/:invoiceId/send`, `POST .../invoices/:invoiceId/payments`, `POST /businesses/:id/receivables/match`, `GET /businesses/:id/receivables/review-queue`, `GET /businesses/:id/receivables/summary` | admin |
| Linked profiles | `POST/GET /businesses/:id/links`, `DELETE /businesses/:id/links/:personId`, `GET /businesses/:id/linked-profiles` | admin |
| Business intelligence (partner) | `GET /businesses/:id/business-profile` | API key + `business_profile` |
| Business decision (partner) | `POST /businesses/:id/decision-card` | API key + `business_profile` |
| Business Intelligence | `GET /businesses/:id/insights` | API key + `insights` |
| Query Layer | `POST /businesses/:id/ask` | API key + `query` + intent scope |
| Webhooks | `POST/GET /webhooks`, `POST /webhooks/:id/rotate` | API key |
| Webhooks (ops) | `GET /webhooks/events` | admin |
| Sandbox | `POST/GET /sandbox/businesses`, `POST/GET /sandbox/persons` | admin |
| Sandbox (partner) | `POST /sandbox/webhook-test` | API key |

### Status codes

Errors are JSON objects with a stable `error` code, a human-readable
`message`, a `request_id` (also returned as the `x-request-id` header) and,
where useful, `detail`, `details` or `required_scope`:

| Status | Code | When |
|---|---|---|
| 400 | `invalid_input` | Request body/query fails validation, including a bad `expires_at` or `due_date` before `issue_date` |
| 400 | `unreadable_file` / `wrong_statement_type` / `insufficient_history` / `missing_shortcode` / `invalid_rows` | Statement upload cannot be parsed safely |
| 400 | `invalid_payment` / `amount_exceeds_balance` | Payment amount is invalid or exceeds the invoice balance |
| 400 | `invalid_json` | Request body is not valid JSON |
| 400 | `invalid_event_pattern` | Webhook pattern is not in the event catalogue |
| 400 | `target_not_allowed` | Webhook target is not HTTPS, is a private/IP host, or is outside the allowlist |
| 400 | `missing_params` | Consent listing without `subject_type`/`subject_id` |
| 401 | `missing_api_key` / `invalid_api_key` / `admin_auth_required` | Missing or rejected credentials |
| 403 | `consent_required` | No active grant for the required scope; includes `required_scope` |
| 404 | `not_found` | Unknown business/person/resource, including ledger verification of an unknown subject |
| 409 | `account_already_connected` | Re-connecting the same provider account |
| 409 | `account_disconnected` | Syncing a disconnected account |
| 409 | `payment_already_recorded` / `transaction_already_matched` | Receipt already recorded / transaction already settled elsewhere |
| 409 | `invoice_not_draft` | Sending an invoice that is not a draft |
| 413 | `payload_too_large` | Request body exceeds the 1 MB limit |
| 415 | `unsupported_media_type` | Unsupported request content type/encoding |
| 429 | `rate_limited` | Rate limit exceeded; see `retry_after_seconds` |
| 500 | `internal_error` | Unexpected failure; details are logged, not returned |
| 503 | `admin_auth_not_configured` | Admin routes called without a configured admin token |

### Request limits

- **600 requests/minute per IP**, applied before authentication and body
  parsing, covering unauthenticated traffic (404s, admin-token guesses).
- **120 requests/minute per verified API client**, applied after key
  verification and keyed by client id.
- Responses include `RateLimit-Limit`, `RateLimit-Remaining` and
  `RateLimit-Reset`; a 429 also returns `Retry-After`.
- **List endpoints paginate**: `GET /businesses/:id/transactions`,
  `GET /businesses/:id/invoices` and `GET /webhooks/events` accept `limit`
  (clamped to 500) and `offset`, return a plain array, and expose
  `X-Total-Count`, `X-Limit` and `X-Offset` headers.
- **Metrics**: `GET /v1/metrics` (admin token) returns per-instance
  Prometheus-style counters and latency summaries. Per-process only; it is an
  operational aid, not a full tracing pipeline.
- Limiter state is in-memory and per-process — a multi-instance deployment
  needs the Redis-backed limiter in [Not built yet](#not-built-yet).

## Webhooks in detail

`POST /v1/webhooks` (API key) with:

```json
{
  "event_pattern": "invoice.paid",
  "target_url": "https://hooks.partner.example/afriscore",
  "environment": "sandbox"
}
```

- `environment` is optional (`"live"` default). Events only go to
  subscriptions in the matching environment.
- `event_pattern` must be a known event type or a group prefix such as
  `transaction.*`; typos fail at subscribe time with
  `400 invalid_event_pattern`. Current catalogue: `transaction.created`,
  `account.connected`, `account.disconnected`, `invoice.paid`,
  `invoice.payment_recorded`.
- Delivery requires an active consent grant from the event's subject to the
  subscriber's client covering the event's scope:
  `transaction.created` → `transactions`, `account.*` → `accounts`,
  `invoice.paid` → `invoices`. Unknown event types are recorded for audit but
  never delivered.
- Targets must be HTTPS, with no credentials or explicit port; localhost,
  `.local`/`.internal` names and IP literals are rejected. At delivery time
  the hostname is also resolved and deliveries to private/loopback/link-local
  addresses (or hostnames that do not resolve) are refused, blocking
  DNS-rebinding style SSRF. Production additionally requires an exact
  `AFRISCORE_WEBHOOK_ALLOWED_HOSTS` allowlist.
- Every delivery is signed: `x-africore-signature` is the hex HMAC-SHA256 of
  `` `${timestamp}.${body}` ``, and `x-africore-timestamp` is the Unix
  timestamp in seconds. Receivers should recompute the signature over the raw
  body and reject timestamps outside a small window (e.g. 5 minutes) to block
  replays.
- The signing secret (`whsec_…`) is returned exactly once, at subscription
  creation or rotation. `GET /v1/webhooks` never returns it.
- `POST /v1/webhooks/:id/rotate` (owner only) issues a new secret; the old
  secret stops validating immediately. Delivery is best-effort with a
  5-second timeout and no durable retry queue.
- `POST /v1/sandbox/webhook-test` sends one signed test delivery and returns
  `{delivered, error?, signature, timestamp}` — useful for validating your
  receiver before wiring a subscription.

## Things worth knowing before integrating

- **Consent is per-grantee, not global.** A key proves who's calling; a
  separate grant proves that specific caller is allowed to see that specific
  subject's data. `grantee` matches the API client's `name`. Grants can
  expire (`expires_at`) and are revoked immediately by `DELETE /consents/:id`.
- **Scopes are enforced per capability.** An active grant for one capability
  does not unlock another; `all` is an explicit broad grant for trusted
  flows. `/ask` requires `query` plus the matched intent's data scope.
- **Trust records are minimised by design.** `trust-record` returns a
  `subject` object, a redacted `verification_history` (whitelisted fields per
  event type, no KYC data) and an `integrity` verification result. Business
  legal names, KRA PINs, registration numbers, person names and identifier
  hashes are never returned by that endpoint; person records expose only
  `national_id_present` / `phone_present` booleans.
- **The trust ledger is tamper-evident, not immutable.** The HMAC-anchored
  head catches a database-only attacker rewriting or truncating the chain.
  It cannot catch an attacker who has the server key, and it does not protect
  against full replacement of the chain and anchor. Independent external
  anchoring is not implemented yet.
- **National IDs and phone numbers are never stored raw** — only a salted
  SHA-256 hash, so duplicate-registration checks still work without holding
  the underlying PII. Rotating `ID_HASH_SALT` invalidates duplicate detection
  against existing rows.
- **Reconciliation returns a confidence score, not just a match.**
  `match_type` is `exact` | `tolerance` | `partial`; `paid_amount` records
  what was received; `expected_counterparty` moves confidence up or down and
  is explained in `note`.
- **Sandbox and live data are separate.** Events carry the environment of
  their subject, and webhook subscriptions only receive events from their own
  environment.

## Deployment

A multi-stage [`Dockerfile`](./Dockerfile) builds and runs the API as a
non-root `node` user. It compiles with `tsc`, prunes to production
dependencies, runs `node dist/index.js`, and declares a `HEALTHCHECK` against
`/v1/health`.

```bash
docker build -t afriscore-api .
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgres://user:pass@host:5432/afriscore" \
  -e AFRISCORE_ADMIN_TOKEN=... \
  -e ID_HASH_SALT=... \
  -e LEDGER_HMAC_KEY=... \
  -e AFRISCORE_WEBHOOK_ALLOWED_HOSTS=hooks.partner.example \
  afriscore-api
```

[`docker-compose.yml`](./docker-compose.yml) provides a local API +
PostgreSQL stack (`docker compose up --build`) with development-only
secrets. The image sets `NODE_ENV=production`, so the required-secret checks
are enforced even if you forget to set it yourself.

Operations behaviour:

- `GET /v1/health` is a liveness probe that never touches the database;
  `GET /v1/readiness` runs a short `SELECT 1` and returns `503` when the
  database is unavailable.
- `SIGTERM`/`SIGINT` trigger graceful shutdown: stop accepting connections,
  wait up to `SHUTDOWN_TIMEOUT_MS` for in-flight requests, close the DB pool,
  then exit. Failed startup/config validation exits non-zero.
- Logs are structured JSON (`timestamp`, `level`, `event`, `request_id`, …)
  filtered by `LOG_LEVEL`; `warn`/`error` go to stderr.
- HTTPS deployments get `Strict-Transport-Security`; write responses (which
  may contain one-time API keys or webhook secrets) are sent with
  `Cache-Control: no-store`.
- PostgreSQL pool size and timeouts are tunable with `PG_POOL_MAX`,
  `PG_CONNECTION_TIMEOUT_MS`, `PG_IDLE_TIMEOUT_MS` and `PG_QUERY_TIMEOUT_MS`.

### Production checklist

Before exposing the API to real traffic:

- [ ] `NODE_ENV=production` — makes startup fail fast on missing secrets and
      requires a webhook allowlist.
- [ ] `DATABASE_URL` points at PostgreSQL; back it up (including
      `ledger_heads`) and restrict network access.
- [ ] `AFRISCORE_ADMIN_TOKEN` is 32+ random characters, stored in a secret
      manager, rotated on staff changes, never shipped to clients/browsers.
- [ ] `ID_HASH_SALT` is 32+ random characters, independent of other secrets;
      keep it long-lived (rotating it breaks duplicate detection).
- [ ] `LEDGER_HMAC_KEY` is 32+ random characters and independent of
      `ID_HASH_SALT`; keep it long-lived (rotating it breaks verification of
      existing anchors).
- [ ] `AFRISCORE_WEBHOOK_ALLOWED_HOSTS` lists only exact partner HTTPS hosts;
      add network egress controls so the process cannot reach internal
      addresses.
- [ ] `TRUST_PROXY` is set to the correct proxy depth when behind a load
      balancer, otherwise every caller shares one IP rate-limit bucket.
- [ ] TLS terminated in front of the API; never expose port 4000 directly.
- [ ] Liveness probe uses `/v1/health`; readiness probe uses `/v1/readiness`
      (which returns 503 when the database is unavailable). Alert on 5xx and
      on delivery failures (`GET /webhooks/events` is admin-only).
- [ ] Set `SHUTDOWN_TIMEOUT_MS` to fit your orchestrator's termination grace
      period, and allow enough time for in-flight requests on deploys.
- [ ] Tune `PG_POOL_MAX` and the pool timeouts for your database connection
      limit and latency.
- [ ] Run a single instance, or add the Redis-backed rate limiter before
      scaling out.
- [ ] Ship structured logs (`LOG_LEVEL=info` or `warn`) to a central store;
      do not log request bodies, tokens or secrets.
- [ ] Plan an independent anchor for ledger heads if the tamper-evidence
      claim must hold against server compromise.
- [ ] Review [SECURITY.md](./SECURITY.md) known limitations with your security
      team before handling real personal data.

## Website

The public site lives in [`website/`](./website) and is separate from
the API. Run `cd website && npm ci && npm run dev` locally, or
`npm run build` for a static production bundle in `website/dist`.
It describes the working sandbox honestly and does not claim live
institutional integrations. Its code samples mirror the request/response
shapes documented here; keep them in sync when the API changes.

### Test the website on a phone

Connect your phone and computer to the same trusted Wi-Fi network. From the
repository root, install dependencies once:

```bash
npm ci
npm ci --prefix website
```

Then start the API and Vite together in one terminal:

```bash
npm run dev
```

The terminal prints Vite's local and network URLs. On your phone, connected
to the same Wi-Fi network, open the network URL ending in `:5175`; Vite proxies
`/api` requests to the API on your computer. The command keeps routine API
configuration notices out of the way; actual API errors remain visible.
If either service is already running, the command reuses it rather than
starting a duplicate. If port `5175` is occupied by another app, Vite
automatically selects the next available port and prints its network URLs.
If Windows Firewall prompts you, allow Node.js on private networks. Press
Ctrl+C to stop servers started by this command. Do not expose this development
server to public networks.

The operational business dashboard and lender card are served by the API
itself at `/dashboard` (see [Business track](#business-track)) — dependency
free, same origin, no build step. The website remains the marketing surface.

## Known limitations

- **Ledger anchoring.** Tail truncation and chain rewrites are detectable
  without `LEDGER_HMAC_KEY`, but not if the attacker holds the key, or can
  replace the whole ledger *and* its anchor with a self-consistent forgery.
  External anchoring (transparency log / notarised checkpoints) is not built.
- **Synthetic connectors.** M-Pesa and bank live connectors are simulated;
  uploaded statements (CSV) are the only real-data path, and PDF statements
  are not parsed yet.
- **Single-instance state.** Rate-limit buckets and webhook delivery are
  in-process; multiple instances need Redis (or another shared store).
- **Admin bootstrap credential.** The admin token is an operator credential,
  not a partner-facing consent flow; business owners cannot self-serve
  revocation through a portal yet.
- **Invoice attachments** store metadata only (name, SHA-256, size); files are
  not persisted by the platform.
- **Supply-chain readiness is descriptive.** It surfaces signals for a factor
  or lender; it does not model reverse-factoring cash flows or make a
  financing decision.

## Not built yet

- Real KRA / M-Pesa Daraja / bank open-banking integrations — every
  connector is currently simulated. This needs institutional
  partnerships, not more code.
- A real LLM behind the query layer, for broader natural-language
  coverage than the current keyword-intent matching.
- External anchoring of ledger heads (e.g. a transparency log or
  notarized checkpoints), which is what would make tamper-evidence
  survive a compromise of `LEDGER_HMAC_KEY`.
- Payroll, Inventory, and Billing primitives.
- Redis-backed rate limiting (current limiter is in-memory,
  single-instance only).
- A real migration framework — the current guard in `src/db/index.ts`
  works for a handful of added columns but won't scale indefinitely.
- A secrets manager for production (currently environment variables).
- A partner-grade control plane with delegated authorization and
  independently verified consent capture. The current admin token is a
  bootstrap operator credential, not a public end-user consent flow.
- Durable per-subscription webhook retry queue, delivery idempotency
  keys, a wider event catalogue, and a formal security/compliance review
  before real data.
- PDF statement parsing and OCR (the `StatementSource` interface is ready for
  a PDF implementation; only CSV/text shapes ship today).
- Invoice attachment storage (metadata is recorded; file bytes are not stored).
- A Next.js-based dashboard app: the current business/lender dashboard is a
  zero-dependency page served by the API at `/dashboard`, chosen to avoid
  duplicating the existing Vite frontend stack.
- Reverse-factoring transaction modelling — only readiness signals are exposed.
- Partner-facing pagination and read endpoints for accounts and persons —
  business-facing management lists (`transactions`, `invoices`, webhook
  events) now support `limit`/`offset`, but those routes remain admin-only.
- Full metrics/tracing pipeline (OpenTelemetry, dashboards, alerting);
  `GET /v1/metrics` currently exposes in-process counters only.
- Automated backups and disaster-recovery documentation.

## Packaging notes

The API is deployed from source or the Docker image; it is not published to
npm. `package.json` owns the name, version and build scripts, and
`package-lock.json` is committed — deploy with `npm ci`, not `npm install`.
The website is a separate package under `website/` with its own lockfile.

## Project structure

```
src/
  app.ts               - Express app wiring (no port bound; testable in-process)
  index.ts              - config validation, migrate(), listen(), graceful shutdown
  config.ts             - environment parsing/validation + local .env loading
  logging.ts            - structured JSON logger and request access log
  metrics.ts            - in-process Prometheus-style counters (/v1/metrics)
  orbit/
    queue.ts              - queue abstraction: BullMQ/Redis + in-memory backends
    stateMachine.ts       - workflow states, forward-only transitions, history
    workers.ts            - queue processors, retries, DLQ failure handling
    orbitService.ts       - API triggers + workflow read models
    runtime.ts            - inline (dev) and Redis worker startup
    types.ts              - typed payloads for every queue
  worker.ts             - standalone Orbit worker entry point (Redis)
  db/
    adapter.ts           - dual-engine query functions (SQLite/Postgres)
    index.ts              - schema + migration guards
  services/               - one file per capability (see Architecture above)
    statement/              - StatementSource parsers (CSV: M-Pesa, bank)
  routes/                  - one file per resource
  middleware/              - API-key auth, rate limiting, request context, errors
  __tests__/                - unit + route-level integration tests
dashboard/                  - dependency-free owner dashboard + lender card (served at /dashboard)
test-fixtures/              - statement parser fixtures (till, sparse till, bank, individual)
openapi.json                - OpenAPI reference
scripts/                    - OpenAPI validation and test-database cleanup
website/                    - public marketing site (separate Vite app)
Dockerfile                  - multi-stage production image
docker-compose.yml          - local API + PostgreSQL stack
SECURITY.md                 - disclosure process and security model
CONTRIBUTING.md             - setup, tests and contribution conventions
.github/workflows/ci.yml    - SQLite, PostgreSQL, type-check, OpenAPI, website CI
```

## AfriCore Phase 1/2 workspace implementation

The redesigned public website and authenticated sandbox app share this API origin. Existing AfriScore consent APIs and records remain intact; new users do not implicitly claim legacy businesses.

Quick start: root `npm ci` and `npm run build`; in `website`, `npm ci` and `npm run build`; root `npm start`, then open `http://localhost:4000`. Register at `/signup`, verify with the local development token and open `/app`.

Read [implementation status](docs/IMPLEMENTATION_STATUS.md), [architecture](docs/ARCHITECTURE.md), [deployment](docs/DEPLOYMENT.md), [workspace API](docs/API.md) and [media system](docs/DESIGN_SYSTEM.md). `npm run validate:platform` checks new route documentation, while `npm run validate:openapi` validates existing APIs.

Production registration/recovery awaits email delivery. Live payments are disabled; sandbox checkout moves no funds. Acceptance gaps and continuation work are explicit in the status document.

## AfriCore Stage 2 workspace
Phases 3/4 now add deterministic financial intelligence and scenario forecasts, a read-only optional AI explanation adapter, persisted in-app automations/approvals, item fulfillment/evidence, protected-payment and dispute sandbox journeys, connector simulations, internal engineering views and ten original SVG scenes. Start with [Stage 2 results](docs/STAGE2_TEST_RESULTS.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md). These workspace calculations differ from the legacy /v1 analytics described above; see [INTELLIGENCE](docs/INTELLIGENCE.md) and [FORECASTING](docs/FORECASTING.md).

Local setup: npm ci; npm --prefix website ci; npm run build; npm --prefix website run build; npm start. For concurrent API/Vite development use npm run dev (retains phone-testing configuration). Migrations run at API startup. Live payment/custody integrations stay disabled. OPENAI_API_KEY and AFRICORE_AI_MODEL are optional server-only settings; secure local setup is ignored by Git and is not supplied by cloning. Current project credits blocked the synthetic live AI check. No production deployment is included.
