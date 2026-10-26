# Responsive design

Reviewed 2026-10-26. Breakpoints are centralized by component in system.css: 1600px large desktop; 1150px compact navigation/metric grid; 1024px public menu and business drawer; 767px single-column editorial layouts; 560px stacked compact data tables; 374px single-column metrics. Domain-specific line-item and commerce breakpoints remain where needed.

The compact homepage hero overrides the earlier tall minimum with a content-driven grid, max 600 px device composition, 28–38 px top padding and no fixed clipping height. Requested 390 px measures about 620 px; desktop 1440 about 470 px. Mobile stacks copy/CTA/media; desktop balances two columns. Product heroes retain their separate treatment. See HOMEPAGE_REFINEMENT.md. Cards use 86% mobile width for a next-card preview, 2 cards at tablet and 3 at desktop, 24 px gaps and scroll snapping. No autoplay.

Business layouts favor operational density. Tables with <=5 headings become labelled stacked records on small phones; wide ledgers scroll inside their container. Forms collapse to one column, actions wrap, source/assurance labels remain, and identifiers/CSV examples wrap. Native date/select controls are retained. Navigation/overlays account for safe-area insets and reduced motion.

Required review widths: 320, 375, 390, 430, 768, 1024, 1440, 1920px. Browser viewport emulation can round 320/375 to 321/376 CSS pixels on this host; record requested and measured values in artifacts. Desktop/mobile emulation does not establish actual Safari iOS compatibility. See VISUAL_QA.md for observed checks and limits.
