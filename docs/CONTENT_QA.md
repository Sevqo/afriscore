# Content and chart QA — 2026-10-26

Audited the homepage, product/audience templates, developer documentation, learning navigation and operational metrics/trends against both briefs and three supplied screenshots. Rewrote the homepage and 23 guides; added 16 articles, 12 glossary terms, seven fictional stories, specific FAQs, workflows and related links. Company/legal notices retain their scope. Added four labelled local simulations, reconciliation/Passport help, seven original business scenes and 24 process diagrams. Replaced the vague workspace mockup with a labelled invoice/receipt/remainder flow and removed green card top rules.

## Executed checks

- SQLite: 194/194 tests, 21 suites, passed. Initial restricted-shell attempt could not reach local HTTP servers (EACCES); rerun with loopback access passed. Direct-route regression includes /learn and /learn/reconciliation.
- PostgreSQL 17: 194/194 passed on a new disposable local database; test cluster then stopped. GitHub CI exercises PostgreSQL 16.
- Backend typecheck/build and both OpenAPI checks passed: 59 legacy and 136 workspace operations.
- Isolated local EVM contract, signed credential, authorization, anchoring and independent verification checks passed.
- Website production build and 10 content/chart tests passed. Build prerenders 50 public pages. Tests verify internal destinations, guide completeness, distinct product/article metadata, valid dates/timezone, sparse date selection, negative/empty domains, range availability and pointer bounds.
- Browser visited 51 public link destinations (including anchor variants): one H1, no document overflow and no broken completed images. Five representative pages at eight requested widths (320, 375, 390, 430, 768, 1024, 1440, 1920) passed all 40 geometry samples. The embedded host rounds some dimensions by one pixel.
- Learning search returned one reconciliation article and an explicit empty state for an unmatched query. Matching showed partial remainder, overpayment review and wrong-reference review. Receipt-day keyboard control changed early receipt to a KSh 8,000 temporary gap for a late receipt. Unchecking disclosure claims removed them from the preview. Signature/status/issuer/evidence checks remained independent.
- Mobile chart keyboard inspection showed 2026-10-25: KSh 1,200 inflows, KSh 200 outflows, KSh 1,000 net. The 7D control selected October 20–26; legend toggle hid its series; pointer selection showed the exact date/tooltip. Desktop point inspection also passed. Neutral metric borders and original art were visually inspected. No demo reset or financial write was needed.

Local artifacts: .tmp/education-qa screenshots and responsive/routes JSON, plus .tmp/education-*.log. Scratch artifacts are intentionally untracked. The card screenshot includes viewport clipping; the social-commerce product screenshot shows the complete scene.

## Practical limits

Viewport emulation is not a physical touch-device, Safari or full assistive-technology audit. Geometry plus selected visual inspection is not a pixel-by-pixel review of every article. Charts cover loaded records only. Absolute production canonicals/sitemap require AFRICORE_SITE_URL. Legal policies, retention, issuer governance and future regulated/live integrations require qualified review. No production deployment, live provider transaction or certification is claimed. GitHub run outcome is reported separately after push.
