# Milestone 2 financial architecture and operating boundaries

The owner approved Milestone 2 after reviewing Milestone 1. The original roadmap remains in PRODUCT_MASTER_PLAN.md; the current request is preserved verbatim in MILESTONE_2_PLAN.md. Milestone 3 expansion remains on hold.

## Domain inventory and change boundaries

Existing sources were retained: `platform/routes.ts` owns customers, orders, invoices and payment requests; `platform/payments.ts` owns settlement and the transactional outbox; `operations/intelligence.ts` owns expenses, obligations and financial summaries. New `finance/` modules extend these sources rather than introducing a competing ledger. Business, Personal and Developer reuse the same authorized API. Legacy consent APIs and existing trust modules remain regression coverage.

Customers retain stable IDs and historical document links when archived. New documents reject archived customers. CSV import validates a bounded batch; contact duplicates are skipped, possible duplicates are surfaced for human review, and records are never automatically merged. Orders retain document relationships; conversion produces a draft invoice. Commercial invoice numbers are workspace/environment unique. Invoices preserve line items, exact discount/tax calculations, issue/due dates and commercial notes. Printable invoices are commercial records, not eTIMS submissions.

## Persistence and invariants

Migration 008 is additive. It introduces durable scoped idempotency responses, provider event details, signed allocation adjustments, credit notes, provider connections, payment attempts, callback inboxes and recurring occurrence history. Existing receipts, allocations, journal entries, identities, memberships, prices and ciphertext are retained. PostgreSQL tables enable RLS and revoke PUBLIC access; application authorization remains mandatory. No auth-schema migration is included.

Amounts are safe integer minor units in an explicit currency. Decimal entry and basis-point arithmetic use exact integer calculations; no exchange rate or mixed-currency total is invented. `documentBalance` is the authority: outstanding = invoice face value - effective allocations - credit notes. Credits are bounded by unpaid receivables and never create cash. A paid invoice requires a supported refund process rather than a negative credit. Closed/credited invoices cannot accept more allocation. Credit creation cancels stale open payment requests.

Settlement serializes on the organization inside the database transaction. A provider reference is namespaced by environment, provider and physical merchant account; the original readable reference is retained separately. Conflicting receipt replays fail. Events, allocations and outbox writes commit together. Repeated requests with the same idempotency key return the first result; changed input conflicts. Secrets in checkout URLs are shown once and stored hashed, never in durable idempotency responses.

Returns preserve original evidence and append related adjustments. Refunds are bounded by the original confirmed amount; full reversals require the original amount. Effective allocations and linked order caches refresh atomically. Unlinked returns remain review evidence and do not subtract confirmed cash. The explicit test-return control only accepts isolated simulator evidence; it cannot manufacture a Daraja refund or reversal. The existing journal is observational payment accounting, not a complete general ledger or custody balance.

Reconciliation suggests same-currency outstanding invoices and requires a finance-authorized, reasoned allocation. Splits are bounded by both available confirmed funds and target outstanding balances. It never converts imports, fuzzy matches, browser messages or callback hints into provider confirmation.

## Expenses, obligations and reporting

Expenses support supplier/category/notes, exact currency amounts, retained corrections and archival. Replaced records are excluded from effective totals. Categorizing an existing imported outflow does not count the money twice. Expenses remain merchant statements, not provider proof.

Obligations are plans. Explicit fulfillment can create one self-reported expense; skip, pause, resume and cancel preserve history. Occurrences deduplicate by obligation and due date; monthly/yearly progression preserves the original anchor across month-end/leap years. Calendar comparisons use the configured timezone. In-app due reminders deduplicate per occurrence and honor active Cash Flow entitlement. Plans never move funds or automatically create paid expenses. Invoice follow-up records activity and notifies workspace finance members; no customer email/SMS delivery is claimed. Free Render sleep means background schedules have no delivery SLA.

The shared snapshot drives financial summary and report movement totals. Actual payment occurrence dates drive history when available; authenticated Daraja STK query supplies an observation time, not an authenticated transaction time. Such rows are labeled in data quality and excluded from payment-delay statistics. Imported/recorded expenses, invoices, credit notes and payment evidence remain distinct. Sparse charts plot actual recorded dates, support ranges and exact tables, and do not manufacture a trend from one point. No displayed net movement is a bank balance or profit.

## Entitlements and security

