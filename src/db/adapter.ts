import Database from "better-sqlite3";
import path from "path";
import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, PoolClient, types as pgTypes } from "pg";

/**
 * Dual-engine adapter. Every service in this codebase calls dbGet/dbAll/
 * dbRun/dbExec instead of touching a driver directly, so swapping engines
 * never requires touching business logic — just this file and DATABASE_URL.
 *
 * - No DATABASE_URL set -> SQLite (better-sqlite3), synchronous under the
 *   hood but wrapped to return Promises so callers are engine-agnostic.
 * - DATABASE_URL set -> PostgreSQL (pg), genuinely async.
 *
 * SQL is written with SQLite-style placeholders (`?` positional, or
 * `@name` named) in every service file. This adapter translates them to
 * Postgres's `$1, $2, ...` style transparently, so the same query strings
 * work unmodified against either engine.
 *
 * Transactions: dbTransaction() gives services a way to group multiple
 * writes atomically. On SQLite (one shared handle) a lock serialises
 * transaction bodies against every other statement, and the
 * AsyncLocalStorage context routes statements inside the body to the
 * already-open transaction instead of deadlocking on that lock. On
 * PostgreSQL the body runs on a dedicated pooled client.
 */

export const isPostgres = !!process.env.DATABASE_URL;

// node-postgres returns NUMERIC/DECIMAL as strings to avoid precision loss.
// Money columns are NUMERIC(18,2), so parse them back into numbers at the
// adapter boundary — the API contract uses JSON numbers.
pgTypes.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

let sqliteDb: Database.Database | null = null;
let pgPool: Pool | null = null;
let dbClosed = false;

/**
 * Pool knobs are read straight from process.env (with safe defaults) rather
 * than importing src/config.ts: importing config would load a `.env` file as a
 * side effect, and this module must stay side-effect-free apart from opening
 * the database (tests control env before importing it). src/config.ts exposes
 * the same values for validation/logging.
 */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return Math.floor(parsed);
}

if (isPostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    application_name: "afriscore",
    // Bounded pool + connection/query timeouts so a dead or slow database
    // fails requests instead of exhausting sockets/hanging handlers.
    max: envInt("PG_POOL_MAX", 10, 1, 100),
    connectionTimeoutMillis: envInt("PG_CONNECTION_TIMEOUT_MS", 5_000, 100, 120_000),
    idleTimeoutMillis: envInt("PG_IDLE_TIMEOUT_MS", 30_000, 1_000, 600_000),
    query_timeout: envInt("PG_QUERY_TIMEOUT_MS", 30_000, 0, 600_000),
    // Do not keep a process alive just because idle pooled clients exist.
    // The API stays up via its HTTP server; CLI/worker/test processes can exit
    // promptly instead of lingering until idleTimeoutMillis.
    allowExitOnIdle: true,
  });
  // A pool error listener is mandatory: an unhandled 'error' event on an idle
  // client crashes the process.
  pgPool.on("error", (err) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "pg_pool_error", message: err.message }));
  });
} else {
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../africore.db");
  sqliteDb = new Database(DB_PATH);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("busy_timeout = 5000");
}

/** Exposed only for the SQLite-specific migration guard in db/index.ts
 *  (PRAGMA table_info has no portable equivalent worth abstracting). */
export const rawSqliteDb = sqliteDb;

