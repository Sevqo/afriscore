# Milestone 2 release report — 29 October 2026

## Scope and readiness

Milestone 2 extends the existing application after the owner's Milestone 1 review. The original master roadmap and later requirements remain preserved; no Milestone 3 expansion was started. See [architecture, provider readiness and operating runbook](MILESTONE_2_ARCHITECTURE.md) and the [complete requested plan](MILESTONE_2_PLAN.md).

Implemented: shared customer history/archive/CSV/duplicate review; linked orders and invoice drafts; invoice filtering, partial/expiring payment links, bounded credit notes, receivables and collection activity; readable payment evidence, durable idempotency and attempts; reviewed split allocations; bounded simulator refunds/reversals; expense corrections/archive and recurring occurrence history; timezone-aware plans and in-app reminders; shared currency-specific financial reporting/charts/CSV; exact monetary entry and explicit service/capability enforcement. Existing Milestone 1 controls and trust modules remain in place.

Daraja STK initiation/query and durable callback-hint processing are implemented and tested with mocked transport. They are **externally unverified**, not live-configured or integration-ready under the requested definition. No sandbox credentials were available. The runtime enablement flag remains false. No real-money payment, refund, payout or custody capability was enabled. Other providers and regulatory prerequisites are explicitly listed in the architecture document. Current Neon MFA/passkey limitations remain unchanged.

## Financial integrity evidence

The automated contractor example confirms KSh 50,000 face value, KSh 30,000 first payment, KSh 20,000 outstanding, final payment and harmless replay. Additional tests cover bounded immutable returns/credits, split allocation races, no double expense fulfillment, retained corrections, provider occurrence dates, late failures, disabled services, read-only roles and tenant boundaries. The connected browser example records a KSh 5,000 expense and displays KSh 30,000 collections, KSh 5,000 outflows and KSh 20,000 outstanding. Net covered movement is KSh 25,000, never represented as bank balance or profit.

Provider acknowledgement and callback hints cannot settle invoices. Authenticated status lookup is tied to the stored attempt. Unknown initiation outcomes block another charge. Provider references use merchant/environment namespaces; immutable evidence conflicts are rejected. Unknown actual transaction dates are disclosed and excluded from delay statistics. Original allocations remain intact; return effects append adjustments. Invoice credits never create receipts. Effective expense reporting avoids counting an imported outflow twice.

## Executed checks

| Check | Result |
| --- | --- |
| SQLite full suite | 257 passed; one PostgreSQL-only skip, zero failures |
| Fresh local PostgreSQL full suite | 258 passed, zero failures |
| Website production build | Passed; 50 prerendered routes; 31 frontend/content tests passed |
| Backend/frontend TypeScript | Passed through production builds and backend typecheck |
| ESLint and architecture | Passed; 71 frontend modules, no static import cycles |
| Legacy API contract | 59 operations validated |
| Workspace API contract | 191 operations validated against registrations |
| Gateway and development startup config | Seven tests passed |
| Local chain/independent verifier regression | Passed |
| Diff whitespace | Checked |

A PostgreSQL-specific view syntax defect was corrected before migration. A reused test database correctly rejected previously published immutable fixture prices and reused mocked provider receipt identities; the final release suite used a fresh disposable local database and passed. An invoice dialog crash discovered in browser QA was fixed. Reports were consolidated to one set of controls, and duplicated print actions removed.

Local test timing instrumentation records actual endpoint durations; invoice creation was measured in milliseconds, not a production load benchmark. No throughput/SLA claim is made. Database tests ran only against disposable local SQLite/PostgreSQL databases, never Neon.

## Visual and interaction QA

Connected browser testing covered sign-in, invoice list/detail, canonical partial balance, payment/provider readiness, expense entry and reports. Payment-page overflow checks at 320, 375, 390, 768, 1024 and 1440 nominal pixels found no horizontal document overflow. Mobile invoice details use two-column balance cards and card-style tables. Provider availability is readable and explicit. Screenshots contain synthetic local data only.

Evidence: [invoice desktop](evidence/milestone2/invoice-desktop.jpg), [invoice mobile](evidence/milestone2/invoice-mobile.jpg), [payments desktop](evidence/milestone2/payments-desktop.jpg), [payments mobile](evidence/milestone2/payments-mobile.jpg), [expenses mobile](evidence/milestone2/expenses-mobile.jpg), [report desktop](evidence/milestone2/report-desktop.jpg), [report mobile](evidence/milestone2/report-mobile.jpg). The report screenshots show the final consolidated report. The invoice images predate removal of a duplicated print action. This is desktop-browser responsive QA, not physical iPhone/Safari or assistive-technology qualification. No Milestone 2 baseline screenshot was captured before implementation; the original supplied screenshots and Milestone 1 evidence remain in the prior report.

