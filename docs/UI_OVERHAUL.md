# UI overhaul audit and plan

Baseline: main ce02584, 2026-10-26. Reviewed the public route map, BusinessApp, Stage 2/3 workspaces, developer/internal views, shared media, fonts and all global styles. Browser baseline reviewed on the public homepage and Intelligence workspace. Reference: live nvidia.com/en-us; no reference screenshot files accompanied this attachment.

Observed issues: relative public header; teal/forest palette; Unicode diagonal arrows; 84px desktop header; 27 ungrouped workspace destinations; horizontally scrolling mobile workspace tabs; small operational labels; unrelated Sora font loaded; giant pill Passport tabs; gradient credential card; editorial carousel lacks manual controls; record overlay lacks focus containment.

Implementation checklist:
- [x] Shared semantic palette, fluid type, spacing, geometry, motion and focus tokens.
- [x] Central SVG icons; remove decorative Unicode arrows.
- [x] Sticky public header, shared menu data, single-category accordion, Escape/focus/scroll handling.
- [x] Large black hero with original AfriCore media, quick links and editorial cards/carousel controls.
- [x] Apply system to every public route and auth/checkout/buyer/verification surface.
- [x] Grouped workspace navigation and contained mobile drawer; preserve all destinations and role checks.
- [x] Compact financial panels, controls, tables, charts and Passport/developer/engineering views.
- [x] Responsive browser QA at 320/375/390/430/768/1024/1440/1920, screenshots and functional checks.
- [x] Update design documentation and record observed limits.

## Implementation result

Implemented the shared neutral/green theme, self-hosted DM Sans/Space Mono, centralized SVG icons, consistent component geometry and focus states. Public navigation is sticky with desktop product columns, mobile accordion and local page search. Rebuilt the homepage's black hero using original scalable AfriCore artwork; added quick links and controlled editorial cards/carousel. All configured product/solution/company/resource/developer routes share the public system. Verification, auth, buyer and checkout surfaces consume the same primitives.

BusinessApp now has six navigation groups and an accessible mobile drawer, section history, compact operational type/panels, mobile record tables and unified overlays. Stage 2/3, developer and internal views retain their data/permissions and adopt the same visual system. Original illustrations and the editable generator were recolored together. The older console now consumes the canonical theme and receives an appropriate same-origin resource policy; API responses keep their restrictive policy.

All audit checklist items above have been implemented and checked within the coverage documented in VISUAL_QA.md. Remaining qualification limits are listed there explicitly. This is a visual/interaction overhaul, with two necessary existing-rendering fixes (demo profile format and legacy console asset policy), no migrations or user-data reset.

## Changed file groups

- Shared system: dashboard/shared/theme.css, fonts/licenses and icon sprite; website/src/tokens.css, system.css, style.css, main.tsx.
- Shared React components: Icon, Overlay, useFocusScope, DataTable and Media.
- Public pages/navigation: App.tsx, navigation.ts, content.ts, TrustPublic.tsx; original hero and recolored media/editorial assets.
- Operational surfaces: BusinessApp, Stage2Workspace, IntelligenceViews, WorkflowViews, CommerceViews, UI and PassportWorkspace.
- Legacy console: dashboard/index.html and style.css; src/app.ts and business-decision.test.ts for narrowly scoped asset-policy regression coverage.
- Cleanup: removed old unused hero artwork and Sora dependency; removed superseded shell styles and replaced decorative glyph arrows in markup.
- Documentation: DESIGN_SYSTEM, TYPOGRAPHY, NAVIGATION, RESPONSIVE_DESIGN, VISUAL_QA, ILLUSTRATION_SYSTEM, IMPLEMENTATION_STATUS and AGENTS.

See VISUAL_QA.md for test results, captured artifacts, accessibility checks and remaining visual/device qualification. No standalone lint runner exists in the project.
