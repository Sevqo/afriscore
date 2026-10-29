# Milestone 4 implementation and release report

## Delivered software

The existing AfriCore website now includes guided learning, catalog-backed service discovery, focused explanations and additional isolated exercises. This is an extension of the established website and Service Marketplace, not a new app platform. The complete request is MILESTONE_4_PLAN.md; architecture/authoring/provenance are in PUBLIC_LEARNING_ARCHITECTURE.md and the service matrix is PUBLIC_PRODUCT_CAPABILITIES.md.

The public route inventory grows from 50 to 67 prerendered pages. New destinations are /products, /how-it-works; /products/customers, /products/orders, /products/income, /products/expenses, /products/fulfillment, /products/assistant, /products/webhooks; /solutions/freelancers, /solutions/retail, /solutions/suppliers, /solutions/service-businesses; and four /learn paths (freelancer-starter, small-shop-starter, business-trust-starter, developer-starter). Existing product, solution, developer, pricing, company and learning routes remain.

Navigation and search include the new product/audience destinations. Products stay grouped rather than becoming top-level navigation items. Homepage discovery asks for a task and workspace, then shows eligible optional services with actual catalog availability, dependency names, setup, usage units and evaluation pricing language. Personal API recommendations correctly return an empty state. Developer API recommendations return its three eligible services. Capital remains deferred.

## Product education and examples

| Service area | Education and actual exercise |
| --- | --- |
| Customers | Expand a fictional customer into contact, order, issued invoice, allocated receipt and remainder |
| Orders / Fulfillment | Inspect agreement, payment, fulfillment and delivery as separate stages; no courier claim |
| Invoicing | Add example line items, edit quantities/whole-KSh prices, preview and inspect a simulated partial allocation; KSh 50,000 − 30,000 = 20,000 |
| Income / Expenses | Edit a fictional manual entry and review covered totals/category components; no provider confirmation claim |
| Cash Flow / Reports | Retained responsive recorded-movement chart, range/series inspection, table alternatives and obligation/scenario distinctions |
| Pay | Retained isolated requested/processing/confirmed/failed/reconciled journey; no live collection claim |
| Reconciliation | Retained two-receipt matching with duplicate/reference/amount/currency exceptions; no funds movement |
| Intelligence / Forecasts | Retained historical examples and explicit assumption scenarios/data-coverage warnings; no guaranteed balance or fabricated forecast validation |
| Assistant | New question buttons with disclosed prewritten fictional answers, evidence explanation and read-only/provider-credit limits |
| Automations | Retained supported trigger/condition/action rule example with reminders/history/authority limits |
| Connect / Data | New permission/source-format/normalization/duplicate/failure/disconnect exercise with stable fictional reference and merchant provenance |
| Verification / Passport / Privacy | Retained evidence/reviewer/assurance and selected-disclosure explanations; no upload-as-authenticity or recipient-copy-erasure claim |
| Credentials | New genuine ephemeral ECDSA exercise: sign, verify, revoke example status, alter and fail signature verification; issuer authority is separate |
| Trust Network | Retained independent bilateral relationship states and correction/assurance explanation, without a creditworthiness score |
| Blockchain | New genuine SHA-256 match/tamper exercise alongside existing commitment/Merkle/local-chain explanation; public hash demo is not advertised as an on-chain transaction |
| Protected Payments | Retained buyer/seller agreement, evidence, review and simulated partner outcome distinctions; no live custody/escrow guarantee |
| Developer APIs / Verification APIs / Webhooks | Verified request/empty-result example, local outcome scenarios, signing/retry/idempotency/environment explanations and links to actual OpenAPI/authorized tooling |

Each new service page reads its name, kinds, setup, workflow, dependencies and usage unit from the catalog and adds product-specific inputs, realistic example, expected result, limits and activation review. Broader existing pages remain the destinations for related capabilities as recorded in the matrix. Formal public trust-assessment education remains within verification/Passport/network explanations rather than claiming an independently certified assessment product.

## Learn and illustrations

Four paths organize existing articles into practical sequences. Lessons add knowledge checks or explicit self-assessment, completion/unfinished controls, suggested next lesson and related path links. Progress is versioned, bounded and browser-local, with explicit shared-browser/storage failure/clear behavior. No account-scoped or cross-device persistence is claimed. Existing search/category/empty states, glossary and related guides remain.

Two new original editorial scenes were generated, visually reviewed, optimized to approximately 100 KiB WebP each and assigned to Invoicing and Credentials. Existing original vector scenes and diagrams are retained. Contextual alternatives, explicit dimensions, lazy loading and meaningful HTML accompany the art. Eighteen newly generated scenes are not claimed.

## Activation, accessibility, SEO and performance

Selected service context survives public discovery, existing identity resolution and eligible workspace selection into Explore Services. Sign-in/signup/verification navigation preserves the allowlisted service. No entitlement activates from a public CTA or lesson. Existing price versions, permissions, identities, financial records and Neon configuration remain intact; this milestone has no database migration.

