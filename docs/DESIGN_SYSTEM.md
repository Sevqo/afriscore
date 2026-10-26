# Design system
Owner: AfriCore engineering/design. Reviewed: 2026-10-25.

NVIDIA-inspired editorial hierarchy, bold typography, dark heroes, white/light sections, spacious grids and restrained motion remain the foundation. All supplied SVGs/copy are original AfriCore assets. No proprietary NVIDIA/Robinhood artwork is copied. No reference screenshots or illustration image accompanied the pasted specifications.

Tokens in website/src/style.css: ink #101b16, accent #19a576, accent-light #b5f1d8, line #dfe7e1, surface #f3f6f3. Locally bundled DM Sans and Space Mono, fluid type, focus outlines, semantic forms/tables and loading/empty/error states. Breakpoints: 1150/850/560px. Operational shell uses denser spacing.

## Modular media
Media.tsx provides MediaBlock, HeroMedia, ProductShowcase, FeatureSection/MediaTextSection/EducationalSection, EditorialCard and MediaCarousel. Discriminated Media supports image/svg/screenshot with alt, mobileSrc, fit, position, background, transparency, ratio, eager and animation options; video supports poster/controls/playsInline/metadata preload. Containers own aspect ratio, independently of the source.

Descriptors live in content.ts; assets in public/media. Replace a descriptor src/kind/alt without changing section layout, typography, CTA or breakpoints. Use contain for transparent SVG/PNG/WebP and cover for photography. Never inline untrusted SVG. Hero loads eagerly; other images lazy load. Image failures show accessible fallbacks. picture supports mobile assets. Native videos require intentional playback. CSS motion respects prefers-reduced-motion; no animation dependency was added.

## Replacement test
/?media-test=svg replaces the workspace product screenshot descriptor with the original transparent reconciliation.svg, preserving the 24/17 ratio and FeatureSection composition. Verify at desktop and 390px mobile. Only centralized content configuration changes. Record observed checks in IMPLEMENTATION_STATUS.md.

## Historical Stage 1 extension notes (superseded below)
Future original art: flat vector scenes, confident outlines, expressive stylized people, clear silhouettes, limited coordinated colors, and recognizable African small-business environments. Robinhood general storytelling and the user-described illustration example are direction only; never duplicate characters/assets. Introduce scenes selectively for payments, invoicing, reconciliation and cash flow. Protected-payment stories retain future labels. Use existing typed media and optional CSS/SVG motion. No full character library is implemented now.

## Stage 2 editorial and workspace UI
See ILLUSTRATION_SYSTEM.md for ten original SVG scenes, typed route media and generator. Strong hierarchy, existing brand CTAs, whitespace and real UI evidence remain the public layout anchors. Stage 2 workspace views include source/assurance labels, chart tables, explicit empty/data-quality/error states and sandbox copy. Educational motion uses keyboard tabs and prefers-reduced-motion. Fulfillment uses order line quantity controls; raw backend IDs remain in advanced approval/link workflows and need further UX refinement. Modal focus trapping and a full assistive-technology audit remain open.

## Stage 3 Passport and verification UI
Existing typography/core brand tokens/media architecture remain. Passport adds a restrained dark identity card, precise assurance labels, responsive section navigation, minimal-claim previews, recipient/purpose controls and separate verification checks. Public /verify-credential and opted-in /passport/:id pages share existing branding. Seven original scenes extend the SVG generator: passport, credential-issuance, trust-network, privacy, verification, anchoring and credibility (17 total).

No coin/token-price aesthetics or decorative financial dashboards. Mobile tabs scroll within their container and long IDs wrap. Backend-ID entry remains an advanced sandbox UX limitation; broader business discovery/issuer directory and full assistive-technology audit remain future work.
