# Database
Owner: AfriCore engineering. Reviewed: 2026-10-25.

001-workspaces in src/platform/schema.ts is additive, transactional and recorded in platform_migrations. Existing schema/data are preserved. SQLite is default; DATABASE_URL selects PostgreSQL.

New ac_ tables: users, sessions, tokens; organizations, memberships, invitations; records (customers/orders/invoices/applications/transactions/integrations); requests, events, allocations, journal, exceptions; credentials, audit, endpoints and deliveries.

Money uses integer BIGINT minor units and explicit currency, capped below JavaScript safe-integer limits. PostgreSQL BIGINT values are explicitly converted at calculation boundaries. Document JSON is runtime validated. Unique constraints cover idempotency, provider event references, event allocations, event/account journal entries, key/checkout hashes and memberships. Imports derive stable IDs from organization/environment/source/external ID.

PostgreSQL tables enable RLS with no public policies and revoke PUBLIC privileges. Untrusted direct roles cannot access them. The trusted table-owner backend bypasses RLS and enforces service authorization; no browser database connection exists. This is not session-claim RLS. A future non-owner runtime role needs explicit policies and transaction-local claims.

Backup and restore-test before migration. Repeated CREATE TABLE/INDEX operations are safe. Roll back application binaries while retaining ac_ tables; never erase new financial history to undo a UI release. Automated backups are not included. References are checked by services; direct SQL must preserve cross-tenant invariants. Workspace financial records are append-only by application convention, not externally anchored against database administrators.
