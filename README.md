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

**Identity & Trust.** Verify a business or person, build a
tamper-evident record of every verification event (SHA-256
hash-chained — provably unaltered, not just claimed), and compute an
explainable trust score. Nothing about a subject's record is visible
to a third party without their explicit, revocable consent.

**Data Infrastructure.** Exercise M-Pesa- and bank-shaped feeds in the
synthetic sandbox and normalize their transactions into one canonical shape —
regardless of whether the source called it `CR`, `CREDIT`, or
`CREDIT_TRANSACTION`. From that, compute a standard financial profile:
revenue, expenses, cash flow, growth.

**Business Operations.** Create invoices and let the reconciliation
engine match them against incoming payments automatically — including
payments that don't land on the exact invoiced amount (transaction
fees, rounding) or arrive as several installments instead of one.

**Business Intelligence.** Ask which invoices are overdue, get a cash
flow forecast, see statistically unusual transactions, or check how
concentrated revenue is in one customer — all computed from real data
with a clearly stated methodology, never a black-box guess.

**Query Layer.** Ask those same questions in plain language
(`POST /businesses/:id/ask {"question": "which invoices are
overdue?"}`). Answers are still grounded entirely in the Business
Intelligence layer above — this routes the question, it doesn't
generate the answer.

**Sandbox.** Everything above works identically against isolated test
data — same verification, same consent rules, same reconciliation
logic — so a partner can integrate and test failure modes (a failed
payment, a duplicate webhook, a disconnected account) without touching
anything real.

## Architecture

```
  M-Pesa · Bank · (KRA, later)
            |
      Connector Service            - provider-specific raw fetch
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
```

Every service reads/writes through a dual-engine DB adapter
(`src/db/adapter.ts`) — SQLite for local development, PostgreSQL for
production — so the same code runs against either without changes.
The `## Not built yet` section below keeps the boundary between live,
simulated and institution-dependent capabilities explicit.

## Quickstart

```bash
npm install
npm run build
npm start
# No DATABASE_URL set -> SQLite file at ./afriscore.db (local dev)
# DATABASE_URL set     -> PostgreSQL
```

```bash
# Set AFRISCORE_ADMIN_TOKEN to a random 32+ character secret first.
# Administrative routes require x-admin-token; never expose it to browsers.

# Register a client and get an API key
curl -X POST localhost:4000/v1/clients -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"name": "my-app"}'

# Register and verify a business
curl -X POST localhost:4000/v1/businesses -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"legal_name": "Jua Kali Traders Ltd", "registration_number": "PVT-ABC123", "kra_pin": "P051234567X"}'
curl -X POST localhost:4000/v1/businesses/{id}/verify -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN"

# Grant your client access, then pull its financial profile
curl -X POST localhost:4000/v1/consents -H "Content-Type: application/json" -H "x-admin-token: $AFRISCORE_ADMIN_TOKEN" \
  -d '{"subject_type": "business", "subject_id": "{id}", "grantee": "my-app", "purpose": "underwriting", "scope": ["financial_profile"]}'
curl localhost:4000/v1/businesses/{id}/financial-profile -H "x-api-key: {your key}"
```

Prefer sandbox data to experiment safely: `POST /v1/sandbox/businesses`
instead of `/v1/businesses`, and connect accounts with
`{"provider": "sandbox", "scenario": "success"}` for deterministic test
transactions.

## Testing

```bash
npm test                              # full suite against SQLite

TEST_DATABASE_URL=postgres://user:pass@localhost:5432/africore_test \
  npm run test:pg                     # same suite against PostgreSQL

npm run validate:openapi              # checks openapi.yaml actually parses as valid OpenAPI
```

CI (`.github/workflows/ci.yml`) runs all three — SQLite tests, Postgres
tests, and a type check plus OpenAPI validation — on every push and
pull request against `main`.

Tests cover the security-critical paths specifically: no request
reaches business data without a valid API key and an active,
per-grantee consent grant; revoking consent cuts off access
immediately; two tests actively tamper with the database (editing a
stored score, deleting a ledger entry) and assert the hash chain
catches it.

## API reference

