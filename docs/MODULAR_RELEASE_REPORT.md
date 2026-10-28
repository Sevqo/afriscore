# Modular platform implementation and release evidence

28 October 2026. This report consolidates service activation/deactivation, dependencies, metering/billing, education, density, functional audit and deployment status; it avoids duplicating separate copies of those runbooks.

## Architecture and product experience

See [SERVICE_CATALOG](SERVICE_CATALOG.md), [SERVICE_ARCHITECTURE](SERVICE_ARCHITECTURE.md) and [SERVICE_PRICING](SERVICE_PRICING.md) for the canonical inventory, nine additive tables, route policies, lifecycle, pricing models, authoritative units, limits and internal administration. Explore Services/My Services/Usage & Billing are implemented for all three workspace kinds. New workspaces select services explicitly; grandfathered existing workspaces retain free evaluation access. Nothing is collected from customers.

Public product pages retain their individual plain-language explanations, example walkthroughs and existing illustrations, and now connect the canonical service purpose, workflow, unit, dependency and applicable pricing review to workspace discovery. Normal Business Settings no longer shows a generic Sandbox/Production switch. Developer/test-finance contexts remain explicit; removing a selector does not enable real payments.

## Functional defect register

| Finding | Repair and evidence |
|---|---|
| UI verification action appeared after every managed sign-in | Explicit unverified-state action; see NEON_EMAIL_VERIFICATION |
| Full-page redirect repeated account/bootstrap/provider initialization | Local navigation with effect-based routing and one scoped bootstrap catalog |
| Ordinary product 403 cleared signed-in account | Only identity 401 clears identity; scoped denial invalidates scoped reads |
| Personal/Developer fetched all optional products and failed as a group | Tab-specific reads; inactive products do not block foundation pages |
| Invoicing-only customer entry was authorized but hidden in UI | Included customer navigation and gates accept Invoicing/Orders |
| Business Expenses catalog entry lacked an independent screen | Standalone expense entry/history, without Intelligence |
| Cash Flow tools were only available through Intelligence | Independent expense/obligation tools in Cash Flow |
| Intelligence fetched unactivated expense/obligation dependencies | Conditional support reads and editing controls |
| Passport-only support reads required Credentials | Parallel base reads; credential support reads only when active |
| Service toggle would leave workers executing | Durable entitlements checked by automation/sync/delivery workers |
| Preference timestamp could extend fixed-fee estimate eligibility | Estimate months derive from activation/cancellation history |
| Internal catalog update could ignore a concurrent version conflict | Conditional update count checked; immutable price versions reject duplicate publication |
| Disabled service could still advertise new invoice/payment actions | Creation requires active access; payment-link action requires Payments |

Financial journals, accepted provider callbacks, credential signatures/status and historical data retain their original integrity boundaries. A service toggle never fabricates proof or deletes history.

## Executed interaction audit

Isolated local synthetic Business workspace: created an empty workspace; chose only Invoicing through the goal flow; confirmed unrelated services remained available; used included Customers without a Customers subscription; created a customer and draft invoice; issued it; observed one issued-invoice usage unit with KES zero estimate/due; saved a non-payable estimate snapshot; pinned the service; confirmed deactivation and retained usage/history. API tests cover inactive/active/deactivated access and persisted data.

Personal tests independently activate only Expenses, save a record, read it again and confirm foundation reporting totals without Business Passport or company requirements. Developer tests independently activate API access and Invoicing, create a scoped key, perform a successful request, inspect its workspace usage and reject further key calls after API-service deactivation; human key revocation remains available. Existing journey suites cover invoices, collections, reconciliation, source distinctions, team roles, connector retries, automations, proof and isolated demo behavior.

These HTTP/database journeys are distinct from clicking every screen on every physical browser. Actual iPhone/Safari mailbox and device acceptance are not inferred from desktop viewport simulation.

## Density and visual system

The prior compact release already reduced application controls/headings and spacing. Small operational type is retained rather than blindly reduced twice. This release further reduces oversized public/account headings and unifies slightly rounded controls:

| Shared component/token | Before | Current |
|---|---|---|
| Public display maximum | 54.4 px | 43.52 px (-20%) |
| Public section maximum | 38.4 px | 30.72 px (-20%) |
| Account entry heading maximum | 41.6 px | 33.28 px (-20%) |
| Smaller-screen hero maximum | 44.8 px | 35.84 px (-20%) |
| Button corners | 3–4 px | 8 px |
| Input corners | 5 px | 8 px |
| Operational panel corners | 6 px | 10 px |
| Editable mobile text/minimum control height | 16 px / 44 px | Preserved for legibility and touch/zoom behavior |
| Operational panel padding | 16 px | Preserved compact baseline |

