// Explicit development-only entry point. Never print connection strings/errors.
const { Client } = require('pg');
async function main() {
  if (process.env.AFRICORE_ENVIRONMENT !== 'development' ||
      process.env.NEON_BRANCH_ID !== 'br-jolly-lake-b4ff04st') throw new Error('development_branch_required');
  const direct = new URL(process.env.DIRECT_URL || '');
  if (!direct.hostname.endsWith('.neon.tech') || direct.hostname.includes('-pooler') ||
      direct.searchParams.get('sslmode') !== 'verify-full') throw new Error('verified_direct_connection_required');
  if (direct.hostname !== process.env.NEON_DEVELOPMENT_DIRECT_HOST) throw new Error('development_endpoint_required');
  const probe = new Client({connectionString:direct.href,connectionTimeoutMillis:15000});
  try {
    await probe.connect();
    if (!probe.connection.stream.encrypted || !probe.connection.stream.authorized) throw new Error('verified_tls_required');
  } finally { await probe.end(); }
  process.env.DATABASE_URL = direct.href;
  const db = require('../dist/db');
  try {
    await db.migrate();
    const row = await db.dbGet("SELECT version FROM platform_migrations WHERE version=?",['005-workspace-experiences']);
    if (!row) throw new Error('migration_not_recorded');
    console.log(JSON.stringify({migrated:true,environment:'development',version:row.version}));
  } finally { await db.closeDb(); }
}
main().catch(() => {console.error('Neon development migration failed; inspect configuration privately.');process.exitCode=1;});
