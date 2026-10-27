# Neon development setup

The private local file .env.neon.development is ignored by Git. Never commit or display its contents. DATABASE_URL is the pooled runtime endpoint; DIRECT_URL is the direct migration endpoint. Both require sslmode=verify-full. Existing ordinary .env and demo servers remain separate.

After npm run build, run:

    node --env-file=.env.neon.development scripts/neon-migrate.cjs

The script refuses any environment except development and the reviewed branch br-jolly-lake-b4ff04st. NEON_DEVELOPMENT_DIRECT_HOST must privately match the reviewed development endpoint. This is an accidental-target guard, not cryptographic proof of branch identity: verify the endpoint in Neon when provisioning or rotating credentials. Production is not an allowed migration target. No credentials appear in the runbook.

The runtime can be explicitly started with the same private env-file and a free local PORT. Never reuse a running demo port or point TEST_DATABASE_URL at production. Tests use disposable local databases; the live development connection was checked separately using synthetic rows.

No paid plan, production migration or managed auth activation has occurred. Backups are ignored under .tmp/neon; preserve them until migration acceptance is complete.
