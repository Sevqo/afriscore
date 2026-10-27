# Neon development setup

The private local file .env.neon.development is ignored by Git. Never commit or display its contents. DATABASE_URL is the pooled runtime endpoint; DIRECT_URL is the direct migration endpoint. Both require sslmode=verify-full. Existing ordinary .env and demo servers remain separate.

After npm run build, run:

    node --env-file=.env.neon.development scripts/neon-migrate.cjs

The script refuses any environment except development and the reviewed branch br-jolly-lake-b4ff04st. NEON_DEVELOPMENT_DIRECT_HOST must privately match the reviewed development endpoint. This is an accidental-target guard, not cryptographic proof of branch identity: verify the endpoint in Neon when provisioning or rotating credentials. Production is not an allowed migration target. No credentials appear in the runbook.

The runtime can be explicitly started with the same private env-file and a free local PORT. Never reuse a running demo port or point TEST_DATABASE_URL at production. Tests use disposable local databases; the live development connection was checked separately using synthetic rows.

No paid plan or production migration has occurred. Development managed authentication was subsequently enabled as described below. Backups are ignored under .tmp/neon; preserve them until migration acceptance is complete.

## Development authentication

NEON_AUTH_BASE_URL configures the branch's public auth endpoint on the server. It is returned through /api/auth/config; no VITE database secrets are needed. Start the development runtime with the private env-file and exact public origin. The connected preview for this task is http://localhost:4003/get-started. Use localhost; the provider rejects the loopback-IP origin under its default development policy. Sign up with an email address you control, enter the verification code, then create the selected workspace.

Developer runtime command example (set PORT and AFRICORE_PUBLIC_ORIGIN consistently through your private environment):

    node --env-file=.env.neon.development dist/index.js

The SDK handles cross-origin credentials and obtains short-lived tokens for Express. Database URLs never enter the browser build. In Neon development settings: Verify at Sign-up is enabled with verification codes; Allow Localhost is enabled; shared SMTP is development-only. Production/staging branches need independent reviewed configuration, custom sender/trusted domains and localhost disabled. Production was not modified.

Development crypto configuration now has independent random encryption, identity-hash and ledger-HMAC secrets in the ignored env-file. The protected-history tables were checked empty before adding them; no historical ciphertext or ledger was rotated. Back up these secrets separately from Neon. Legacy operator admin access remains disabled unless independently configured.

PowerShell launch from the repository:

    $env:PORT = '4003'
    $env:AFRICORE_PUBLIC_ORIGIN = 'http://localhost:4003'
    node --env-file=.env.neon.development dist/index.js

## Paired development command
Use npm run dev with DEV_ENV_FILE=.env.neon.development; see LOCAL_NETWORK_DEVELOPMENT. Default frontend5175/API4005, strict ports, correct provider output and readiness gating replace automatic reuse of the legacy API4000. Existing4003 preview and4173 static preview may still be older processes. Restart owned development services when changing server code. Do not point normal tests at Neon; local disposable PostgreSQL is separate.