function positionalToDollar(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function namedToDollar(sql: string, params: Record<string, any>): { sql: string; values: any[] } {
  const order: string[] = [];
  const converted = sql.replace(/@(\w+)/g, (_match, name: string) => {
    order.push(name);
    return `$${order.length}`;
  });
  return { sql: converted, values: order.map((name) => params[name]) };
}

type Params = any[] | Record<string, any>;

// --- Transaction context -------------------------------------------------

interface TxContext {
  pgClient?: PoolClient;
}

const txStore = new AsyncLocalStorage<TxContext>();

/** True when the caller is already inside dbTransaction(). */
export function inTransaction(): boolean {
  return !!txStore.getStore();
}

// Serialises SQLite transaction bodies (and, between transactions, every
// other statement) so a transaction can never observe or commit another
// request's writes.
let sqliteQueue: Promise<unknown> = Promise.resolve();

function withSqliteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = sqliteQueue.then(fn, fn);
  sqliteQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function runSqlite<T>(fn: () => T): Promise<T> {
  if (txStore.getStore()) return Promise.resolve(fn());
  return withSqliteLock(async () => fn());
}

function pgQuery(text: string, values: any[]) {
  const client = txStore.getStore()?.pgClient;
  return client ? client.query(text, values) : pgPool!.query(text, values);
}

/**
 * Runs `fn` inside a database transaction. Nested calls join the outer
 * transaction (no savepoints) so services can compose freely.
 *
 * Throwing inside `fn` rolls the whole transaction back.
 */
export async function dbTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();

  if (!isPostgres) {
    return withSqliteLock(async () => {
      sqliteDb!.exec("BEGIN IMMEDIATE");
      try {
        const result = await txStore.run({}, fn);
        sqliteDb!.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          sqliteDb!.exec("ROLLBACK");
        } catch {
          /* transaction already rolled back by SQLite */
        }
        throw err;
      }
    });
  }

  const client = await pgPool!.connect();
  try {
    await client.query("BEGIN");
    const result = await txStore.run({ pgClient: client }, fn);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection may already be terminating */
    }
    throw err;
  } finally {
    client.release();
  }
}

// --- Query helpers -------------------------------------------------------

export async function dbGet<T = any>(sql: string, params: Params = []): Promise<T | undefined> {
  if (!isPostgres) {
    return runSqlite(() => {
      const stmt = sqliteDb!.prepare(sql);
      return (Array.isArray(params) ? stmt.get(...params) : stmt.get(params)) as T | undefined;
    });
  }
  const res = Array.isArray(params)
    ? await pgQuery(positionalToDollar(sql), params)
    : await (() => {
        const { sql: psql, values } = namedToDollar(sql, params);
        return pgQuery(psql, values);
      })();
  return res.rows[0];
}

export async function dbAll<T = any>(sql: string, params: Params = []): Promise<T[]> {
  if (!isPostgres) {
    return runSqlite(() => {
      const stmt = sqliteDb!.prepare(sql);
      return (Array.isArray(params) ? stmt.all(...params) : stmt.all(params)) as T[];
    });
  }
  const res = Array.isArray(params)
    ? await pgQuery(positionalToDollar(sql), params)
    : await (() => {
        const { sql: psql, values } = namedToDollar(sql, params);
        return pgQuery(psql, values);
      })();
  return res.rows;
}

export async function dbRun(sql: string, params: Params = []): Promise<{ changes: number }> {
  if (!isPostgres) {
    return runSqlite(() => {
      const stmt = sqliteDb!.prepare(sql);
      const info = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
      return { changes: info.changes };
    });
  }
  const res = Array.isArray(params)
    ? await pgQuery(positionalToDollar(sql), params)
    : await (() => {
        const { sql: psql, values } = namedToDollar(sql, params);
        return pgQuery(psql, values);
      })();
  return { changes: res.rowCount || 0 };
}

/** Raw DDL execution, no parameters — used for schema migration only. */
export async function dbExec(sql: string): Promise<void> {
  if (!isPostgres) {
    await runSqlite(() => sqliteDb!.exec(sql));
    return;
  }
  await pgQuery(sql, []);
}

/** Closes the pool / SQLite handle. Used by graceful shutdown and tests.
 *  Idempotent: a second SIGTERM-driven call (or a test teardown) is a no-op. */
export async function closeDb(): Promise<void> {
  if (dbClosed) return;
  dbClosed = true;
  if (isPostgres) {
    await pgPool?.end();
    pgPool = null;
  } else {
    sqliteDb?.close();
    sqliteDb = null;
  }
}