Invoice creation/receivables do not require Pay. Customer entry is included with Invoicing or Orders. Expenses operate independently; foundation financial summaries and account security do not require optional Intelligence. Pay, reconciliation and Cash Flow writes require their respective active services plus current membership, role, workspace kind and environment checks. Imported customer usage is metered only when the standalone customer service is active. Expense corrections and replayed fulfillment do not consume a second unit.

Provider configuration is finance-admin-only, human-session-only and encrypted with the existing context-bound key scheme. Daraja credentials never enter client bundles, logs or ordinary list responses. Callback capability paths are redacted. Public callbacks only write bounded durable hints; authenticated server lookup establishes the result. There are no provider-role grants, email identity merges or new public administrative payment routes.

## Provider readiness

| Capability | Readiness | Boundary |
| --- | --- | --- |
| Customers, Orders, invoices, credits and receivables | Implemented | Commercial records; no eTIMS submission |
| Expenses, recurring plans, Cash Flow | Implemented | Recorded coverage; no bank balance, profit or automatic fund movement |
| Simulator checkout, signed callback, allocations, test returns | Implemented | Isolated sandbox only |
| Daraja STK initiation/query adapter | Implemented, externally unverified | Mocked transport acceptance only; not yet integration-ready under the owner's definition |
| Daraja live collection, C2B, refunds/reversals | Blocked | No configured credentials, qualified provider acceptance or approved live activation |
| Stripe/card collection | Blocked | Reference architecture only; no claimed working integration |
| Custody, escrow, lending, payouts, remittance | Blocked | No implementation or authority claimed |

Daraja uses fixed Safaricom sandbox endpoints, cached OAuth, KES whole-shilling STK validation, bounded timeouts and Kenyan phone normalization. Acknowledgement is pending. Unknown initiation outcomes are retained and cannot trigger a second charge on retry. Callback merchant/checkout identities must match the durable attempt. A callback cannot settle money. Authenticated STK query is bound to that original attempt/amount/account. Inbox retries are bounded to five attempts, then require review. Server enablement defaults false. No sandbox credentials were present; no real Daraja transaction was attempted.

Before enabling even provider sandbox acceptance: supply approved sandbox consumer credentials, shortcode and passkey through encrypted setup; enable the server flag deliberately; qualify public HTTPS callback reachability and authenticated lookup, cancellation, timeout, duplicate and delayed outcomes; verify receipt/amount/account correlation against the provider. Before live use additionally establish the merchant/provider contract, applicable regulatory/partner authority, production credential handling, incident/refund/dispute operations and approved compliance review. Do not assume a software adapter grants payment-service authorization.

Official references reviewed: [Safaricom M-Pesa Express](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate), [Safaricom integration guidance](https://www.safaricom.co.ke/images/Downloads/Tender_Documents/EOI_Safaricom_M-PESA_Integration_V1_002.pdf), [CBK National Payments System](https://www.centralbank.go.ke/national-payments-system/) and [CBK draft policy/Bill 2026 notice](https://www.centralbank.go.ke/2026/09/21/draft-national-payment-system-policy-and-national-payment-system-bill-2026/). The 2026 Bill is described as draft; this release does not treat it as enacted law. Stripe's [PaymentIntents](https://docs.stripe.com/payments/payment-intents), [webhooks](https://docs.stripe.com/webhooks) and [idempotency](https://docs.stripe.com/api/idempotent_requests) informed the architectural comparison, not a shipped Stripe integration.

## API and deployment runbook

Shared validation contracts live in finance/contracts.ts; generated platform-openapi.json includes the new endpoints. Require Idempotency-Key on financial commands. Exact service/capability maps fail closed for undeclared routes. Existing API base/version and gateway model are preserved.

Run SQLite and disposable local PostgreSQL suites, frontend build/content tests, lint/types, both OpenAPI contracts, gateway/startup and local chain checks. Never run ordinary test cleanup against Neon. Apply 008 only to the approved development branch with `scripts/security-development-migration.cjs --finance --websocket --apply` after reviewing the encrypted backup/readback. The script guards project, branch, direct endpoint and current key. Hosted startup remains verify-only. Deploy the backend before frontend financial controls. Keep Daraja disabled. Verify health/readiness, managed identity resolution and all workspace kinds.

Rollback must retain the additive schema and existing keys. Before any financial writes, the prior application can be restored. After credits/returns/adjustments exist, do not restore readers that ignore them: disable new writes and forward-fix the financial reader, preserving the append-only history. An encrypted backup readback is not a full restore rehearsal. Single-instance workers are required until distributed leases are implemented. Never delete hosted financial rows as rollback.
