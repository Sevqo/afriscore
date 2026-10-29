# Connected platform implementation report — Milestone 3

The owner approved Milestone 3 and reuse of the existing OpenAI key. Work extends Milestone 2 release f0dccb2 on branch codex/intelligence-trust-platform. The complete request is retained in MILESTONE_3_PLAN.md. Milestone 4 and Capital remain deferred. [Pre-change capability audit](CONNECTED_PLATFORM_AUDIT.md) and [architecture, security, costs, privacy and operating runbook](CONNECTED_PLATFORM_ARCHITECTURE.md) provide the detailed domain record.

## Delivered scope

| Product | Implementation and readiness | External boundary |
| --- | --- | --- |
| Financial Intelligence | Implemented: canonical metrics with source/currency/period/completeness/refresh metadata, expense categories, imported inflows distinguished from collections, configurable evidenced alerts and acknowledgement | Covered records only; no profit/bank-balance/credit claim |
| Forecasts | Implemented: exact integer scenario arithmetic, linked returns excluded from extrapolation, data-sufficiency labels, prospective snapshots and later actual-observation evaluation | No fabricated historical backtest, statistical confidence interval or demonstrated model accuracy; new forecasts await their observation window |
| Assistant | Implemented: encrypted actor-private history, server-selected fixed tools, deterministic source links, Personal/Business/Developer eligibility, feedback/copy/retry/privacy/usage and messaging layout | Reused key's one synthetic probe returned provider_credit_exhausted. Real generated output remains unverified; no new key, hosted secret upload or billing activation |
| AI safeguards | Implemented: credential-looking input rejection before persistence, minimized numeric evidence, untrusted plain-text output, no model-selected tenant/SQL/write tools, durable idempotency, global/identity/workspace/model caps | Prompt/model quality requires funded external evaluation; fixtures test architectural isolation rather than model immunity |
| Automations | Implemented: 13 in-app templates, typed schedules/conditions, timezone/delay, immutable versions, exact queued configuration binding, cancellation and reviewed bounded retry, event backlog advancement, current creator/source checks, run history | Existing single-instance durable worker pauses when Render Free sleeps; external email/SMS and arbitrary write actions unavailable |
| Connect | Existing sandbox adapters/retries/disconnect retained; genuine authorized CSV review/import and M2 Daraja handoff documented | No live bank/accounting/government OAuth program, credentials or external certification |
| Data | Implemented optional service: source IDs, UTC normalization, deduplication/conflict handling, portable batch inserts, canonical lineage and quality/freshness views | Imported records remain merchant statements; no provider verification or automatic revenue classification |
| Business Verification | Existing private encrypted evidence/manual reviewer workflow preserved; file-validation and missing-malware-scan limits explicitly disclosed | No government registry authority, malware service or production verification certification |
| Passport / Credentials | Existing authorized issuer/holder/verifier, JOSE VC2, signed bitstring lifecycle, rotation/compromise, controlled sharing and source invalidation preserved and regression-tested | No OpenID wallet conformance, institutional issuer approval, production KMS/HSM or production signing activation |
| Trust Network | Existing bilateral relationships/disputes/corrections retained; independent private assessment dimensions added | No composite trustworthiness/eligibility score or disclosure of underlying financial data |
| Blockchain | Existing randomized commitments, Merkle batching, no-funds access-controlled contract and independent verifier preserved; actual local-chain checks executed | No new public testnet/mainnet contract, real-fund spend, production RPC or external smart-contract audit |
| Marketplace / APIs | Optional Data and all-kind Assistant definitions, exact capability/service policies, shared validation contracts, authoritative successful-unit metering, no silent activation | Customer charging stays disabled; previous service selections/prices preserved |

## Integrity and security findings resolved

Overdue reminders now subtract credit notes and cancel stale delayed work after settlement/configuration changes. Consumed event keys no longer trap the worker on the oldest 100 events. Suppressed notifications do not consume workflow usage. Source timestamps normalize before hashing; changed source content conflicts rather than overwriting financial history. Import reads/writes use bounded sets rather than one database round trip per record. Conversation quotas include archived retained history and lock identity reservations across workspaces, preventing archive/workspace churn from bypassing storage limits. Expiry blocks reads immediately and the existing worker physically purges expired conversations; backups retain their own lifecycle.

No auth-provider migration, identity merge, key rotation, live Daraja activation, financial ledger replacement, custody, lending, production credential issuer or production blockchain activation occurred.

## Verification

