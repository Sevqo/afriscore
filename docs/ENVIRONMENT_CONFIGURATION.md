# Deployment environment configuration

Local .env and .env.neon.development remain private and Git-ignored. .dev.vars, .africore-dev.json and .wrangler state are ignored and excluded from container contexts. Root .env contains local development configuration only; never upload it wholesale.

Backend secret store: DATABASE_URL, AFRICORE_ENCRYPTION_KEY, ID_HASH_SALT, LEDGER_HMAC_KEY, AFRISCORE_ADMIN_TOKEN, AFRICORE_GATEWAY_SECRET. Preserve existing database cryptographic keys exactly. Database runtime URL must require sslmode=verify-full. DIRECT_URL is migration-only and is not required on the edge.

Backend public configuration: NODE_ENV, AFRICORE_ENVIRONMENT, NEON_AUTH_BASE_URL, AFRICORE_PUBLIC_ORIGIN, TRUST_PROXY, restrictive webhook hosts, beta feature flags. Cloudflare has only BACKEND_ORIGIN, NEON_AUTH_ORIGIN and its shared gateway secret. Frontend needs no database URL or secret build variables.

Optional providers remain unconfigured unless explicitly authorized: OpenAI, payment partner, SMTP, blockchain RPC/publisher. No live payments, custody, mainnet contracts or externally recognized credentials are enabled by deployment. Local tests must explicitly clear DATABASE_URL and NEON_AUTH_BASE_URL and use disposable stores; never load the hosted branch into ordinary regression tests.
