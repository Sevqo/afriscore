# Milestone 1: application quality and account security

29 October 2026. The [full master specification](PRODUCT_MASTER_PLAN.md) is retained. Later payment, financial, blockchain and AI product expansion remains deferred until this milestone is reviewed. This release modifies the existing application; it does not replace the platform or migrate authentication.

## Changes

- **Usage & Billing:** one authoritative usage dataset feeds an accessible desktop table and a separate mobile card list at widths up to 700px. Cards show readable service names, formatted units, a human-readable plan, actual allowance policy and KES estimates. Internal price versions appear in expandable details. Search/category filtering and stable name/quantity/charge sorting precede 12-row pagination. Empty matches differ from empty periods. Collection stays disabled and estimates are not payable balances.
- **My Services:** primary Open Service button, secondary Manage action and native keyboard-accessible overflow disclosure for details, pinning, ordering and deactivation. Deactivation retains its existing confirmation and server enforcement. A compact current-month summary replaces repeated per-service paragraphs and appears above discovery filters. It shows active service count, estimated charges and the count of services with recorded usage, with a standard View Usage & Billing action.
- **Shared controls:** restrained eight-pixel button corners, explicit focus/disabled states, standard primary colors and readable controls across the existing Business/Personal/Developer selectors. Phone controls retain 16px editable text and approximately 44px tap height. No blind global font reduction was applied. Security cards and session layouts collapse naturally on mobile.
- **Account security:** distinct email, overview, password, factor availability, sessions, recovery, recent sign-ins, notifications and account-protection sections. Current-session identity comes from the provider, not a header guess. Device cards use general device/browser descriptions and actual expiry. Unknown last activity is labelled unavailable.
- **Session actions:** supported provider SDK listing, individual revocation and revocation of all other sessions; confirmation overlays; current/unknown session protection; refresh control; existing immediate application-wide sign-out cutoff plus provider session revocation. Returned provider errors are handled. Revocation handles remain only in a private controller closure, never rendered, logged or saved in browser storage. A known-successful application cutoff is retained in memory so provider sign-out can be retried after a provider failure.
- **Password/email:** current-password verification, matching confirmation, established password length rules, visibility control and provider-enforced password changes with other provider sessions revoked. Email changes continue through the managed provider confirmation policy. No application membership follows email matching.
- **Activity:** actual creation timestamps from active provider sessions provide a limited recent-sign-in list. It does not pretend to be a retained security event journal.

## Authentication capability decision

Retain Neon Managed Better Auth. [Neon's roadmap](https://neon.com/docs/auth/roadmap) still lists MFA as upcoming and its [managed plugin guide](https://neon.com/docs/auth/guides/plugins) does not permit arbitrary server plugin installation. Self-managed Better Auth has supported TOTP/recovery-code and passkey plugins, but installing their clients here would not enforce those factors at Neon.

[ACCOUNT_SECURITY_CAPABILITIES](ACCOUNT_SECURITY_CAPABILITIES.md) records supported operations, token lifetime limits, architecture alternatives and a staged migration/rollback plan. No auth migration, TOTP secret, recovery-code issuer, fake factor toggle or decorative passkey enrollment was introduced.

## Verification

| Gate | Result |
|---|---|
| SQLite backend regression | 241 passed, one PostgreSQL-only skip |
| Disposable local PostgreSQL 17 regression | 242 passed |
| Frontend/content tests | 29 passed, including provider handle redaction, current/unknown-session guards, provider denials, installed Neon SDK session routes, password checks and usage filtering/allowances |
| Root and website TypeScript | Passed |
| ESLint/architecture | Passed |
| Development startup checks | 3 passed |
| Cloudflare gateway tests | 4 passed |
| API contracts | 59 legacy and 169 workspace operations verified |
| Local chain/credential/independent verification regression | Passed; no external chain used |
| Worker asset/deployment dry run | Passed |

Local backend tests never use Neon. An initial sandbox run could not reach its loopback test server; the complete suite passed with local network access. An intermediate PostgreSQL run lost compiled test files because another build cleaned the shared dist directory; the full suite subsequently passed with builds serialized. No product defect was hidden by accepting either failed run. A line-ending-only OpenAPI regeneration produced no semantic contract change.

### Browser evidence

The actual shared React components were rendered in an isolated synthetic fixture. All three screens passed page-overflow checks at requested widths 320, 375, 390, 430, 768, 1024 and 1440 (21 cases). This host reports 321/376 for the two narrowest requested widths. Final phone service buttons and account actions measure approximately 44px. Desktop table/mobile cards switch correctly. Checked pagination, search after pagination, no-match feedback, service overflow options, deactivation confirmation/cancel, provider-session identity and revocation confirmation/cancel. Installed-SDK tests verify actual endpoint dispatch against a fake provider response, not a hosted revocation.

The fixture hot-reload emitted createRoot warnings when its scratch bootstrap was edited. These are isolated fixture remount warnings, not a verified production error. Physical iPhone/Safari, full screen-reader/axe qualification and a real managed-account password/revocation/email-change journey remain unverified. No founder password, email or active session was changed for QA.

Local artifacts (ignored, synthetic apart from the owner's supplied before images): `.tmp/quality/`. Contains responsive.json, test logs and the images below. Original screenshots remain local rather than being published to GitHub.

| Screen | Before: supplied screenshot | After: isolated component QA |
|---|---|---|
| Usage | [Before](../.tmp/quality/usage-before.png) | [Mobile cards](../.tmp/quality/usage-mobile.jpg), [desktop table](../.tmp/quality/usage-desktop.jpg) |
| Services | [Before](../.tmp/quality/services-before.png) | [Compact overview](../.tmp/quality/services-mobile.jpg), [service card](../.tmp/quality/service-card-mobile.jpg) |
| Security | [Before](../.tmp/quality/security-before.png) | [Readable sessions](../.tmp/quality/security-mobile.jpg) |

## Remaining limitations and review points

1. Individual/other provider-session revocation stops provider refresh, but existing application JWTs may remain valid for up to about 15 minutes. Sign out everywhere invokes the immediate application-wide issuance cutoff. Session-bound immediate individual API revocation requires a separate authoritative token/session binding design.
2. MFA, passkeys, trusted-device controls and second-factor step-up remain unavailable. A supported provider capability or approved migration is required. No migration approval is requested by this release because none is performed.
3. The activity view covers active sign-ins only. A complete durable account event journal, authenticated provider-event ingestion and configurable security notification delivery remain further security work. Existing workspace audit/history is preserved. These are not falsely labelled complete.
4. Real mailbox delivery, password/email-change acceptance, real provider session revocation and physical device compatibility require separate acceptance with an isolated managed account. Synthetic SDK tests do not prove hosted provider configuration.
5. This milestone performs no database migration and no record repair/reset. Neon identity links, legitimate business names including Continua, user-selected names including Cypskip, existing permissions, financial history, encryption readers and Cloudflare gateway policy remain unchanged.

## Deployment

Pending final release publication and public asset verification; exact commit and Worker version will be appended below. Backend behavior and schema are unchanged, so the existing Render backend is retained. A frontend rollback can redeploy the previous Worker version without modifying data. Major product expansion remains held for review.
