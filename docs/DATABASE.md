# Database
Owner: AfriCore engineering. Reviewed: 2026-10-25.

001-workspaces in src/platform/schema.ts is additive, transactional and recorded in platform_migrations. Existing schema/data are preserved. SQLite is default; DATABASE_URL selects PostgreSQL.

New ac_ tables: users, sessions, tokens; organizations, memberships, invitations; records (customers/orders/invoices/applications/transactions/integrations); requests, events, allocations, journal, exceptions; credentials, audit, endpoints and deliveries.

Money uses integer BIGINT minor units and explicit currency, capped below JavaScript safe-integer limits. PostgreSQL BIGINT values are explicitly converted at calculation boundaries. Document JSON is runtime validated. Unique constraints cover idempotency, provider event references, event allocations, event/account journal entries, key/checkout hashes and memberships. Imports derive stable IDs from organization/environment/source/external ID.

PostgreSQL tables enable RLS with no public policies and revoke PUBLIC privileges. Untrusted direct roles cannot access them. The trusted table-owner backend bypasses RLS and enforces service authorization; no browser database connection exists. This is not session-claim RLS. A future non-owner runtime role needs explicit policies and transaction-local claims.

Backup and restore-test before migration. Repeated CREATE TABLE/INDEX operations are safe. Roll back application binaries while retaining ac_ tables; never erase new financial history to undo a UI release. Automated backups are not included. References are checked by services; direct SQL must preserve cross-tenant invariants. Workspace financial records are append-only by application convention, not externally anchored against database administrators.

## Migration 002-stage2
Additive tables: ac2_objects (kind/JSON/version), ac2_events (append-only service events/dedupe), ac2_runs, ac2_notifications, ac2_approvals, ac2_evidence, ac2_buyer_access and ac2_ai_usage. Organization/environment indexes and PostgreSQL RLS are created; untrusted PUBLIC access revoked. Backend owner/service role bypass requires the existing route/service tenant checks. Tests exercise cross-tenant HTTP boundaries, not an independent database penetration audit.

Evidence file payloads are encrypted with platform seal; token hashes and AI usage metadata avoid plaintext capabilities/prompts. ac2_objects supports optimistic version checks within transaction locks. Expense corrections append and supersede records. Preserve old ac_/legacy tables and data. Back up before migration; rollback application binaries without dropping Stage 2 tables. Destructive down migration is deliberately absent. Retention access filters are implemented; physical purge/legal hold are not. PostgreSQL runtime verification depends on a running test server/CI.

## Migration 003-stage3
Adds encrypted generic ac3_objects (passport/review/evidence/relationships/requests/corrections/history), ac3_issuers, ac3_keys, ac3_credentials, ac3_grants, ac3_batches and ac3_batch_items. Organization/environment indexes, unique single Passport, issuer status indices, request fingerprints, token hashes, roots and one-batch-per-credential constraints apply. Credential key/issuer and batch references have foreign keys; remaining polymorphic/source links are validated in services. PostgreSQL enables default-deny RLS/revokes PUBLIC, retaining the existing trusted backend-owner model.

Private objects/keys/tokens/salts/presentations/proofs are sealed; public keys/trust states and root metadata remain queryable under their appropriate public/operator boundaries. Backup encryption keys separately and restore-test. Do not drop historical tables for application rollback. No automatic migration transfers legacy records into new passports. Physical purge and comprehensive deletion/hold policies remain open.
