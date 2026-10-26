# Visual QA — 2026-10-26

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
