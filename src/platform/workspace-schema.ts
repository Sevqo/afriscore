import { dbExec, dbRun, dbTransaction, isPostgres } from "../db/adapter";
export async function migrateWorkspaceExperiences() {
  await dbTransaction(async () => {
    await dbExec(`
CREATE TABLE IF NOT EXISTS ac_owned_workspaces (user_id TEXT NOT NULL REFERENCES ac_users(id),kind TEXT NOT NULL CHECK(kind IN ('personal','developer')),workspace_id TEXT NOT NULL UNIQUE REFERENCES ac_workspaces(id),PRIMARY KEY(user_id,kind));
CREATE TABLE IF NOT EXISTS ac_identity_links (provider TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL UNIQUE REFERENCES ac_users(id),PRIMARY KEY(provider,subject));
CREATE TABLE IF NOT EXISTS ac_revoked_access_tokens (token_hash TEXT PRIMARY KEY,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ac_api_request_logs (id TEXT PRIMARY KEY,org_id TEXT NOT NULL REFERENCES ac_organizations(id),environment TEXT NOT NULL,credential_id TEXT NOT NULL REFERENCES ac_credentials(id),method TEXT NOT NULL,route TEXT NOT NULL,status_code INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ac_api_request_logs_scope ON ac_api_request_logs(org_id,environment,created_at);
CREATE INDEX IF NOT EXISTS ac_revoked_access_tokens_expiry ON ac_revoked_access_tokens(expires_at);
CREATE TABLE IF NOT EXISTS ac_account_details (user_id TEXT PRIMARY KEY REFERENCES ac_users(id),country TEXT NOT NULL DEFAULT 'KE',use_case TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT '',revoked_before TEXT,deletion_requested_at TEXT);
CREATE TABLE IF NOT EXISTS ac_personal_income (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES ac_workspaces(id),environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),description TEXT NOT NULL,amount_minor BIGINT NOT NULL CHECK(amount_minor>0),currency TEXT NOT NULL,occurred_on TEXT NOT NULL,created_at TEXT NOT NULL,actor TEXT NOT NULL REFERENCES ac_users(id));
CREATE INDEX IF NOT EXISTS ac_personal_income_scope ON ac_personal_income(workspace_id,environment,currency,occurred_on);
`);
    if (isPostgres)
      for (const table of [
        "ac_owned_workspaces",
        "ac_identity_links",
        "ac_account_details",
        "ac_personal_income",
        "ac_revoked_access_tokens",
        "ac_api_request_logs",
      ])
        await dbExec(
          `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC;`,
        );
    await dbRun(
      "INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING",
      ["005-workspace-experiences", new Date().toISOString()],
    );
  });
}
