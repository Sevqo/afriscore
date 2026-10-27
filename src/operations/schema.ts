import { dbExec, dbRun, dbTransaction, isPostgres } from '../db/adapter';
export async function migrateOperations() {
  await dbTransaction(async () => {
    await dbExec(`
CREATE TABLE IF NOT EXISTS ac2_objects (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ac2_objects_scope ON ac2_objects(org_id,environment,kind,created_at);
CREATE TABLE IF NOT EXISTS ac2_events (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, event_type TEXT NOT NULL, resource_id TEXT, actor TEXT NOT NULL, source TEXT NOT NULL, assurance TEXT NOT NULL, correlation_id TEXT NOT NULL, dedupe_key TEXT NOT NULL, payload TEXT NOT NULL, occurred_at TEXT NOT NULL, UNIQUE(org_id,environment,dedupe_key));
CREATE INDEX IF NOT EXISTS ac2_events_scope ON ac2_events(org_id,environment,event_type,occurred_at);
CREATE TABLE IF NOT EXISTS ac2_runs (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, workflow_id TEXT NOT NULL, trigger_key TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at TEXT NOT NULL, result TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(org_id,environment,workflow_id,trigger_key));
CREATE TABLE IF NOT EXISTS ac2_notifications (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, user_id TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, resource_id TEXT, dedupe_key TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL, UNIQUE(org_id,environment,user_id,dedupe_key));
CREATE TABLE IF NOT EXISTS ac2_approvals (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, requester TEXT NOT NULL, approver TEXT NOT NULL, action TEXT NOT NULL, resource_id TEXT NOT NULL, status TEXT NOT NULL, reason TEXT, expires_at TEXT NOT NULL, decided_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac2_evidence (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, resource_id TEXT NOT NULL, resource_kind TEXT NOT NULL, actor TEXT NOT NULL, source TEXT NOT NULL, assurance TEXT NOT NULL, statement TEXT NOT NULL, filename TEXT, content_type TEXT, content_base64 TEXT, sha256 TEXT, occurred_at TEXT NOT NULL, retention_until TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac2_buyer_access (token_hash TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, agreement_id TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, revoked_at TEXT);
CREATE TABLE IF NOT EXISTS ac2_ai_usage (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, actor TEXT NOT NULL, provider TEXT NOT NULL, model TEXT, status TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, duration_ms INTEGER NOT NULL, error_code TEXT, created_at TEXT NOT NULL);
`);
    if (isPostgres)
      for (const t of [
        'ac2_objects',
        'ac2_events',
        'ac2_runs',
        'ac2_notifications',
        'ac2_approvals',
        'ac2_evidence',
        'ac2_buyer_access',
        'ac2_ai_usage',
      ])
        await dbExec(
          `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${t} FROM PUBLIC;`,
        );
    await dbRun(
      'INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING',
      ['002-stage2', new Date().toISOString()],
    );
  });
}
