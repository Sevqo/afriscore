# Second-pass security remediation

Reviewed 28 October 2026 against the supplied three-page *AfriScore Security and Code Review: Second Pass*, current source, and the running development deployment. AfriCore is the current product; legacy AfriScore variable/API names remain compatible. This is an engineering review and regression exercise, not an independent penetration test or regulatory approval.

## A. Executive summary

The [findings register](SECURITY_FINDINGS_REGISTER.md) tracks 23 review areas: four new high-priority findings, five medium-priority findings, eight previous findings, five service findings and webhook DNS rebinding. It distinguishes corrected code from partial mitigation, already-existing protection and deployment verification. Do not interpret passing tests as closure of external operational gates.

Code-review disposition: 22 areas confirmed, 19 corrected for the documented active/new-write scope, three partial (password/MFA, historical encryption rollout and KYC lifecycle), one ordinary-ledger-deletion claim not reproduced. The three partial areas contain external or controlled rollout tasks; they are not counted as fully fixed. Deployment status is assessed separately below.

The implementation requires a production gateway credential, blocks internal routes at the customer edge, binds client IP metadata to that credential, limits workspace creation and reserves AI capacity across identities and workspaces. Financial changes prevent conflicting provider replays, preserve transaction timestamps, serialize legacy receipt settlement, bound ambiguous matching, enqueue durable notifications and remove automatic credit approval/decline from imported evidence.

Eight-character passwords remain the explicit owner preference. Local screening is stronger, but external breach screening was not approved. Privileged MFA is an external gate: the current Managed Better Auth plugin contract does not expose it. Public customer routing denies internal operator APIs; no custom authentication replacement or false MFA claim was introduced.

## B. High-priority findings

`src/middleware/gateway.ts` and production validation fail closed without a 32-character gateway credential. Current and previous credentials use constant-time comparison; credentials are stripped before application handling. Only minimal health/readiness probes remain public. `deploy/cloudflare/worker.mjs` uses a default-deny API root policy, blocks internal/legacy administrative routes and sanitizes alternate path forms.

The Worker overwrites `x-africore-client-ip` with Cloudflare's client address. Express consumes it only after gateway authentication, validates it as a single IP, removes it, and uses it for rate-limit identity. This avoids guessing the Render proxy hop count. Local integration tests cover forged forwarding chains, different clients, IPv6, rotation and missing secrets. Actual hosted checks are recorded separately; tests do not prove geographically distinct client behavior.

AI reservations use a database transaction and a PostgreSQL advisory lock. Defaults are 20 external requests per identity/day, 50 per organization/day, two simultaneous requests, USD 5/day and USD 25/month in conservative USD 1 reservations. Failed or usage-less calls retain the reservation. Only approved text models, bounded input, bounded output, verified human sessions and explicit consent can reach the provider. UTC quota boundaries are tested around Nairobi midnight. This is an application ceiling, not a provider billing reconciliation feed.

## C. Financial integrity

The active payment provider is the sandbox simulator. A replay must agree on organization, request, amount, currency and outcome; conflicting reuse returns 409. The global sandbox reference constraint prevents double processing. Independent live provider/account namespaces must be qualified before any live provider is enabled.

Legacy ledger verification already checked sequence, keyed head and count. Ordinary middle/tail deletion was not reproduced as an undetected deletion. A separately retained expected checkpoint can now detect restoration of a formerly valid entire database snapshot. Without an independent checkpoint, rollback of both ledger and its head remains outside the local database's threat model.

Reconciliation and linked receipts use the transaction occurrence date. An invoice completed by multiple receipts uses the latest receipt date. Manual receipts remain manual evidence. Receipt/reconciliation paths share a business-scoped PostgreSQL lock to prevent concurrent overpayment. Wrong-currency or wrong-amount linked receipts are rejected. Matching has a 5,000-node search budget, yields between invoices and leaves ambiguous candidates for review. Currency aggregation rejects mixed currencies instead of silently adding them.

Legacy webhook events and delivery jobs are persisted in the same settlement transaction. Delivery runs outside settlement, with bounded batches, stable identities, timeout, consent recheck, retries and dead-letter status. Existing workspace delivery behavior remains separate. Multiple-host worker leases are still required before scaling beyond one backend process.

Business decision cards return `review` and zero recommended credit. Unclassified imported inflow cannot become a lending approval or automated adverse decision. Historical JSON keys such as `revenue_trend` remain compatibility aliases for recorded inflow; the descriptive text states the limitation. Legal review remains necessary before any regulated decision workflow.

## D. Authentication and authorization

Pinned Neon issuer/audience, EdDSA, maximum age, revocation and stable subject links remain intact. Unverified email proposals cannot overwrite the trusted application email. Verified collisions return 409 without merging identities; unchanged sessions avoid redundant writes. Invitations require verified ownership. Workspace authorization uses an explicit method/declared-route/kind map, plus current membership, capability, API scope and environment checks. Unknown routes fail closed.

