# AfriCore design system

Reviewed 2026-10-26. The platform uses a black, white and neutral editorial system with deliberate green accents, adapted from the proportions and navigation principles of NVIDIA's public website. AfriCore branding, content and original artwork remain its own. No proprietary fonts, imagery or source were copied. No reference screenshots accompanied the redesign attachment; comparisons used the live reference and written requirements.

## Shared source

`dashboard/shared/theme.css` is the canonical semantic token and locally hosted font source. Vite imports it through `website/src/tokens.css`; the legacy console imports it directly. `website/src/style.css` retains domain layout rules; `system.css` owns shared components, shells and responsive variants. Do not reintroduce competing shell rules in domain CSS.

| Purpose | Token/value |
| --- | --- |
| Primary action | accent #76B900, black text |
| Hover action | accent-hover #5A8D00, black text |
| Accessible accent text/focus | accent-text #426900 |
| Primary text/immersive background | ink #000000 |
| Operational text | text #1A1A1A |
| Secondary text | muted #666666 |
| Main surface | white #FFFFFF |
| Secondary surfaces | surface #F7F7F7, surface-alt #EEEEEE |
| Hairline border | line #D1D1D1 |
| Selected navigation | accent-light #EAF3DB |
| Success | #326600 on #EEF5E4 |
| Warning | #805700 on #FFF8E5 |
| Error | #A22B20 on #FFF0ED |

Green #76B900 is suitable for black button text and dark-background accents; use the darker accent-text for small links/icons on white. Status words remain visible; color alone never communicates payment or verification states.

Geometry: buttons 3px, inputs 5px, operational panels 6px, menus 6px, editorial cards 18px. Circles remain for meaningful status dots/illustration geometry. Spacing scale: 4/8/12/16/24/32/48/64px. Public gutters fluid 20–80px; mobile 20–24px. Compact workspace gutters 12–40px. Marketing sections use 56–80px vertical spacing; operational panels use 16–24px for daily work. Neutral hairlines replace decorative shadows; menu shadow is 0 8px 24px #00000014.

## Components

- Button variants: `.button`, `.secondary-button`, `.text-link`, `.icon-button`; explicit hover, disabled, active and focus states. Domain actions retain their existing submission handlers.
- `Icon.tsx`: currentColor SVG primitives, 20px standard, stroke 1.6. Decorative icons are hidden from assistive technology; icon-only controls need an accessible name. Ordinary navigation uses chevrons, never emoji arrows. Legacy console uses the equivalent shared SVG sprite.
- `Header`: one public menu dataset, sticky white header, desktop product columns, mobile category accordion, search, Escape and focus restoration. Public verification pages share it.
- `MediaBlock`/`FeatureSection`: typed replaceable image/video descriptors, alt text, image error fallback, focal point/crop support and stable ratio. `EditorialCard`: media, category, headline and supporting copy; 18px radius. `MediaCarousel`: native scrolling/snapping, previous/next buttons and arrow keys; no autoplay.
- `DataTable`: labels compact tables of up to five columns for mobile stacked records. Wider ledgers retain contained horizontal scrolling. Numeric cells align right and use tabular numerals. Financial values and source labels remain unchanged.
- `Overlay`/`useFocusScope`: contain focus, Escape, body scroll lock and return focus to the trigger. Native select/date controls remain available.
- Passport card: near-black, neutral hairline border, explicit assurance labels, white metadata. Financial metric cards also use neutral borders without decorative green top rules. Tabs use an underline rather than giant pills. No change to issuance, evidence, sharing or verification permissions.

Education components use readable HTML workflows, labelled fictional examples, native FAQ disclosures and local-only simulations. Shared charts use series labels, distinct line styles, exact readouts, pointer/touch selection, keyboard date exploration and data-table alternatives. See CHART_EXPERIENCE.md and CONTENT_STRATEGY.md. Preserve reduced-motion behavior and semantic heading order.

See TYPOGRAPHY.md, NAVIGATION.md, RESPONSIVE_DESIGN.md and VISUAL_QA.md for implementation and validation details.
