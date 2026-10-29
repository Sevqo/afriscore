# Account security capability assessment

Reviewed 29 October 2026. This is Milestone 1 of [the retained master plan](PRODUCT_MASTER_PLAN.md). Authentication remains Neon Managed Better Auth. No identities, credentials, memberships or database schema were migrated.

## Supported implementation

The installed `@neondatabase/auth` 0.7.0-beta vanilla adapter exposes `getSession`, `listSessions`, `revokeSession`, `revokeOtherSessions`, `revokeSessions`, `changePassword` and `changeEmail`. The security screen calls those provider operations and checks returned errors. Current-session identity comes from the provider session ID, never a user-agent guess. Per-session opaque revocation handles stay in a private closure; rendered view models, local/session storage and AfriCore requests contain no such handles. Unknown/current session IDs cannot be individually revoked through the controller. Mass actions require confirmation in the shared focus-managed overlay.

Password changes require the current password, matching new-password confirmation, the established minimum of eight characters, provider validation and revocation of other provider sessions. Existing accounts without a password must use their configured identity/recovery methods; this form does not create a new authentication factor. Email changes retain provider verification policy; application memberships never follow an arbitrary email match.

AfriCore sign-out-everywhere first executes the existing server-side issuance cutoff, then provider revocation and sign out. Provider errors are surfaced instead of falsely declaring success. Individual/other provider-session revocation stops refresh but does not revoke already issued application JWTs immediately: the existing maximum remaining token lifetime is approximately 15 minutes. The screen discloses that distinction. Current-device logout uses the existing per-token revocation path.

Session creation timestamps support a limited recent-sign-in view. Provider `updatedAt` is not labelled last activity. Device names are bounded, conservative header hints, without exact model/version/location claims. A complete retained account event journal, provider event ingestion, configurable security email alerts and reliable suspicious-sign-in detection are not implemented by this release. Existing workspace audit history remains authoritative for workspace operations. Do not interpret the limited sign-in list as a complete security audit.

## MFA and passkeys

Official sources checked on 29 October 2026:

- [Neon roadmap](https://neon.com/docs/auth/roadmap): MFA remains coming soon.
- [Managed plugins](https://neon.com/docs/auth/guides/plugins): only the managed supported subset is available; customers cannot install arbitrary server plugins.
- [Better Auth two factor](https://www.better-auth.com/docs/plugins/2fa): self-managed TOTP/OTP, backup codes and enrollment verification.
- [Better Auth passkeys](https://www.better-auth.com/docs/plugins/passkey): server plugin, migrations and established WebAuthn verification.
- [Session management](https://www.better-auth.com/docs/concepts/session-management): authenticated provider revocation and session freshness.

No MFA, recovery-code, trusted-device or passkey switch is presented as active. Importing a client plugin cannot enforce a second factor at the managed server. No privileged operation gains a fictitious stronger assurance level.

## Architecture options and approval gate

**A: retain managed authentication (selected for this milestone).** Preserve provider subject to application user links and existing verification/recovery flows. Reassess supported provider features before adding any factor. Qualify provider revocation against an isolated managed identity and physical Safari; retain the JWT revocation-window disclosure. A future provider-event receiver must validate signatures, deduplicate deliveries, scope subjects to current identity links and redact tokens before recording events. Event ingestion is not enabled here.

**B: separately approved migration.** Self-managed Better Auth with supported two-factor/passkey plugins is a candidate, not an approved deployment. An established external identity provider is another candidate. Compare patching/operations, session binding, recovery, export compatibility, regional hosting and Cloudflare-to-Render deployment compatibility before selecting one.

Before migration:

1. Obtain approval for the selected identity architecture and cutover procedure. Work against a separate disposable branch/provider first.
2. Back up application and authentication data with a tested restore and retain existing encryption keys. Inventory stable provider subjects, application IDs, workspace memberships/owners, verified addresses and recovery methods. Never merge by email.
3. Verify whether each existing password hash format can be safely imported through a supported mechanism. If not, use a controlled verified recovery/re-enrollment journey; never claim credentials are preserved without evidence.
4. Implement server-enforced pre-authentication challenges, encrypted TOTP secrets, replay/rate protection, hashed single-use recovery codes and established WebAuthn libraries. Fully authenticated JWTs must be issued only after required factors. Bind tokens to revocable sessions and enforce assurance on privileged server routes.
5. Test signup, existing sign-in, reset, verification/change-email, MFA enrollment/challenge/recovery/disable, passkey lifecycle, stolen/revoked sessions, API keys, tenant isolation and ownership. Verify trusted domains, RP IDs, cookies, gateway routes and physical devices.
6. Rehearse a bounded maintenance cutover and rollback. Preserve identity/membership mappings and signed financial history, invalidate old sessions deliberately, and never restore an old application database over new activity. Rollback must retain compatible ciphertext readers and keys.

The migration, a complete account event receiver and notification delivery qualification require separate implementation and acceptance. No live migration is included in Milestone 1.
