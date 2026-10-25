# Deployment and runbooks
Owner: AfriCore engineering. Reviewed: 2026-10-25.

## Local
Node 22+. Root: npm ci, npm run build. website: npm ci, npm run build. Root: npm start. Open http://localhost:4000. Public site, /signup, /signin, /app and checkout share one origin. For frontend iteration run npm run dev in website; /api proxies to port 4000.

No .env is required for local workspace sandbox. Legacy operator APIs need AFRISCORE_ADMIN_TOKEN. Development signup/recovery returns local tokens; never expose development mode publicly or use real sensitive information.

## Production preparation
Backup and restore-test existing DB. Configure private PostgreSQL DATABASE_URL; existing AFRISCORE_ADMIN_TOKEN, ID_HASH_SALT, LEDGER_HMAC_KEY; independent 32+ character AFRICORE_ENCRYPTION_KEY; exact HTTPS AFRICORE_PUBLIC_ORIGIN; TRUST_PROXY; AFRISCORE_WEBHOOK_ALLOWED_HOSTS. Optional AFRICORE_ENGINEERING_EMAILS requires verified users, defaults deny-all. Optional sandbox callbacks require AFRICORE_SANDBOX_CALLBACK_SECRET. Never commit secrets.

Dockerfile builds API/website and packages dashboard/contract, running non-root. Local Docker build/PostgreSQL checks were unavailable because Docker Linux engine was stopped. Existing compose examples need new required production variables; never deploy example secrets publicly. Production registration/recovery is disabled pending email delivery; live payments disabled independently. Do not expose as a completed production service.

## Operations
One API instance only. Webhook outbox polls every 10 seconds; legacy Orbit retains Redis/worker support. Add distributed claims and shared rate limits before scaling. Health /v1/health; DB readiness /v1/readiness; admin metrics /v1/metrics. Route alerts externally for sustained failures, reconciliation exceptions and dead-letter deliveries; no alert transport is configured.

Delivery incident: inspect Developer history, validate HTTPS/allowlist/certificate/secret, fix receiver, replay using authorized session. Delivery ID remains stable. Never retry payment initiation to repair notifications.

Reconciliation incident: preserve provider evidence, inspect request/currency/open amount, record review note. Automatic refund/reversal settlement is not enabled. Rollback binaries while retaining ac_ tables and financial history. Restore backups only under an approved incident procedure.

Continue in a new session by reading AGENTS.md and IMPLEMENTATION_STATUS.md, then the relevant runbook. Complete remaining gates before claiming full phase acceptance or real-money readiness.
