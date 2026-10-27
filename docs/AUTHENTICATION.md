# Authentication

Managed Better Auth on Neon is the configured development identity provider. The official @neondatabase/neon-js SDK handles signup, sign-in, verification codes, recovery, email change requests and provider sessions. Its cross-origin fetches include cookies. Use localhost rather than a loopback IP: Neon's default localhost policy rejects the latter.

NEON_AUTH_BASE_URL is server configuration. /api/auth/config exposes only that public endpoint and the selected provider. The frontend retrieves a short-lived JWT through the SDK for requests to Express; it never receives database credentials. The API verifies EdDSA signatures against a fixed configured JWKS, issuer, audience, token lifetime, current provider user state and local revocation. It ignores provider roles for application authorization.

ac_identity_links maps provider/subject to a stable application user ID. Projection is transactional and serialized on the provider user. Existing application users are never silently merged by email. A collision requires an explicit identity migration. Existing financial IDs and memberships remain unchanged. No password hashes are imported into Neon Auth.

When managed auth is configured, legacy credential endpoints are disabled and legacy session cookies cannot authorize application requests. The existing hardened auth remains for isolated offline development/regression fixtures; it is not a second selectable provider in one configured deployment. Production legacy signup/recovery remain gated.

Current-token logout revokes the API token locally and signs out the provider session. Sign-out-all records an identity-wide issuance cutoff, removes legacy sessions and calls provider session revocation. Changes to workspace membership and provider bans/deletion are checked at request time. Tokens revoked outside AfriCore may retain API validity until their 15-minute expiry; use AfriCore logout flows for local immediate revocation. Secure HttpOnly provider cookies remain provider-managed; JWTs are passed in memory, not saved by application code.

Development signup requires email verification codes. Shared Neon SMTP is development-only; production requires a custom sender and domain configuration. Provider signup/token issuance and authenticated Neon persistence were tested. Verification codes are hashed; mailbox receipt, complete code entry, recovery-email delivery and email-change delivery require a real recipient and are not claimed verified by synthetic tests. Cross-domain cookies also need actual Safari/device qualification or a supported same-parent-domain/proxy deployment.

Production checklist: configure production branch separately, custom email provider, verified domains, disable localhost, independent secrets, HTTPS, backups, shared rate limits/worker coordination and provider recovery support. Do not copy development identities into production.

Official integration references: [React SDK quickstart](https://neon.com/docs/auth/quick-start/react), [JWT verification](https://neon.com/docs/auth/guides/plugins/jwt), [production checklist](https://neon.com/docs/auth/production-checklist). Inspect installed SDK types when API options differ from documentation; this implementation uses the supported vanilla adapter with credentialed fetches.