Full reference: [`openapi.json`](./openapi.json) (OpenAPI 3.0 — import
it into Swagger or Redoc, or run `npm run validate:openapi`). All routes
except health and the explicitly marked partner endpoints require the
bootstrap `x-admin-token`. Partner routes use `x-api-key` and, where
business/person data is involved, an active purpose-specific consent grant.

| Area | Endpoints |
|---|---|
| Developer Platform | `POST/GET /clients`, `POST /clients/:id/rotate`, `DELETE /clients/:id` |
| Identity & Trust | `POST /businesses`, `GET /businesses/:id`, `POST /businesses/:id/verify`, `GET /businesses/:id/trust-record` [partner], `GET /businesses/:id/ledger/verify`, same for `/persons` |
| Consent | `POST /consents`, `DELETE /consents/:id`, `GET /consents` |
| Data Infrastructure | `POST /businesses/:id/accounts/connect`, `POST .../accounts/:accountId/disconnect`, `GET .../accounts`, `POST .../accounts/:accountId/sync`, `GET .../transactions`, `GET .../financial-profile` [partner] |
| Business Operations | `POST/GET /businesses/:id/invoices`, `POST /businesses/:id/reconcile` |
| Business Intelligence | `GET /businesses/:id/insights` [partner] |
| Query Layer | `POST /businesses/:id/ask` [partner] |
| Webhooks | `POST/GET /webhooks` [API key], `GET /webhooks/events` [admin] |
| Sandbox | `POST/GET /sandbox/businesses`, `POST/GET /sandbox/persons`, `POST /sandbox/webhook-test` [API key] |

`[partner]` = requires a valid `x-api-key` header AND an active consent grant for the subject being accessed.

A few things worth knowing before integrating:

- **Consent is per-grantee, not global.** A key proves who's calling;
  a separate consent grant proves that specific caller is allowed to
  see that specific subject's data.
- **Reconciliation returns a confidence score, not just a match.**
  `match_type` is `exact` | `tolerance` | `partial`, and confidence
  moves up or down based on whether a transaction's counterparty
  agrees with the invoice's optional `expected_counterparty` — so
  low-confidence matches can be reviewed rather than trusted blindly.
- **National IDs and phone numbers are never stored raw** — only a
  salted SHA-256 hash, so duplicate-registration checks still work
  without holding the underlying PII.
- **Webhook deliveries are signed** (`x-africore-signature`, HMAC-SHA256)
  and the signing secret is shown exactly once, at subscribe time.
- **Webhook targets are HTTPS-only.** Production requires an exact
  `AFRISCORE_WEBHOOK_ALLOWED_HOSTS` allowlist. Network-level egress
  controls are still recommended before accepting untrusted partners.

## Website

The public site lives in [`website/`](./website) and is separate from
the API. Run `cd website && npm ci && npm run dev` locally, or
`npm run build` for a static production bundle in `website/dist`.
It describes the working sandbox honestly and does not claim live
institutional integrations.

## Not built yet

- Real KRA / M-Pesa Daraja / bank open-banking integrations — every
  connector is currently simulated. This needs institutional
  partnerships, not more code.
- A real LLM behind the query layer, for broader natural-language
  coverage than the current keyword-intent matching.
- Payroll, Inventory, and Billing primitives.
- Redis-backed rate limiting (current limiter is in-memory,
  single-instance only).
- A real migration framework — the current guard in `src/db/index.ts`
  works for a handful of added columns but won't scale indefinitely.
- A secrets manager for production (currently environment variables).
- A partner-grade control plane with delegated authorization and
  independently verified consent capture. The current admin token is a
  bootstrap operator credential, not a public end-user consent flow.
- Durable per-subscription webhook retry queue, idempotency keys,
  observability and a formal security/compliance review before real data.

## Project structure

```
src/
  app.ts               - Express app wiring (no port bound; testable in-process)
  index.ts              - migrate() + listen()
  db/
    adapter.ts           - dual-engine query functions (SQLite/Postgres)
    index.ts              - schema + migration guards
  services/               - one file per capability (see Architecture above)
  routes/                  - one file per resource
  middleware/              - API-key auth, rate limiting
  __tests__/                - unit + route-level integration tests
openapi.json              - OpenAPI reference
.github/workflows/ci.yml  - SQLite, PostgreSQL and type-check CI
```
