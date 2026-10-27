import { dbExec, dbRun, dbTransaction, isPostgres } from "../db/adapter";

/** Additive account metadata. Existing organization IDs remain resource scopes. */
export async function migrateAccounts() {
  await dbTransaction(async () => {
    await dbExec(`
CREATE TABLE IF NOT EXISTS ac_workspaces (
 id TEXT PRIMARY KEY REFERENCES ac_organizations(id),
 kind TEXT NOT NULL CHECK(kind IN ('personal','business','developer')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ac_profiles (
 user_id TEXT PRIMARY KEY REFERENCES ac_users(id),
 display_name TEXT NOT NULL DEFAULT '',
 primary_experience TEXT CHECK(primary_experience IN ('personal','business','developer')),
 last_workspace_id TEXT REFERENCES ac_workspaces(id),
 timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
 currency TEXT NOT NULL DEFAULT 'KES',
 onboarding_status TEXT NOT NULL DEFAULT 'pending' CHECK(onboarding_status IN ('pending','complete')),
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ac_memberships_user_scope ON ac_memberships(user_id,org_id);
CREATE INDEX IF NOT EXISTS ac_workspaces_kind_status ON ac_workspaces(kind,status);
`);
    await dbRun(`INSERT INTO ac_workspaces(id,kind,status,created_at)
 SELECT id,'business','active',created_at FROM ac_organizations WHERE 1=1
 ON CONFLICT(id) DO NOTHING`);
    await dbRun(`INSERT INTO ac_profiles(user_id,updated_at)
 SELECT id,created_at FROM ac_users WHERE 1=1 ON CONFLICT(user_id) DO NOTHING`);
    if (isPostgres) {
      for (const table of ["ac_workspaces", "ac_profiles"]) {
        await dbExec(
          `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC;`,
        );
      }
    }
    await dbRun(
      "INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING",
      ["004-account-foundation", new Date().toISOString()],
    );
  });
}
