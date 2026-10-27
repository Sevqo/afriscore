# Backend hosting

Use the existing Dockerfile on a single Render Free web service, sourced from Sevqo/afriscore main. render.yaml records the reproducible configuration without credentials or new datastores. Build context is repository root; Docker CMD is node dist/index.js; listen port is supplied by Render; bind host defaults to 0.0.0.0. /v1/health checks process liveness and /v1/readiness checks PostgreSQL. Startup applies existing additive migrations; no reset/down migration or seed is authorized.

Required runtime variables: NODE_ENV=production, AFRICORE_ENVIRONMENT=development, pooled verified-TLS DATABASE_URL, existing NEON_AUTH_BASE_URL, exact AFRICORE_PUBLIC_ORIGIN, existing AFRICORE_ENCRYPTION_KEY/ID_HASH_SALT/LEDGER_HMAC_KEY, independent AFRISCORE_ADMIN_TOKEN, AFRICORE_GATEWAY_SECRET, TRUST_PROXY=1 and restrictive AFRISCORE_WEBHOOK_ALLOWED_HOSTS. disabled.invalid denies ordinary outbound webhook targets until an exact test receiver is approved. No admin credential is shipped to browsers.

Render Free sleeps after 15 minutes without inbound traffic, can restart, and has ephemeral disk. The durable PostgreSQL outbox resumes when the service wakes; jobs do not run while asleep. In-memory Orbit work is not restart durable. Do not promise unattended reminders or guaranteed delivery schedules. Existing free instance hours/build bandwidth are shared across the workspace; check the dashboard. Never upgrade or add a card without explicit approval. See https://render.com/docs/free.

Always-on compute is a later separately approved cost decision. No Redis, extra database, paid background worker or persistent disk is created here. Existing unrelated Render services remain untouched.

Hosted startup uses AFRICORE_MIGRATIONS_MODE=verify: require all five recorded schema versions and core tables using SELECT only. Apply reviewed migrations separately before changing this mode. This avoids repeating legacy ALTER/RLS DDL and locking existing data during each hosting restart. Local default remains migrate.
