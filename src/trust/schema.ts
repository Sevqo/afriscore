import { dbExec, dbRun, dbTransaction, isPostgres } from '../db/adapter';
export async function migrateTrust() {
  await dbTransaction(async () => {
    await dbExec(`
CREATE TABLE IF NOT EXISTS ac3_objects(id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES ac_organizations(id),environment TEXT NOT NULL,kind TEXT NOT NULL,peer_org TEXT,data TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ac3_scope ON ac3_objects(org_id,environment,kind);
CREATE INDEX IF NOT EXISTS ac3_peer ON ac3_objects(peer_org,environment,kind);
CREATE TABLE IF NOT EXISTS ac3_issuers(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL,types TEXT NOT NULL,next_index INTEGER NOT NULL DEFAULT 0,review TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac3_keys(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,environment TEXT NOT NULL,state TEXT NOT NULL,public_jwk TEXT NOT NULL,private_sealed TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac3_credentials(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,issuer_id TEXT NOT NULL REFERENCES ac3_issuers(id),key_id TEXT NOT NULL REFERENCES ac3_keys(id),schema_id TEXT NOT NULL,status TEXT NOT NULL,status_index INTEGER NOT NULL,token_sealed TEXT NOT NULL,salt_sealed TEXT NOT NULL,commitment TEXT NOT NULL,fingerprint TEXT NOT NULL,valid_until TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(issuer_id,status_index),UNIQUE(org_id,environment,issuer_id,fingerprint));
CREATE INDEX IF NOT EXISTS ac3_credentials_scope ON ac3_credentials(org_id,environment);
CREATE TABLE IF NOT EXISTS ac3_grants(id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,recipient_org TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,data TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,consumed_at TEXT,one_time INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ac3_grants_scope ON ac3_grants(org_id,environment);
CREATE TABLE IF NOT EXISTS ac3_batches(id TEXT PRIMARY KEY,environment TEXT NOT NULL,root TEXT NOT NULL UNIQUE,state TEXT NOT NULL,data TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac3_batch_items(credential_id TEXT PRIMARY KEY REFERENCES ac3_credentials(id),batch_id TEXT NOT NULL REFERENCES ac3_batches(id),proof_sealed TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS ac3_single_passport ON ac3_objects(org_id,environment,kind) WHERE kind='passport';
`);
    if (isPostgres)
      for (const t of [
        'ac3_objects',
        'ac3_issuers',
        'ac3_keys',
        'ac3_credentials',
        'ac3_grants',
        'ac3_batches',
        'ac3_batch_items',
      ])
        await dbExec(
          `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${t} FROM PUBLIC;`,
        );
    await dbRun(
      'INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING',
      ['003-stage3', new Date().toISOString()],
    );
  });
}