Local new-password screening is shared by the application server and signup/reset UI. Existing login passwords are untouched. Direct managed-provider API policy remains vendor-controlled; frontend screening is not represented as a provider-side breach policy. See [authentication hardening](AUTHENTICATION_HARDENING.md).

## E. Sensitive data

Version-2 AES-GCM envelopes bind record purpose, tenant, environment, ID and key ID through authenticated data. Legacy envelopes remain readable; previous-key maps support controlled rotation. No existing key was rotated. Production defaults to legacy-compatible writes until explicit version-2 activation after compatible readers are live. Never roll back to a legacy-only reader after that activation.

Private identifier matching uses domain-separated HMAC with normalization and a version prefix. Exact legacy hash matches upgrade only when the original value is supplied again, with an audit event; no raw identifier is retained and no accounts are merged. New legacy webhook signing credentials are encrypted and displayed once. The approved development backup inventory found zero legacy webhook subscriptions, so there are no historical plaintext webhook secrets in that environment to convert.

Document access remains private and permission checked. Download intent is audited before bytes are returned. Database storage is not by itself public exposure. Malware scanning, retention execution and independent privacy review remain open operational requirements. Capability-bearing URL segments and queries are redacted from application logs; Worker invocation logs are disabled so sampled raw URLs are not recorded there.

## F. Additional reviews

Business Metrics: reviewed loading, window selection, completed/failed state handling, aggregation, scoring and explanatory text. Fixed out-of-window failure counts and hard-coded trend currency. These are descriptive metrics over covered records, not verified revenue, bank balance or a lending model.

Receivables: reviewed manual and linked receipts, balance checks, conditional transaction claims, partial matching, DSO, summary currency and timestamps. Added serialization of competing settlement paths, corrected final receipt dates, excluded future records from historical summaries and stopped labeling manual receipts as matched evidence. Legacy major-unit decimal storage remains a compatibility constraint; new workspace finance uses integer minor units.

Solidity: reviewed the complete `AfriCoreAnchors.sol` contract. It publishes roots only, checks publisher/admin roles, rejects zero/duplicate commitments, supports pause and uses OpenZeppelin Merkle proof verification. It handles no customer funds or private evidence. Local contract/independent-verifier checks passed. This is not a professional smart-contract audit or permission to use mainnet.

Website: reviewed authentication initialization/session identity, shared API access, workspace navigation, controlled forms, approval review details, media and prerendered service copy. Internal Engineering/Trust Operations now explain the separate access channel instead of advertising blocked public actions. The compact UI/content request is documented separately in [the interface update](../COMPACT_EXPERIENCE_UPDATE.md).

## G. Tests

See [security test results](SECURITY_TEST_RESULTS.md). Regression suites include both real local PostgreSQL and SQLite; mocked provider tests perform no paid AI or live financial calls. Earlier failures caused by sandbox loopback restrictions were rerun with permitted local network access. Changes to old expectations reflect explicit behavior changes: manual review instead of credit approval, durable delivery instead of inline HTTP, and manual receipt provenance instead of verified-match claims.

## H. Infrastructure and rollback

Browser → Cloudflare static assets/API gateway → single Render Express process → Neon development PostgreSQL. Browser authentication talks to the existing Neon managed auth origin. Customer API access uses the verified session JWT; gateway authentication does not replace user authorization. Redis/BullMQ remain optional legacy queue infrastructure; no hosted Redis was provisioned. The backend's existing timers process bounded workspace and legacy delivery work. No production branch, billing plan or live provider was activated.

Migration `006-security-hardening` is additive: approval bindings, legacy delivery jobs and usage indexes. It was applied to development branch `br-jolly-lake-b4ff04st` only after explicit approval and a locally encrypted application snapshot: 59 public tables, 161 rows, cryptographic readback verified. The snapshot excludes the managed auth schema and is not a tested full-cluster restore. Managed authentication was not migrated or reset. Direct TCP connectivity timed out; the same approved endpoint was reached through Neon's official TLS WebSocket driver. The backup stays in ignored `.tmp/security` and never enters Git.

Rollback preserves the additive tables. Before version-2 writes, the preceding application can read existing legacy ciphertext; after activation, retain this release's version-aware readers in any rollback. Do not restore an old database over new customer activity merely to roll back code. Old approvals without bindings require fresh review. Historical payment dates must only be repaired from linked authoritative evidence, never guessed.

Deployment verification and exact commits belong in [the test/release record](SECURITY_TEST_RESULTS.md); a source commit alone does not prove a running host changed.

## I. Remaining actions

See [residual risks](RESIDUAL_RISKS.md): privileged MFA/provider support, optional breach-screening approval, independent checkpoint custody, receiver qualification, distributed workers/rate limits before scaling, KYC scanning/retention, managed-provider security patch assurance, and professional privacy/security review. These remain explicit rather than being falsely closed by a local patch.
