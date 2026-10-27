# Hosted managed authentication

Preserve the existing NEON_AUTH_BASE_URL and branch. Register only the actual deployed Cloudflare HTTPS origin in Neon trusted domains, without a trailing slash. Keep localhost available for existing local development. Do not replace the provider, copy identities or reset the founder password.

The browser official @neondatabase/auth 0.7.0-beta vanilla adapter includes provider cookies, obtains a short-lived token, and sends it through same-origin /api requests. The Cloudflare gateway preserves Authorization and Origin; Express verifies fixed JWKS/issuer/audience/algorithm, current managed user state, revocation and current memberships. Login restores the last authorized workspace; Personal, Business and Developer containers remain distinct.

Cross-site provider cookies require actual browser acceptance. Chromium success is not Safari/iPhone qualification. If blocked, use a provider-supported custom-domain/proxy setup after reviewing official documentation; do not remove security checks or manually rewrite provider cookies as a shortcut. CSP must allow only the exact provider origin.

Signup/reset minimum remains eight characters. Never enter or reset the founder password on their behalf. Existing authorized synthetic sessions can verify HTTP authorization; founder sign-in is a user-entered acceptance step. Neon development shared mail is not a configured production sender. Record mailbox delivery, code completion and reset completion only when observed with an authorized recipient. See https://neon.com/docs/auth/guides/configure-domains and https://neon.com/docs/auth/production-checklist.
