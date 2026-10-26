# Responsive design

Reviewed 2026-10-26. Breakpoints are centralized by component in system.css: 1600px large desktop; 1150px compact navigation/metric grid; 1024px public menu and business drawer; 767px single-column editorial layouts; 560px stacked compact data tables; 374px single-column metrics. Domain-specific line-item and commerce breakpoints remain where needed.

Public heroes use a content-safe grid, 650–820px desktop minimum treatment, fluid heading and original scalable vector media. Mobile stacks text and substantial media without fixed clipping; narrow content may exceed the initial viewport to preserve readability. Hero media has a desktop max-height to prevent oversized ultrawide layouts. Cards use 86% mobile width for a visible next-card preview, 2 cards at tablet and 3 at desktop, with 24px gaps and scroll snapping. No autoplay.

Business layouts favor operational density. Tables with <=5 headings become labelled stacked records on small phones; wide ledgers scroll inside their container. Forms collapse to one column, actions wrap, source/assurance labels remain, and identifiers/CSV examples wrap. Native date/select controls are retained. Navigation/overlays account for safe-area insets and reduced motion.

Required review widths: 320, 375, 390, 430, 768, 1024, 1440, 1920px. Browser viewport emulation can round 320/375 to 321/376 CSS pixels on this host; record requested and measured values in artifacts. Desktop/mobile emulation does not establish actual Safari iOS compatibility. See VISUAL_QA.md for observed checks and limits.
