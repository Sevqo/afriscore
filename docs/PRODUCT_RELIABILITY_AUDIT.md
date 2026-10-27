# Product reliability audit — 2026-10-27

This review supplements PRODUCT_FUNCTIONAL_AUDIT, rather than turning previously gated integrations into production services. The current full regression is recorded in ENGINEERING_REFACTOR_REPORT. Database suites use disposable SQLite/PostgreSQL, not the hosted application database.

| Product | Reviewed evidence / repair | Remaining boundary |
| --- | --- | --- |
| Authentication / accounts | Existing verified managed identity observed read-only; restored synthetic session; old short-password compatibility, current memberships and three workspace types tested. Fixed initialization, form policy, shared transport and environment selection. | Founder password entry, real mailbox recovery and physical Safari acceptance are not claimed. |
| Customers / orders | CRUD/history/search, literal filtering, pagination, tenant/environment guards and order-to-invoice tests rerun. | No general CRM/archive expansion. |
| Invoices / receivables | Integer totals, issue/void/partial/final payment, refresh persistence, recovery of scoped reports and source-linked state tests rerun. | No eTIMS or external invoice delivery. |
| Payments / reconciliation | Forged/replayed/concurrent/out-of-order provider events, allocation amounts and exception review rerun. | Only qualified test adapters; no live collection/settlement. |
| Cash flow / reports | Source coverage, currencies, dates, expense corrections and CSV tests rerun. CSV requests now include managed credentials. | Recorded movement is not bank balance or profit. |
| Intelligence / forecasts | Deterministic scoped inputs/scenarios/history tests rerun; live Neon authenticated intelligence GET succeeded. | No probability/calibration claims or externally trained forecast. |
| AI assistant | Fixed read-only tools, consent, minimization, quotas and cross-tenant tests rerun. | External model quality/availability and paid calls not exercised. |
| Automation / notifications | Dedupe, pause, current authority, durable runs and failed-workspace isolation rerun. Live Neon automation read succeeded. | Single process; no outgoing customer email/SMS/WhatsApp service. |
| Connect / Data | Source labels, retry/disconnect/import dedupe and registry tests rerun. | No live institutional connector or generalized external cursor qualification. |
| Fulfillment / protected purchase / disputes | Delivery quantities, partial delivery, buyer access, evidence and separate-approval transitions rerun. | No real custody, escrow, settlement or complaint-only refund. |
| Passport / trust / credentials | Signed claims, holder/issuer authority, review, privacy, one-time recipient grants, expiry, revocation, compromise and tenant tests rerun. Managed requests now carry identity; live Passport read succeeded. | Production issuer governance, KMS and institutional recognition remain gated. |
| Blockchain | Isolated local contract/root/inclusion, tamper rejection and independent verifier executed after moving trust source/tests. | No public testnet/mainnet deployment or new contract identifier. |
| Developer | Scoped key/revocation/logging/webhook retries and Developer-without-company tests rerun. Explicit Explorer key remains authoritative in shared transport. | Real external receiver/load/distributed qualification remains open. |
| Legacy consent / Orbit / ledger | Existing permission, links, normalization, immutable history and worker suites rerun. | No implicit account ownership/data migration. |

Systemic defects had larger impact than replacing product languages: missing identity headers affected multiple managed products; startup could select the wrong engine; the launcher could silently reuse the wrong environment; an idle checked-out database connection could crash the process. These were repaired and tested. The audit did not identify evidence justifying a rewrite into microservices or adding Python to deterministic financial calculations.

Security review included auth origin isolation, source/secret boundaries, immutable financial/source state, tenant roles, provider callback authenticity, capability disclosure, issuer/key binding and transaction disconnect behavior. It is application regression evidence, not an independent penetration test, regulatory review or full performance/soak audit. No production database records/settings were changed.
