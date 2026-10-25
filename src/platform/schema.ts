import { dbExec, dbRun, dbTransaction, isPostgres } from '../db/adapter';

/** Additive migration: legacy business/consent data is never reassigned. */
export async function migratePlatform() {
  await dbTransaction(async () => {
    await dbExec(`
CREATE TABLE IF NOT EXISTS platform_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, profile TEXT NOT NULL, verification_status TEXT NOT NULL DEFAULT 'unverified', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_memberships (org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, PRIMARY KEY(org_id,user_id));
CREATE TABLE IF NOT EXISTS ac_invitations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, accepted_at TEXT);
CREATE TABLE IF NOT EXISTS ac_records (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ac_records_scope ON ac_records(org_id,environment,kind);
CREATE TABLE IF NOT EXISTS ac_requests (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, document_id TEXT NOT NULL, amount_minor BIGINT NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, checkout_hash TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(org_id,environment,idempotency_key));
CREATE TABLE IF NOT EXISTS ac_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, request_id TEXT NOT NULL, provider_ref TEXT NOT NULL, status TEXT NOT NULL, amount_minor BIGINT NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(environment,provider_ref));
CREATE TABLE IF NOT EXISTS ac_allocations (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, document_id TEXT NOT NULL, amount_minor BIGINT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_journal (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, event_id TEXT NOT NULL, account TEXT NOT NULL, debit_minor BIGINT NOT NULL, credit_minor BIGINT NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(event_id,account));
CREATE TABLE IF NOT EXISTS ac_exceptions (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, event_id TEXT NOT NULL UNIQUE, reason TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_credentials (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, application_id TEXT NOT NULL, environment TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, scopes TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_audit (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, resource_id TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_endpoints (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, url TEXT NOT NULL, secret TEXT NOT NULL, subscriptions TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_deliveries (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, endpoint_id TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', next_at TEXT NOT NULL, last_error TEXT, created_at TEXT NOT NULL);
`);
    // Browser/partner database roles receive no direct access. The trusted table-owner
    // service role performs tenant checks before every query (see docs/SECURITY.md).
    if (isPostgres) {
      for (const table of [
        'ac_users',
        'ac_sessions',
        'ac_tokens',
        'ac_organizations',
        'ac_memberships',
        'ac_invitations',
        'ac_records',
        'ac_requests',
        'ac_events',
        'ac_allocations',
        'ac_journal',
        'ac_exceptions',
        'ac_credentials',
        'ac_audit',
        'ac_endpoints',
        'ac_deliveries',
      ]) {
        await dbExec(
          `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC;`,
        );
      }
    }
    await dbRun(
      'INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING',
      ['001-workspaces', new Date().toISOString()],
    );
  });
}
