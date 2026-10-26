# Navigation

Reviewed 2026-10-26. `website/src/navigation.ts` owns public destinations for desktop, mobile, footer and search. Product navigation groups everyday operations, intelligence/connectivity and business trust. Other categories: Solutions, Developers, Resources, Company and Support. Existing destinations remain reachable.

The public header is sticky at top:0 with a solid white background, 68px desktop / 60px at <=1024px, safe-area inset and a 100 stacking layer. Root ancestry has no clipping overflow. HTML scroll padding offsets anchor navigation. Dropdowns close on outside click or Escape. Mobile uses buttons with aria-expanded and aria-controls, one open category, plain text destinations, internal scroll containment and a full-height white panel. Focus is contained while open, Escape closes it, and the trigger regains focus. Search filters actual route names without sending queries externally. No search backend is claimed.

Business navigation has six groups: Workspace; Finance & intelligence; Operations; Business trust; Build & connect; Administration. All 26 original destinations remain. Desktop sidebar groups use native disclosures and the active destination opens its group. <=1024px uses a modal drawer with scrim, close control, Escape, focus containment and body scroll lock. Destination changes close the drawer. Existing backend role checks remain authoritative. Section hashes support direct links, refresh and browser back/forward. Public verification uses the same Header; checkout and buyer views retain focused task navigation.

Never add Unicode/emoji diagonal arrows. Use the shared currentColor SVG Icon. Ordinary destinations do not need external-link symbols.