Native labels, fieldsets/radios, keyboard controls, visible status messages, touch floors, responsive panels and existing focus/reduced-motion rules are preserved. This is practical accessibility work, not a full WCAG certification. All pages are prerendered with unique metadata, canonical/social URLs, factual WebPage structured data and a sitemap using the existing hosted origin. A generated public-path manifest makes unknown edge pages and missing assets return 404 without changing authenticated capability/API fences.

Route splitting reduced the main public entry from approximately 524 kB / 146 kB gzip to approximately 279 kB / 83 kB gzip in the measured builds. Exact final assets may differ slightly after content edits. Workspace, buyer and public trust code load on their destinations. This is a bundle measurement, not a measured field Core Web Vitals/Safari/slow-network acceptance result.

## Executed verification

- Fresh local PostgreSQL: 272 passed, zero failures.
- SQLite: 271 passed, one PostgreSQL-only skip, zero failures (272 total).
- Frontend production/content: 37 passed; 67 prerendered routes. Catalog education destinations, lesson/path routes, metadata and internal links are checked.
- TypeScript, ESLint/architecture and both API inventories passed (59 legacy, 210 workspace operations). Isolated local contract/credential/authorization/anchor/independent-verifier checks passed.
- Browser: correct invoice preview/remainder; lesson completion retained across navigation; service finder incompatible/eligible states; signed-in synthetic user reached existing Business Explore Services with service=invoicing; genuine SHA-256 unchanged/altered results; genuine ECDSA valid, revoked-with-valid-signature and altered-invalid results.
- Responsive: six representative routes at eight requested widths (320/360/375/390/430/768/1024/1440), 48 samples with one H1, no horizontal document overflow or broken loaded image. Host viewport rounding is recorded in responsive.json.
- Hosted managed identity read Personal/Business/Developer financial summaries (200), Business conversations/Data/alerts/forecast evaluations/trust assessment (200), Developer Data (200), health/readiness (200). Personal/Developer Assistant read returned expected 402 for inactive selections; these were preserved. Daraja remained disabled. No financial write or provider AI request occurred.

Early failures were diagnostic rather than hidden: restricted loopback EACCES required an approved local-network rerun; an overlapping root rebuild removed test modules and was corrected with an isolated completed-build rerun; a lab initially had an unused import until mounted; the browser initially observed a route loading fallback during local rebuild. Final passing checks supersede these attempts. Desktop viewport emulation does not qualify physical touch devices, Safari, full screen-reader behavior, real mailbox receipt or every new-account/provider journey.

Screenshots and sanitized evidence are in docs/evidence/public-learning. No pre-change Milestone 4 screenshot was captured; historical public-site evidence is in existing visual/content reports. Synthetic identity/application screenshots are not founder-account acceptance.

## Deployment

Source release 4cc59a4ac76a1e567b45d673cc4c8c8384494040 is pushed to main, authored as Cyprian Kiprop <cypriankiprop41@gmail.com>. [CI run 40907702589](https://github.com/Sevqo/afriscore/actions/runs/40907702589) completed successfully. Cloudflare Worker africore-web is published as version 81d4fce6-77c0-4994-b131-2c2b5ea7ce7d at https://africore-web.cypriankiprop41.workers.dev . All 67 public paths returned 200 with expected title and canonical; four unknown-page/asset checks returned 404. Published entry /assets/index-BE7rxfbb.js matches the local build exactly (SHA-256 ee710ea90d5374e6fe10d6ef5f4ade08cbe42e09ed9912bfa1e7e5a3f924896b). Final entry size is 279.09 kB / 82.97 kB gzip. Five edge tests passed, including public 404 behavior; the deployment dry run also passed.

Hosted managed-access checks were repeated successfully after publication. The actual published Learn page was opened and captured at desktop/mobile widths; no browser runtime errors were observed. See [live desktop](evidence/public-learning/learn-live-desktop.jpg), [live mobile](evidence/public-learning/learn-live-mobile.jpg), [public route/asset checks](evidence/public-learning/hosted-public.json), [managed-access checks](evidence/public-learning/hosted-smoke.json) and [responsive samples](evidence/public-learning/responsive.json).

Backend APIs remain on the verified live Milestone 3 release c3b1078; public/UI/gateway changes require no Neon migration. Publishing this build also resolves the earlier Milestone 3 frontend publication hold. The approval-review availability failure is historical; no paid plan or secret change was needed. The final evidence commit is documentation-only and does not change deployed assets.

## Remaining qualification

Live AI output remains blocked by provider_credit_exhausted. Live financial/institutional connectors, approved issuers, production signing/anchoring, external mailbox/physical-device, full assistive-technology and independent security/legal qualification retain their prior gates. No full LMS, cross-device progress, real-money exercise, Capital or future installable-app marketplace was introduced. Public cryptography examples teach real primitives but do not reproduce a complete wallet/issuer/chain deployment. New examples and retained walkthroughs should continue through broader user comprehension and accessibility review.
