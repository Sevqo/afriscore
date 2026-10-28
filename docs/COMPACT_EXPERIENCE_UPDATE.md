# Compact interface and service education

Updated 28 October 2026. This change implements the requested second density pass across the public website and authenticated application.

## Size and spacing

Display and section heading tokens are 80% of the preceding values. Shared spacing tokens are 75% of their preceding values. Public component styles, education pages, account setup and operational panels follow the same reduction. Controls use approximately 35px heights and smaller padding; editable field text remains 16px to avoid automatic zoom on mobile browsers. Responsive wrapping and readable amounts take precedence over a rigid percentage.

Date range controls retain separate grid cells and action gaps. Forecast assumptions appear when Custom is selected, and the calculation action is separated from the final input. Workspace setup uses three consistent type selectors, content-sized rows and compact field gaps.

Personal and Developer workspaces retain their desktop sidebar. On mobile, a menu button opens a vertical sidebar through the existing focus-scoped Overlay component, with backdrop dismissal and Escape support.

## Service explanations and artwork

`website/src/education/ServiceExplainer.tsx` adds distinct plain-language explanations for 17 service topics, including purpose, workflow, evidence boundaries and current availability. Payment requests remain separate from confirmed money; verification and signatures do not guarantee a claim is true. Passport privacy explains disclosure and the limits of revocation.

Each of the 23 guide routes has a dedicated numbered SVG workflow in `website/public/media/explainers/`. These are original code-authored vector diagrams, derived from that guide's existing steps and outcome. No external image source, image-generation prompt or third-party artwork was used. Each SVG includes a title and descriptive text; its containing media supplies contextual alternative text. The full HTML steps remain available outside the image.

## Verification and release state

The production website build prerenders 50 routes. The content regression suite checks every guide's diagram file and inclusion in its rendered page. Local mobile browser review covered the Personal menu and Reports, workspace chooser, and Trust Network explanation and image. Saved evidence is in the ignored `.tmp/security/` directory. This is desktop browser emulation, not physical iPhone acceptance.

These changes are local until the pending security release is validated and deployed. They do not change authentication providers, financial records, workspace permissions or password minimums.