## Migration and deployment

Migration 008 was applied only to approved Neon development branch `br-jolly-lake-b4ff04st`. The successful guarded migration backed up 70 public tables / 816 rows, encrypted the snapshot and verified readback before applying additive DDL. A separate official HTTPS-driver backup/readback saw 78 tables / 817 rows and confirmed 008. No auth schema, production branch, old financial rows or existing encryption keys were changed. Backup decryption/readback passed; a complete restore rehearsal was not performed.

Direct PostgreSQL timed out; an initial WebSocket transport failed. The original verified-TLS WebSocket retry ultimately succeeded. A proposed proxy configuration was rejected by automatic approval review and was not used. HTTPS confirmation used Neon's official driver directly. Maintenance diagnostics suppress credentials and database contents. Both guarded maintenance scripts remain available; the HTTPS helper uses only the canonical financial DDL and atomic transaction.

Source was developed on `codex/milestone-2-financial-operations` from Milestone 1. Release commit, main push, deployed versions and hosted smoke verification are recorded in the release outcome below after deployment. Hosted startup remains verify-only, Render stays single-instance/free and existing Cloudflare/Neon routing is preserved. Backend must deploy before frontend controls. Daraja stays disabled. Rollback preserves additive schema and must not restore readers that ignore posted credits/return adjustments.

## Remaining limitations

External Daraja acceptance, production merchant authorization, live collection/refunds, C2B and transaction-status APIs remain blocked. Stripe/card processing, custody, escrow, payouts, lending and remittance are not operational. Invoice follow-up and obligation reminders are in-app only; customer email/SMS and guaranteed unattended schedules are not claimed. Render Free sleeps. Imports remain merchant statements. This is neither a complete accounting ledger nor a bank/profit statement. Full historical scans are suitable for the evaluation workload; production-scale aggregation/load testing and distributed worker leases remain future qualification work. Customer activity is bounded to the latest 500 workspace events / 100 matching events; possible duplicates require human review. Exported commercial PDFs use the browser print workflow, not a certified fiscal document.

Milestone 3 remains on hold for review.

## Release outcome

Source implementation: [353d614](https://github.com/Sevqo/afriscore/commit/353d61483326b17306732c8a9940b533e24ac604). The initial Render build identified a missing Docker COPY for the shared money module; corrected and released as [183d4d4](https://github.com/Sevqo/afriscore/commit/183d4d47a52c2d3481d9828d11fc0dc151b9d6fb). Both commits were pushed to main with author email cypriankiprop41@gmail.com. The old backend stayed live during the failed build.

Render reports **Deploy succeeded / Live** for 183d4d4 (1m05s), serving the existing backend at https://africore-api.onrender.com. [Deployment screenshot](evidence/milestone2/render-deployed.jpg). Cloudflare Worker africore-web version **bffce182-f889-4b8b-9be0-0e78b84326fa** is deployed at https://africore-web.cypriankiprop41.workers.dev. Public HTML and JavaScript returned 200; the deployed entry asset's SHA-256 matches the tested local build.

[GitHub CI run 40856643021](https://github.com/Sevqo/afriscore/actions/runs/40856643021) completed successfully on release commit 183d4d4: SQLite, PostgreSQL, website build, type/lint/startup/gateway, and local EVM/independent verification jobs all passed.

Read-only hosted smoke checks using the existing synthetic Neon managed identity passed after frontend deployment: Personal/Business/Developer financial summaries each returned 200; provider readiness returned 200 with Daraja disabled; health and PostgreSQL readiness returned 200. No real funds moved. [Sanitized hosted checks](evidence/milestone2/hosted-smoke.json) and [asset verification](evidence/milestone2/assets-live.json).

A comparison against the encrypted pre-migration snapshot confirmed all original IDs remain: seven users, nine workspaces, nine memberships, three managed identity links and nine organization scopes. Existing workspace record/payment/allocation/journal counts were zero before and after; local synthetic financial scenarios were not inserted into hosted workspaces. [Sanitized preservation counts](evidence/milestone2/preservation.json). Existing legacy financial data and earlier trust evidence were not deleted or migrated by this release.

The final report/evidence commit is documentation-only; deployed application source remains 183d4d4. No paid hosting changes, production-branch migration, new auth provider or live payment activation occurred.
