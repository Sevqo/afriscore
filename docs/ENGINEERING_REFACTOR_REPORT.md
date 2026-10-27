# Engineering repair and refactor report

2026-10-27. Scope: repair the supplied login/import/mobile screenshots, semantic source organization, managed request reliability, LAN tooling, product review and original illustration expansion. Baseline main was 6624b2c and the checkout was clean. This report distinguishes implemented code and executed tests from remaining device/provider acceptance.

## Error repairs

Both initial TypeScript projects passed; the installed facade exposed the screenshot's imports. The IDE-specific red underline was not reproduced as a compiler error. Replaced the unnecessary facade dependency with directly declared @neondatabase/auth 0.7.0-beta, the same implementation already nested beneath it, inferred the client type from its real factory, and provided a tracked VS Code workspace. Concurrent client initialization is deduplicated and a failed attempt can retry. No ts-ignore/any workaround was introduced in the auth adapter.

Concrete defects corrected: worker import before environment loading; unmatched homepage CTA class; Vite denying shared font files; old-password sign-in minimum; missing visibility control and mixed login/demo links; operations/Passport and CSV requests lacking managed identity; account/entry/education import cycles; stale renamed compiled tests; checked-out PostgreSQL disconnect becoming an unhandled client event; launcher reusing another API/environment. The final build now clears only its resolved dist directory.

## Authentication and account UX

AuthPage and PasswordInput are separate from BusinessApp. Sign-in has email/password, an accessible show/hide button, nearby recovery, one primary action, signup and a footer. Verification is offered in the relevant workflow. Existing credential entry is not subjected to the new-password minimum. Local new/reset secrets have server-enforced 15–200-character validation and a bounded common-password blocklist; managed provider server policy remains independently qualified as explained in PASSWORD_SECURITY.

One non-fixture verified identity was observed on the existing Neon development branch without reading/changing its password. No identity remapping, duplication, reset, email merge or production change was made. The founder's original password has not been entered by the agent. An existing synthetic provider session restored, resolved Personal/Business/Developer memberships and successfully read intelligence, automations, Passport and CSV through the paired preview. That proves the repaired authenticated backend path; it is not proof of physical iPhone login or mailbox delivery.

## Repository architecture

src/stage2 and website/src/stage2 became operations; stage3 became trust. Internal worker/workspace/migration function names and source references were updated incrementally with typechecks and unchanged 148-operation contract validation. Published routes, table names, historical migration IDs, event payloads and Solidity contracts remain compatible. Historical delivery documents remain history.

The account module is now split into routing, chooser, workspace setup, settings, focused workspace and Developer panels, with shared AccountUI primitives. Logo/Header, shared authenticated HTTP/download transport and the interactive educational example have separate ownership. Lint includes a static frontend cycle/domain-folder check. BusinessApp and platform/routes remain large and are documented future incremental boundaries. PROJECT_STRUCTURE is the source map.

## Website and artwork

The homepage CTA now uses the existing final-cta component style with correct spacing. Main signup links lead to account choice. General customer CTAs no longer explain local databases/demo implementation; developer tools and actual financial/learning simulations retain truthful environment and no-funds labels. Unreferenced Ecosystem/GettingStarted components were removed after a reference search. Shared fonts are explicitly served in local Vite development.

Three independently generated editorial scenes add Personal planning, scheduled shop follow-up and record matching to the existing seven human illustrations. Typed Media descriptors integrate them on account choice and relevant product education. All were visually reviewed and delivered as 1200px WebP with alt text/provenance. Existing art was preserved. See ILLUSTRATION_SYSTEM and ILLUSTRATION_PROMPTS.

## Products and technology

See PRODUCT_RELIABILITY_AUDIT for the product-by-product review and PRODUCT_TECHNOLOGY_REVIEW for language/source decisions. Kept TypeScript/SQL transactional financial services and Solidity root verification; no gratuitous service split or Python rewrite. Financial, permission, issuer, callback, idempotency and source-assurance tests remain authoritative. Real provider authorization, distributed operation and performance certification are not inferred from local success.

## Infrastructure and LAN

npm run dev selects the explicit private development environment, prints provider mode/localhost/detected LAN addresses, uses fixed strict ports, waits for selected-database readiness and proxies the loopback API. Optional certificate/key paths enable supported Vite HTTPS. Development origins are exact; production ignores the additional development list. No wildcard credentialed CORS, trust-store change, firewall rule, tunnel, insecure cookie hack or production provider setting was introduced.

Executed host-to-LAN checks returned login and managed-config HTTP200 on both detected IPv4 interfaces. Actual phone sign-in still needs a trusted certificate, reviewed exact Neon origin and Safari/device-cookie qualification. HTTPS alone is not a claim of cross-site-cookie compatibility. LOCAL_NETWORK_DEVELOPMENT describes setup and remaining owner/device steps.

## Executed validation

| Check | Result |
| --- | --- |
| Backend / frontend TypeScript | Passed |
| SQLite full suite | 208 discovered: 207 passed; PostgreSQL-only disconnect test skipped |
| Local PostgreSQL 17 full suite | 208 passed, including deliberate transaction connection termination/pool recovery |
| Website production build / prerender / content tests | Passed; 17 frontend tests |
| Development configuration tests | 2 passed |
| ESLint / frontend import graph | Passed; no static frontend cycles |
| Legacy OpenAPI | 59 mounted operations validated |
| Workspace OpenAPI | 148 mounted operations validated; no public route changes |
| Local EVM / signed trust / independent verification | Passed after updating the renamed trust test path |
| Responsive browser | 52 route/width checks at 320/390/768/1440px; no horizontal overflow or missing main heading |
| Browser visibility control | Show/hide toggled while retaining input/focus; mobile login/CTA and account artwork screenshots inspected |
| Browser console | No errors in the inspected final public/account page |
| Neon development | Certificate-verified TLS, existing identity inventory, restored synthetic session and authenticated product reads passed |
| LAN | Host-to-LAN page/proxy checks passed; physical iPhone not tested |

Initial sandboxed HTTP tests could not connect to loopback and were rerun with network permission. One first PostgreSQL run had no reachable local test server; the server was started in the matching test context and the full rerun passed. The first chain run referenced the old compiled stage3 test; its script was fixed and the complete chain rerun passed. A first production content build exposed a missing supported /get-started entry in link validation; the entry allowlist was updated and build/tests rerun. Results above refer to the successful final runs, not those failed setup attempts. Build warnings from upstream Zod pure annotations are non-fatal.

## Remaining acceptance and deployment gates

Not marked complete: founder's own password entry; real recipient OTP/recovery/email-change round trips; physical iPhone Safari sessions on trusted LAN HTTPS; managed provider-side 15-character/blocklist policy qualification; full accessibility/soak/load/security audit. Existing production provider, custody, institutional recognition, email deployment and distributed-worker gates remain. No public testnet/mainnet or live financial capability was enabled.

Private credentials, local identity fixtures, databases, screenshots and original generations are excluded from Git. Source-controlled docs contain no database URLs/passwords. The running local preview is development infrastructure, not a production deployment.
