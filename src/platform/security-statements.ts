/** Canonical additive 006 DDL, shared by migrations and guarded maintenance. */
export const securityStatements=[
 'CREATE TABLE IF NOT EXISTS ac_approval_bindings (approval_id TEXT PRIMARY KEY, org_id TEXT NOT NULL, environment TEXT NOT NULL, resource_hash TEXT NOT NULL, parameters TEXT NOT NULL, review_summary TEXT NOT NULL, consumed_at TEXT)',
 "CREATE TABLE IF NOT EXISTS ac_legacy_deliveries (id TEXT PRIMARY KEY,event_id TEXT NOT NULL,subscription_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,next_at TEXT NOT NULL,last_error TEXT,created_at TEXT NOT NULL,UNIQUE(event_id,subscription_id))",
 'CREATE INDEX IF NOT EXISTS ac_legacy_deliveries_due ON ac_legacy_deliveries(status,next_at)',
 'CREATE INDEX IF NOT EXISTS ac_ai_identity_usage ON ac2_ai_usage(actor,created_at)',
 'CREATE INDEX IF NOT EXISTS ac_ai_global_usage ON ac2_ai_usage(created_at)',
];