| Check | Actual local result |
| --- | --- |
| Full SQLite suite | 271 passed, one PostgreSQL-only skip; zero failures (272 total) |
| Full fresh local PostgreSQL suite | 272 passed; zero failures |
| Frontend production build/content | Passed; 33 tests, 50 prerendered pages |
| TypeScript and ESLint/architecture | Passed; 78 frontend modules, no static import cycles |
| Legacy API inventory | 59 mounted operations validated |
| Workspace API inventory | 210 operations validated |
| Gateway/startup configuration | Seven tests passed |
| Isolated local chain/independent credential verifier | Passed genuine local contract/signature/authorization/anchor/inclusion verification |
| Source whitespace | Checked |

Fourteen connected-platform integration tests cover private/encrypted/idempotent history, same-workspace other-owner denial, hostile instructions, source deduplication/conflicts, version-bound delayed execution, 105-event backlog advancement, alerts/entitlements, physical expiry cleanup, prospective evaluation, spending denial, credit-aware cancellation, 270-row normalization, secret-input rejection, a cross-service journey and archive-based quota bypass (some scenarios share a test). Existing suites retain issuer/status/sharing/relationship/approval/SSRF/financial/auth/security coverage. Ordinary tests never ran against Neon.

The connected contractor journey verifies KSh 50,000 invoice → KSh 30,000 confirmed test receipt → KSh 20,000 outstanding → authorized assistant evidence → one legitimate in-app notification → private Passport dimensions. Disabling Assistant blocks new conversations while Invoicing remains available. A malicious imported document identifier containing exfiltration instructions is excluded from provider evidence. Fixture providers cannot access secrets, select a tenant or execute actions.

Failures encountered before the final green runs: a DELETE fixture omitted the required JSON body; the hosted schema-verification fixture needed migration 009; the forecast-evaluation route initially referenced the wrong service ID and correctly failed closed; the frontend Node test loader needed to transpile the shared CommonJS-root TypeScript helper. These were corrected. A maintenance-script editing syntax error was detected by node --check and repaired before execution. No failed prototype migration was applied.

Measured 270-row batch import: 16 ms in an isolated SQLite targeted run and 80 ms in the local PostgreSQL release run. These are fixture timings, not a production throughput/SLA benchmark. Real provider output, large production datasets, physical mobile devices, assistive technologies, adversarial network/reorg testing and independent audits remain separate qualification work.

## Browser preview and visual evidence

The actual connected local preview uses synthetic data and the normal sign-in flow. Verified: assistant computes KSh 20,000 overdue/outstanding without external AI, persists feedback/history and links to authorized records; CSV preview/import records KSh 5,000 with source lineage and normalized timestamp; workflow edit preserves versions 1 and 2; intelligence reports KSh 30,000 collections, KSh 5,000 recorded outflows, KSh 25,000 covered movement and a KSh 20,000 overdue alert; private trust dimensions show missing evidence without adverse conclusions. Messaging geometry was checked at requested 320/375/390/768/1024/1440 widths with no horizontal document overflow. Desktop-browser viewport checks do not certify physical iPhone/Safari.

Screenshots: [assistant desktop](evidence/connected-platform/assistant-desktop.jpg), [assistant mobile](evidence/connected-platform/assistant-mobile.jpg), [Data desktop](evidence/connected-platform/data-desktop.jpg), [Data mobile](evidence/connected-platform/data-mobile.jpg), [workflow desktop](evidence/connected-platform/workflow-desktop.jpg), [workflow mobile](evidence/connected-platform/workflow-mobile.jpg), [trust desktop](evidence/connected-platform/trust-desktop.jpg), [trust mobile](evidence/connected-platform/trust-mobile.jpg). Images contain only synthetic preview data. Final alert-input wording was refined to ordinary currency amounts/percentages after the preview captures. No pre-Milestone-3 screenshot was captured; prior-release evidence remains in the Milestone 1/2 reports.

## Migration, release and operational limits

Canonical additive migration 009 was applied only to approved Neon development branch br-jolly-lake-b4ff04st through the guarded official HTTPS-driver helper. It took a consistent encrypted snapshot of 78 public tables / 828 rows and verified encrypted readback before applying DDL/catalog updates atomically. No production/auth schema or financial-row rewrite occurred. Full restore rehearsal is not claimed. Hosted startup remains verify-only. Backend must deploy before frontend controls.

Source commit, CI, Render/Cloudflare versions, hosted identity/endpoint checks and preservation verification are recorded below after deployment. The existing free/single-instance hosting and all previous provider boundaries remain. Existing explicit service selections are preserved; new Data and Assistant capabilities are not silently activated.

Outstanding dependencies: funded/approved AI runtime configuration and real answer evaluation; authorized live connector programs; a malware service; institutional reviewers/issuers; KMS/dual-control and recovery qualification; external VC/OpenID/contract/security/privacy/legal review; always-on/distributed scheduling qualification; real mailbox/device and broader accessibility/performance testing. No external dependency is labeled live merely because an adapter or local test exists.

## Release outcome

Pending deployment of the tested source and post-release verification.