Marketplace cards are content-sized, three/two/one columns by available width; filters/actions wrap. Data tables scroll within their own containers. Native dates use the shared validation and containment rules. Browser screenshots are local ignored evidence under `.tmp/marketplace`, including mobile catalog/usage and the public homepage/product explanation. Actual inspected DOM widths included 375 and 1265 px, with body width matching the viewport and mobile inputs at 16 px. Browser viewport overrides did not reliably resize an existing tab; requested sizes are not reported as measured coverage. Physical device and a full breakpoint matrix remain separate acceptance work.

## Authentication, performance and remaining external gates

See [NEON_EMAIL_VERIFICATION](NEON_EMAIL_VERIFICATION.md) and [AUTH_PERFORMANCE](AUTH_PERFORMANCE.md). Development signup verification codes/shared email provider were inspected and already enabled. The owner had no unused controlled mailbox, so actual receipt and live expired/incorrect-code/email-change acceptance remain explicitly unverified. No account was reset or falsely marked verified. The synthetic managed identity is unverified; its session check is not proof of a verified mailbox journey.

Render free-tier wake-up remains a latency boundary. Backend identity, revocation and membership validation is preserved. No paid host upgrade or live AI charge was used for QA. Existing residual security gates in `docs/security/RESIDUAL_RISKS.md` remain: privileged MFA qualification, unapproved breach-screening egress, historical reencryption, KYC lifecycle, external ledger checkpoint custody, receiver qualification and distributed leases/rate limits before scaling.

## Validation and deployment record

Final release validation passed SQLite **241 with one PostgreSQL-only skip**, PostgreSQL **242**, frontend **24**, gateway **4**, startup **3**, lint/type checks, **59 legacy / 169 workspace** contract operations and local EVM/independent verification. [All five GitHub CI jobs passed for application commit a3510ff](https://github.com/Sevqo/afriscore/actions/runs/40732604890). One intermediate local suite suffered a connection reset during a suspended/stale loopback connection; the entire affected platform suite passed on immediate isolated rerun, followed by clean complete release suites on both engines. Production dependency audit: backend zero findings; website seven low transitive findings, zero moderate/high/critical, consistent with the documented dependency gate.

Neon development migration **007-service-marketplace applied** after an encrypted local backup and verified encrypted readback: 61 public application tables, 169 rows at backup time. This is not a full restore drill. Existing keys, accounts, names and records were preserved; production branch was not touched. Backend startup stays verify-only and now requires all seven migration versions plus marketplace tables. Public internal routes remain blocked.

Verified deployment:

- Application source: [`a3510ffb0e802f9a5b61a273f114f5c1525edf45`](https://github.com/Sevqo/afriscore/commit/a3510ffb0e802f9a5b61a273f114f5c1525edf45), pushed to main with the requested author email.
- Render: `dep-dbh2obutlv9c73dsckrg`, **Deploy succeeded / Live**, matching application commit; existing free single instance and verify-only database startup retained.
- Cloudflare: worker version `8708a014-ac0f-41b1-be38-3395bbb3cda8`, verified public page includes the new service explanation and activation link.
- Site: [AfriCore](https://africore-web.cypriankiprop41.workers.dev). Origin: [existing Render backend](https://africore-api.onrender.com), protected from direct application access.
- Hosted synthetic account/bootstrap and all three workspace reads: **200**. Business/Personal/Developer catalogs: **22 / 6 / 9** eligible services. All three usage views return zero amount due and collection disabled.
- Anonymous account **401**, public internal service administration **404**, direct-origin protected account **403**, readiness **200** with only the status field.
- Existing private synthetic Passport API/readback succeeds, context-bound hosted ciphertext decrypts with its correct binding and rejects a wrong binding. **7 application users, 9 workspaces and Continua preserved.** No real customer record was reset or deleted.
- Post-release account timing and its cold-start limitations are recorded in AUTH_PERFORMANCE.

This verifies the online evaluation deployment, not external financial authorization, mailbox receipt, physical-device acceptance or a production launch certification. Rollback must preserve additive tables and the version-aware encryption reader; never roll back to a legacy-only ciphertext reader or reset the database.
