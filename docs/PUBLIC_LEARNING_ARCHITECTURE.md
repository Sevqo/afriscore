# Public learning and product education

Milestone 4 extends the existing React/Vite website, canonical service catalog, editorial system and Cloudflare gateway. The complete owner brief is retained in MILESTONE_4_PLAN.md. It supersedes the previous Milestone 4 hold. Capital and an installable-app marketplace remain deferred.

## Sources and authoring

src/marketplace/catalog.ts owns service IDs, names, kinds, dependencies, setup, availability and units. Public discovery imports it directly. website/src/education/guides.ts owns existing business explanations and workflow stories. serviceEducation.ts supplies specific editorial additions for seven services previously sent to broader guides; it does not duplicate authorization or pricing. discoveryPages.ts owns four audience recommendations and the Products/How It Works destinations. PUBLIC_PRODUCT_CAPABILITIES.md records the code audit and runtime qualification limits.

Learn.tsx retains the existing 16 articles, search, category filters, glossary and related content. learningPaths.ts defines four versioned paths and practical knowledge checks. LearningJourney.tsx renders their sequence, suggested next lesson and completion controls. Knowledge checks require the correct answer before completion; other lessons use explicit self-assessment. Progress stores only bounded lesson slugs/version in this browser profile, outside account/workspace data. The UI discloses shared-browser visibility, storage failure and clearing. No identity requirement or Neon migration was introduced. There is no cross-device or account-synchronized progress claim.

Every addition must have a unique route and metadata and resolve through prerender.tsx. The build renders 67 public routes, emits a public-path manifest for the gateway, sitemap/robots when the site origin is set, canonicals, social metadata and factual WebPage structured data. No invented review, price, licensing or organization credential is included. Unknown public pages and missing assets return 404 at the edge; authenticated/capability routes retain their SPA entry points and existing security controls.

## Isolated teaching interactions

ProductExperiences.tsx retains distinct payment, matching, cash movement, forecast, rule, relationship, privacy and evidence explanations. TeachingLabs.tsx adds an editable whole-KSh invoice/partial allocation exercise, source normalization/deduplication/failure/disconnect walkthrough, SHA-256 alteration check and genuine ephemeral browser ECDSA signing/verification/status example. ServiceExercise.tsx provides customer disclosure, order/fulfillment stages, manual income/expense totals, prewritten assistant responses and webhook handling examples. DeveloperTutorial.tsx keeps a verified request/empty-result example and adds local response scenarios; explanatory error text is not presented as an exact server payload.

These components do not import authenticated API clients, submit payments, send messages or issue production credentials. All business data is fictional. The public ECDSA key is generated in memory and not exported or persisted; its example is not the platform JOSE profile. The SHA-256 exercise is a hash comparison, not a claimed Merkle/on-chain check. Actual authenticated/local-chain implementations remain separate. AI teaching responses are prewritten; no provider call or financial data disclosure occurs.

## Activation handoff

Discovery links carry an allowlisted service ID and workspace intent into the existing /app entry. Current managed identity and memberships still resolve server-side. A visitor needing sign-in retains the query through the login/signup choices; verification links retain the service ID. Existing workspace selection carries eligible service context to Explore Services. An incompatible workspace does not inherit a service. Review, pricing and activation remain explicit server-authorized operations; no public teaching completion or CTA activates an entitlement.

## Visuals and performance

Use the shared black/white/neutral/green tokens, compact controls, native labels/fieldsets, visible status words, touch-sized controls and single-column mobile cards. The homepage retains its original product composition and adds a task-based finder. New learning panels have bounded gutters and a two-column path grid collapsing on mobile. Workspace, buyer and public trust bundles load at their route boundaries rather than in the public entry. Loading destinations show a status fallback.

Two new original AI-assisted editorial scenes are optimized as 1200×800 WebP assets (approximately 100 KiB each): contractor-invoice-v2 and supplier-selective-sharing-v2. Their provenance/briefs are recorded below; existing SVG illustrations/process diagrams remain. Important amounts, instructions and warnings stay in HTML. Images have dimensions, contextual alternatives and lazy loading.

## Illustration provenance and review

Generated using the built-in imagegen skill/tool on 29 October 2026, without competitor reference images or copied assets. The contractor brief requested an African independent contractor preparing an invoice in a workshop with building plans, natural anatomy, warm ivory/charcoal/olive/terracotta and original ink-style editorial artwork. The sharing brief requested a wholesaler sharing one selected page with a retailer while keeping other documents closed, in a dispatch setting, with the same palette and original composition. Both were visually inspected for coherent hands, proportions, narrative and unwanted text. They are conceptual fictional artwork, not customer portraits or evidence. The contractor image includes conceptual invoice/payment vignettes; HTML explains that these are separate events. Only two new scenes were generated; this is not a claim to have generated all 18 suggested illustration concepts.

## Reference and qualification boundaries

Layout reference: https://www.nvidia.com/ . Editorial quality reference: https://robinhood.com/ . No reference artwork/source was copied. Credential terminology: https://www.w3.org/TR/vc-data-model-2.0/ . Accessibility target: https://www.w3.org/TR/WCAG22/ . These references inform the work; they do not establish conformance, endorsement or certification.

Follow the existing CONTENT_STYLE_GUIDE, CONTENT_ACCURACY, CHART_EXPERIENCE and deployment/security runbooks. Preserve covered movement versus profit/bank balance, merchant imports versus provider proof, simulation versus live integration, and signatures versus factual truth. Always state the current model/provider, institutional, mailbox/device, legal and infrastructure gates accurately.
