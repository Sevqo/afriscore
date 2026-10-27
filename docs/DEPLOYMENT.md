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

## Stage 2 operation
Build both root and website before start; additive migrations run automatically. Keep one API instance. Stage 2 worker polls every 15 seconds for workflows, approval expiry and connector retries. Review dead letters/run history; repair source/config before retry. Production protected-sale endpoints remain disabled regardless of AI configuration.

Optional server-only OPENAI_API_KEY, AFRICORE_AI_MODEL and AFRICORE_AI_DAILY_REQUEST_LIMIT enable bounded AI explanations. Do not copy a developer .env into an image or frontend bundle. Credits must be funded independently; credit_balance_exhausted is a billing gate. See AI_ASSISTANT.md. A live API key does not enable payment partners. Backup encryption keys separately and restore-test evidence before launch. See COMPLIANCE_GAPS_STAGE2.md before changing availability.

## Stage 3 and demo operation
npm run demo:web serves the browser-only synthetic demo; npm run demo:server builds/serves a separate loopback SQLite demo with owner/issuer/partner accounts. See DEMO_LOGIN.md. Never expose the public-password connected demo or its development token flow publicly.

Normal startup applies003-stage3. Configure verified AFRICORE_TRUST_OPERATOR_EMAILS separately from engineering access. Passport/issuance/sharing/public-verification flags control beta behavior. External issuers, production anchoring and selective disclosure remain hard-disabled. Keep a single API instance until claims/shared limits are verified.

npm run check:chain starts a temporary local EVM on18545, runs contract plus Stage 3/independent verification, then stops it. For manual local anchoring use chain:node/deploy and server-only RPC/address/chain/confirmation settings. Sepolia requires explicit AFRICORE_TESTNET_ANCHORING=true and authorized disposable resources; no public deployment has been performed. Mainnet IDs are rejected. Do not copy private keys or test databases into images. Docker packages existing app/docs; local contract development requires the dev dependencies and is not part of production custody.

## Managed-auth deployment continuation

Development now supports Managed Better Auth through NEON_AUTH_BASE_URL and the official Neon SDK. The previous statement that all registration/recovery is gated refers to the legacy provider. Managed development signup is active, requires email codes and uses shared development SMTP. For production, configure a separate branch/provider endpoint, exact HTTPS application origin and trusted domains, custom email sender, localhost disabled, backups and independent secrets. Apply reviewed migrations with a direct connection; use pooled verified-TLS runtime connections. Do not copy synthetic test identities or reuse development credentials.

JWT validation does not turn profile preferences into permissions. Existing identity collisions need explicit migration; do not automatically merge by email. Cross-domain cookies require physical-device/Safari testing or the provider's supported same-parent-domain/proxy setup. User mailbox delivery, production domain, external outbound webhook receiver, scaling controls and legal/partner launch gates remain external qualification tasks. No hosting or production activation was performed in this continuation.
