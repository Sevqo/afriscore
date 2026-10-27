const requiredVersions = ['001-workspaces','002-stage2','003-stage3','004-account-foundation','005-workspace-experiences'];
interface DatabasePreparation {
  isPostgres: boolean;
  migrate: () => Promise<void>;
  dbAll: (sql: string) => Promise<{ version: string }[]>;
}
/** Hosted starts verify a separately migrated database instead of rerunning DDL on every restart. */
export async function prepareDatabase(mode: string | undefined, db: DatabasePreparation) {
  if (!mode || mode === 'migrate') return db.migrate();
  if (mode !== 'verify') throw new Error('AFRICORE_MIGRATIONS_MODE must be migrate or verify');
  if (!db.isPostgres) throw new Error('Hosted schema verification requires PostgreSQL');
  const applied = new Set((await db.dbAll('SELECT version FROM platform_migrations')).map(row => row.version));
  if (requiredVersions.some(version => !applied.has(version)))
    throw new Error('Deployment schema is incomplete; run reviewed migrations separately');
  await db.dbAll('SELECT 1 FROM ac_users, ac_memberships, ac_workspaces, ac_identity_links, ac_personal_income, ac2_objects, ac3_objects WHERE FALSE');
}
