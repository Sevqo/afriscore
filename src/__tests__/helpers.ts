import fs from "fs";
import path from "path";
import {serviceCatalog} from '../marketplace/catalog';
/** Legacy product journey suites explicitly request their full fixture catalog.
 * Marketplace onboarding tests deliberately do not use this helper. */
export function productFixtureBody(path:string,method:string,body:any){
 if(method!=='POST'||!['/api/v1/organizations','/api/auth/workspaces'].includes(path)||!body||body.services!==undefined)return body;
 const kind=body.kind||'business';
 return {...body,services:serviceCatalog.filter(s=>s.kinds.includes(kind)&&s.availability!=='unavailable').map(s=>s.id)};
}

/**
 * Test environment setup. Must be imported BEFORE any module that loads
 * the DB adapter, since the adapter binds its engine at import time.
 *
 * Engine is chosen by TEST_DATABASE_URL:
 *   unset -> SQLite, using a per-suite throwaway file
 *   set   -> dedicated local PostgreSQL fixture database, suites run serially
 *
 * `npm test` runs SQLite; `npm run test:pg` runs the same suites against
 * a real Postgres instance. Both must pass before a change ships.
 */
export function configureTestEnv(suiteName: string): { isPg: boolean; sqlitePath: string } {
  process.env.AFRISCORE_ADMIN_TOKEN = "test-only-admin-token-at-least-32-characters";
  process.env.AFRICORE_ENCRYPTION_KEY='fixture-only-encryption-key-at-least-32-characters';
  process.env.AFRICORE_ENCRYPTION_WRITE_VERSION='2';
  process.env.ID_HASH_SALT='fixture-only-private-identifier-key-at-least-32-characters';
  process.env.LEDGER_HMAC_KEY='fixture-only-ledger-anchor-key-at-least-32-characters';
  process.env.OPENAI_API_KEY='';process.env.AFRICORE_AI_MODEL='';
  process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS='example.com,hooks.partner.example';
  // Orbit tests always use the in-memory queue backend, never a live Redis.
  delete process.env.REDIS_URL;
  // Prevent config.ts from reloading a real managed provider from local .env.
  process.env.NEON_AUTH_BASE_URL = '';
  const pgUrl = process.env.TEST_DATABASE_URL;

  if (pgUrl) {
    const target=new URL(pgUrl),host=target.hostname.replace(/^\[|\]$/g,'');
    if(!['localhost','127.0.0.1','::1'].includes(host)||!/(?:test|security|refinement)/i.test(target.pathname))
      throw new Error('Tests require a dedicated local fixture database; remote/production targets are refused');
    process.env.DATABASE_URL = pgUrl;
    return { isPg: true, sqlitePath: "" };
  }

  // An explicit empty value prevents .env loading from opting tests into Neon.
  process.env.DATABASE_URL = '';
  const sqlitePath = path.join(__dirname, `../../test-${suiteName}.db`);
  process.env.DB_PATH = sqlitePath;
  return { isPg: false, sqlitePath };
}

/**
 * Removes all rows so a suite starts from a known state. Used instead of
 * deleting the SQLite file, which would invalidate the adapter's already
 * open handle (SQLITE_IOERR_FSTAT).
 */
export async function truncateAll(dbRun: (sql: string, params?: any[]) => Promise<any>) {
  const tables = [
    "unmatched_payments",
    "dead_letter_jobs",
    "workflow_events",
    "workflows",
    "invoice_payments",
    "business_links",
    "statements",
    "business_shortcodes",
    "ledger_heads",
    "ledger",
    "consents",
    "transactions",
    "accounts",
    "invoices",
    "webhook_events",
    "webhook_subscriptions",
    "api_clients",
    "businesses",
    "persons",
  ];
  for (const t of tables) {
    await dbRun(`DELETE FROM ${t}`);
  }
}

export function removeSqliteFile(sqlitePath: string) {
  if (!sqlitePath) return;
  for (const suffix of ["", "-shm", "-wal"]) {
    const p = sqlitePath + suffix;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* best effort — the handle may still be open on some platforms */
      }
    }
  }
}
