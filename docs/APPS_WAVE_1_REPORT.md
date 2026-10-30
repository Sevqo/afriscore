# AfriCore Apps Wave 1 — verified source, release pending

30 October 2026, Africa/Nairobi. This is a source implementation report, not hosted acceptance. The live Milestone4 release is unchanged. The approved Finance image is the visual reference; none of its fictional amounts, identity, avatar, plan or later apps is seeded.

## Delivered source

| Area | Implemented behavior |
| --- | --- |
| Apps | Six stable apps; reviewed single installation with exact prices/setup/policy; optional services; shared/direct activation ownership; safe uninstall; persisted preferences/history |
| Finance | Real currency/period KPIs, cashflow, expense and receivables composition; canonical invoice and payment workflows; issued snapshots and exact second-person credit review |
| CRM | Canonical customers, tags, assignments, leads/opportunities, follow-ups/interactions, pipeline and permission-redacted financial activity |
| Inventory | Shared products/variants/units; warehouse/location setup; revision editing; immutable exact stock operations; reservations; partial dispatch; bounded returns; paired transfers; incoming plans and reviewed replenishment suggestions |
| Sales | Multiline quotations and canonical order draft revision editing; reviewed discounts; one conversion; confirmation reserves stock and prepares a canonical draft invoice under current policy authority |
| Analytics | Actual authorized source coverage and definitions; dates/currency; current statuses; private saved filters/widgets; matching CSV; paginated customer/order header drilldown |
| Automations | Existing durable version-bound engine; supported typed follow-up/replenishment actions; read-only preview; current authority, limits, bounded retries and scoped event receipts |
| Notifications | Persisted own center across all three kinds; unread/read-all/dismiss; paging/preferences; allowlisted resource actions; current approval state and bounded visible-page polling |
| Navigation/security | Contextual app navigation, scoped real search, initials/account menu; Personal simplified Finance/Analytics; Developer direct products/services; current role, membership, environment, API scope and service gates preserved |

App installation is free. New service creation and physical stock usage is committed atomically once, and durable retries return the original result at a hard cap. A new operation above the cap is rejected. Incoming plans/reservations are distinct from physical stock. No quotation/order/draft invoice counts as confirmed payment.

## Executed local validation

| Check | Result |
| --- | --- |
| Clean SQLite full suite | 298 discovered; 297 pass; one PG-only skip; zero failures |
| Fresh local PostgreSQL full suite | 298 pass; zero failures/skips |
| Focused cross-app suite | 21 pass on each engine |
| Frontend production build and content/chart/auth/retry checks | 40 pass |
| TypeScript and lint/architecture | Pass; 110 frontend modules |
| Workspace/legacy API contracts | 266/59 mounted operations validated |
| Development configuration / edge gateway | 3/5 pass |
| Isolated local chain and independent proof verification | Pass |

Log files are ignored local artifacts under .tmp/connected/apps-release-*. The overlapping PostgreSQL/build attempt was discarded and repeated serially in a fresh database; only the successful serial run is counted. Tests never target Neon.

## Visual evidence and blocked acceptance

Earlier connected desktop1440x1080/mobile390x844 Finance and CRM checks found and corrected padding inheritance and mobile cell layout. Existing docs/visual-qa/apps/*-in-progress.png captures are preliminary synthetic evidence, not final six-app acceptance. Final new controls, all-app journeys, keyboard behavior and Personal/Developer layouts still require actual browser review. Computer Use stopped because it could not safely identify the current browser URL; a separate Codex window text read was rejected due to unrelated private-chat exposure risk. Neither safeguard is bypassed. No final screenshots or physical-iPhone qualification are claimed.

## Deployment and preservation

Migrations010/011 are additive and not hosted. The --apps maintenance path is prepared with the exact approved development guard, authenticated encrypted backup/readback, transactional application and historical count checks; it has not been run against Neon and is not a full restore drill. Hosted startup remains verification-only. Existing Neon identities, workspace IDs, financial evidence, encryption keys, provider gates and Cloudflare/Render configuration are unchanged.

Before deployment: complete interactive/visual acceptance, execute the guarded development migration with readback, release backend then frontend, verify existing managed identity/workspaces and canonical data, check exact hosted source/asset hash and refresh this report with deployment IDs/screenshots. Current repository release rules prohibit deployment before these checks. Source can be committed/pushed without activating a hosted release because Render auto-deploy is disabled.

## Material limitations

Free Render sleep pauses background work; no unattended timing guarantee. No live funds, Daraja enablement, paid hosting, auth-provider migration, unsupported MFA/passkeys, external AI credit activation, arbitrary workflow code, automatic supplier order or automatic payment is introduced. Reference product costs do not establish verified inventory valuation. Browser emulation is not physical-device testing. Existing financial/provider and issuer/chain assurance limitations remain.
