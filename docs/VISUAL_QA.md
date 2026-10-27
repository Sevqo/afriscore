# Visual QA — 2026-10-26

## Product-experience refinement (latest)

Baseline hero captured before edits: requested 390 px width 1288.7 px tall; 1440 px width 858.6 px. Final:619.9 px and 470 px (~52%/~45% reduction). All seven requested widths 320/375/390/430/768/1024/1440 pass document-overflow checks; content stays unclipped and sticky navigation remains. Actual synthetic workspace/checkout captures form a non-human product composition. The detailed invoice flow remains below the hero. Main-content links are 14 instead of 30.

Sixteen distinct major product pages at 320/1440 (32 checks) have one H 1, expected experience, no overflow or broken completed images. Browser interactions passed: second receipt closes the illustrative invoice; duplicate receipt remains ignored; payment failure explanation; conservative collections 162, 500; overdue automation follow-up; disputed relationship review. Existing art, learning pages, shared menu and chart controls remain.

Connected isolated browser: owner sign-in, customer/order/invoice/checkout journey, delayed pending then paid/matched result, refresh persistence, responsive customer correction, all 26 mobile workspace sections and 25 desktop sections reviewed. Engineering correctly denies an ordinary owner; allowlisted operator access and organization switch succeeded. These are render/selected-journey observations, not an assertion that every button was manually clicked. Backend suites supply additional mutation/failure evidence.

Artifacts: .tmp/product-audit/hero-before-390.png, hero-before-1440.png, hero-after-390.png, hero-after-1440.png, hero-final.json, product-checks.json, connected-modules-mobile.json, connected-modules-desktop.json, connected-checkout-paid.png, operator-engineering.png and interactions.json. Device emulation is not physical-device/Safari or full assistive-technology qualification. Screenshot host sometimes requires a 1 px repaint; actual measurements are recorded separately.




## Observed browser checks

Used the in-app browser's Playwright and screenshot interfaces against the built website at 127.0.0.1:4173. Reviewed the existing homepage and Intelligence workspace before implementation, and the live NVIDIA reference. This is a substantial reference-inspired adaptation, not a pixel-perfect reproduction; the attachment supplied no reference screenshot files.

| Coverage | Result |
| --- | --- |
| Homepage at requested 320/375/390/430/768/1024/1440/1920px widths | No document overflow; content-safe hero, 720–820px desktop/tablet treatment after refinement |
| Overview at all eight widths | No document overflow; amounts stay readable, single-column metrics on smallest phones |
| 33 public routes at 320 and 1440px | 66 render/heading/overflow checks pass |
| All 26 workspace sections at 320 and 1440px | 52 render checks pass, no document overflow; Engineering correctly retains its backend/allowlist gate |
| Public menu | Plain monochrome SVG controls, grouped products, contained scrolling, Escape and trigger focus restoration |
| Business drawer | Dialog label, focus containment, scrim, Escape and trigger focus restoration |
| Record overlay | Escape closes and returns focus to the original record button |
| Section history | Orders → Invoices → browser Back restores Orders |
| Public search | Passport query returns real matching destinations; Escape returns focus to Search |
| Editorial carousel | Next changes scroll position and enables Previous; keyboard arrows/native touch scrolling supported |
| Sticky header | Top remains 0 after scrolling ~4600px to the carousel |
| Console /dashboard/ | Actual browser rendering verified through isolated local server 4180; self-hosted fonts, sticky header, desktop/mobile geometry and no arrow emojis |
| Verification, Passport, Trust Network, developer tools | Forms/labels/assurance and gated states reviewed; original authorization remains |

This host rounds some 320/375px overrides to 321/376 CSS pixels. Saved browser captures sometimes need a 1px viewport refresh to avoid a host capture failure; artifacts record the resulting desktop/mobile view. Browser screenshots were visually inspected, not inferred from CSS alone.

## Artifacts

Local, ignored artifacts: `.tmp/ui-qa/`. Includes `checks.json`, desktop/mobile home, mobile navigation/products, quick links, editorial carousel, public Passport, verification, sign-in, workspace navigation, overview, Orders, Invoices, Payments, Intelligence, Business Passport, Business Network, developer tools, record overlay and console screenshots. These contain only the existing synthetic browser demo or public UI. Do not commit session databases or setup secrets.

## Accessibility and functional verification

Primary black-on-green contrast 8.71:1; hover black-on-#5A8D00 5.25:1; muted #666 on white 5.74:1; accent-text #426900 on white 6.46:1; warning text/background 6.04:1. Green is not used as small text on white. Controls retain visible focus, labels, source descriptions, status words, semantic forms and tables, accessible dialog names, and reduced-motion CSS. Native input/select/date controls remain. Compact tables retain headings and receive mobile cell labels. Decorative icons have aria-hidden; icon-only controls have names.

Browser QA found and corrected a pre-existing demo Settings crash (flat demo profile vs serialized API profile), Transactions CSV-example overflow, amount wrapping, early autofocus interfering with modal trigger restoration, and the legacy console inheriting an asset-blocking API CSP. The console now allows only required same-origin resources; regression assertions preserve the stricter API policy. No financial, trust or permission logic was removed.

Final local checks: 194/194 SQLite tests, 194/194 PostgreSQL 17 tests on a fresh disposable database, root TypeScript check, website TypeScript/production build, both OpenAPI validators, local EVM/contract/credential/independent verification. No lint script is configured; no lint pass is claimed. Build output: about 48.8 KB CSS (10.6 KB gzip), 442.8 KB JS (128.4 KB gzip). Removed unused Sora loading/dependency and external font requests; no new runtime dependency.

## Limits

Desktop/mobile viewport emulation does not establish actual Safari iOS/Android device compatibility. Full screen-reader, axe, WCAG conformance, Lighthouse/Core Web Vitals and cross-browser qualification remain unperformed. Engineering's authenticated content was not accessed through the database-free demo; its existing gate was verified. Trust pages retain sandbox limitations, advanced backend-ID workflows and truthful issuer/evidence distinctions. No public deployment or operational partner integration is implied by this visual change.

## Account experience visual review — 2026-10-27

New chooser, Personal, Developer, all three onboarding forms, account settings, login and three signup pages were checked at requested 320/375/390/430/768/1024/1440 widths: 77 route/width observations, no document overflow. Host may report 321/376 CSS pixels for the two narrowest requested sizes. Existing Business overview/switching was checked at desktop width. Account page titles identify Personal/Developer rather than labelling every screen Business. The optional managed SDK loads on demand.

Synthetic browser fixture: returning login resolved Personal, client creation and invoice issue persisted, income/expense entry produced the labelled 1,000/250/750/1,250 KES summary, Developer application creation worked, and all-workspace switching preserved the existing Business shell. Forms use native labels/controls and shared tokens/tables; mobile navigation scrolls horizontally. Source/empty/loading/denied states are explicit. Financial cards use a placeholder while loading rather than claiming zero before data arrives.

Evidence is ignored under .tmp/neon: account-responsive.json, personal-390.png, personal-1440.png, developer-desktop.png and managed-auth-enabled.png. Browser data is a separate SQLite fixture; actual managed Neon persistence and signature/revocation checks were exercised independently over HTTP. Mailbox delivery, physical Safari/device tests, full screen-reader audit and live outbound receiver qualification remain unexecuted.
