# Typography

Reviewed 2026-10-26. DM Sans Variable is the single interface/display family. Its clean open-source sans-serif shapes support the requested editorial hierarchy while retaining AfriCore identity. Space Mono is reserved for code and technical identifiers. Both are self-hosted WOFF2 with swap loading; licenses are retained beside the assets in dashboard/shared/fonts. Removed the unrelated Sora import and external Google Fonts requests from the legacy console. No NVIDIA proprietary font files are used.

Display: clamp(38px, 4.6vw, 68px); 36px at the narrowest mobile width. Hero desktop line-height 1.06. Section: clamp(30px, 3.2vw, 48px). Editorial cards 24–25px, body 16–18px, supporting content 13–16px. Operational titles 28–32px, panel headings 19–20px, body/forms/tables 14–16px. Heading weight 700, tracking around -0.035em. Uppercase is reserved for short section/context labels. Numbers use tabular figures; mobile amount cards reduce type or stack instead of splitting digits.

Browsers fall back to Arial/sans-serif while fonts load. Form inputs use 16px text to avoid unwanted mobile zoom. Long identifiers, CSV header examples and technical metadata wrap or scroll within their own container.
