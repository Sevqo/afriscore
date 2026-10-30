# AfriCore Apps Wave 1 — deployed evaluation release

30 October 2026, Africa/Nairobi. The six apps are deployed on the existing evaluation hosts. Final interactive visual QA was explicitly waived by the owner; the qualification limits below remain. The approved Finance image is the visual reference; none of its fictional amounts, identity, avatar, plan or later apps is seeded.

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

## Deployment and hosted verification

Application source 8ccd42e48e3300b52254a9f2ba1d8ca3c2cd6000 is pushed to main with the requested cypriankiprop41@gmail.com author. [CI41026579619](https://github.com/Sevqo/afriscore/actions/runs/41026579619) succeeded; the preceding3932498 release also passed CI41021131631. The owner manually deployed the existing Render Free service srv-dbgcrl6c6qcc73f1hi50 and confirmed8ccd42e Live. The new authenticated endpoints independently returned the expected catalogs and policies. A Render deployment ID was not available from this session.

Cloudflare Worker africore-web is published as 29e6ed7d-0300-4444-85f9-e4056c192563 at https://africore-web.cypriankiprop41.workers.dev. The frontend was built with the production public origin. All67 public paths returned200 with expected titles and production canonical URLs; four missing routes/assets correctly returned404. The application shell returned200 and main/Business/account asset SHA256 hashes matched the exact build. Evidence: [hosted-public.json](evidence/apps-wave-1/hosted-public.json).

The approved existing synthetic managed identity resolved all three workspace kinds. Business returned Finance/CRM/Inventory/Sales/Analytics/Automations; Personal returned Finance/Analytics; Developer business-app access returned403. Notification preferences/center and canonical financial summaries returned200 across all three. Business informed installation preview returned200 without installing anything. Anonymous account access remained401 and direct backend access403. No hosted financial write or real funds were used. Evidence: [hosted-acceptance.json](evidence/apps-wave-1/hosted-acceptance.json).

Migrations010/011 were applied only to the guarded approved Neon development branch after an authenticated encrypted backup and decryption/readback verification. Original rows in users, workspaces, memberships, identity links, organizations, records, events, allocations and journal were compared unchanged. Existing8users/10workspaces/10memberships/4identity links are preserved. No identity merge, provider migration, encryption-key change, production-branch change or financial evidence rewrite occurred. This was not a full restore drill. Evidence: [preservation.json](evidence/apps-wave-1/preservation.json).

The first Render attempt failed because Docker's website stage lacked the deployment manifest directory. Prerender now creates that generated output directory. An isolated copy of the Docker website inputs with deploy absent successfully built, prerendered67pages and passed40checks. The corrected hosted build subsequently became Live. Local Docker itself was unavailable; input-isolation validation is distinguished from the owner's actual hosted build result.

## Access and independent services

Refresh the live site, select a Business workspace and choose Apps. Each app starts with an informed installation review; free installation does not bypass eligible service activation, prices, limits or setup. Existing workspaces are not automatically installed. Personal offers the simplified Finance/Analytics pair. Developer keeps direct service/API entry rather than business apps. Existing direct services and shared/direct activation ownership remain independent of app installation.

## Visual qualification and remaining limits

Earlier connected desktop1440x1080/mobile390x844 Finance/CRM checks found and fixed spacing and mobile-cell defects. Existing [in-progress captures](visual-qa/apps) are preliminary synthetic evidence, not final before/after coverage for all six apps. Computer Use could not safely verify the browser URL; the owner explicitly approved deploying with final interactive visual QA unverified. No fresh final screenshots, physical-iPhone/Safari, full keyboard/screen-reader or founder-entered login/mailbox acceptance is claimed.

Free Render sleep pauses background jobs; notifications/reminders have no unattended timing guarantee. No live funds, Daraja activation, paid hosting, unsupported MFA/passkeys, auth migration, AI credit activation, arbitrary workflow code, automatic supplier order or automatic payment is introduced. Existing external provider and issuer/chain assurance limitations remain. Reference costs do not establish verified stock valuation. Tests and hosted read-only probes do not qualify those external capabilities.

Disposable local QA and PostgreSQL services were stopped. The complete original master and later milestone plans remain retained.
