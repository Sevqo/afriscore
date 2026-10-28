import fs from "node:fs";
import path from "node:path";

/**
 * Central runtime configuration.
 *
 * IMPORTANT IMPORT ORDER: importing this module has one deliberate side
 * effect — it loads a local `.env` file into `process.env` (without ever
 * overriding a variable that is already set in the real environment, so
 * "shell env > .env" holds). The database adapter snapshots
 * `process.env.DATABASE_URL` at *import* time to decide between SQLite and
 * PostgreSQL, therefore `config` MUST be the first import in `src/index.ts`
 * (it is also the first import in `src/app.ts` so tests that import the app
 * get the same behaviour). Importing anything that reaches `../db` before
 * this module would bind the adapter to the wrong engine.
 *
 * Tests are the documented exception: `src/__tests__/helpers.ts` sets
 * DATABASE_URL / DB_PATH itself and is called before `../db` is required.
 * A `.env` file present in the working directory is still loaded there, but
 * because we never override existing variables it cannot flip the test
 * engine — it only affects optional values such as LOG_LEVEL.
 */

export type NodeEnv = "development" | "test" | "production";
export type LogLevelName = "debug" | "info" | "warn" | "error";

export const LOG_LEVELS: readonly LogLevelName[] = ["debug", "info", "warn", "error"] as const;

export interface PgPoolSettings {
  /** PG_POOL_MAX — maximum pooled connections. */
  max: number;
  /** PG_CONNECTION_TIMEOUT_MS — fail instead of hanging when the DB is unreachable. */
  connectionTimeoutMs: number;
  /** PG_IDLE_TIMEOUT_MS — reclaim idle connections. */
  idleTimeoutMs: number;
  /** PG_QUERY_TIMEOUT_MS — client-side cap on a single statement (0 disables). */
  queryTimeoutMs: number;
}

export interface AppConfig {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  isTest: boolean;
  /** PORT — HTTP listen port. */
  port: number;
  /** DB_PATH — SQLite file path (ignored when DATABASE_URL is set). */
  dbPath: string;
  /** DATABASE_URL — when set the adapter uses PostgreSQL. */
  databaseUrl?: string;
  /** AFRISCORE_ADMIN_TOKEN — bootstrap control-plane credential (32+ chars). */
  adminToken?: string;
  gatewaySecret?: string;
  /** ID_HASH_SALT — salt for national-ID / phone hashes (32+ chars in prod). */
  idHashSalt?: string;
  /** LEDGER_HMAC_KEY — key anchoring ledger heads (32+ chars in prod). */
  ledgerHmacKey?: string;
  /** AFRISCORE_WEBHOOK_ALLOWED_HOSTS — comma-separated HTTPS hostname allowlist. */
  webhookAllowedHosts?: string;
  /** TRUST_PROXY — Express "trust proxy" setting (numeric hop count or value). */
  trustProxy?: number | string;
  logLevel: LogLevelName;
  /** SHUTDOWN_TIMEOUT_MS — grace period before a forced exit during shutdown. */
  shutdownTimeoutMs: number;
  pg: PgPoolSettings;
}

export interface ConfigValidation {
  errors: string[];
  warnings: string[];
}

/** Warnings collected while reading the environment (surfaced by validateConfig). */
const parseWarnings: string[] = [];

function rawEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Minimal `.env` parser (no dependency): `KEY=VALUE` per line, `#` comment
 * lines and blank lines ignored, optional single/double quotes around the
 * value stripped. Inline comments are intentionally NOT stripped — a `#`
 * inside a value (e.g. a password) is kept verbatim. Values already present
 * in `process.env` always win.
 *
 * Returns the file path it tried to load, or undefined when no file exists.
 */
export function loadEnvFile(filePath: string = path.resolve(process.cwd(), ".env")): string | undefined {
  let contents: string;
  try {
    contents = fs.readFileSync(filePath, "utf8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      parseWarnings.push(`Could not read ${filePath}: ${(err as Error).message}`);
    }
    return undefined;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const withoutExport = trimmed.startsWith("export ") ? trimmed.slice("export ".length).trim() : trimmed;
    const separator = withoutExport.indexOf("=");
    if (separator <= 0) continue;

    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = withoutExport.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2);
    if (quoted) value = value.slice(1, -1);

    if (process.env[key] === undefined) process.env[key] = value;
  }

  return filePath;
}

function readInt(name: string, fallback: number, min: number, max: number): number {
  const value = rawEnv(name);
  if (value === undefined) return fallback;
  if (!/^-?\d+$/.test(value)) {
    parseWarnings.push(`${name} must be an integer (got "${value}"); using ${fallback}.`);
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    parseWarnings.push(`${name} must be between ${min} and ${max} (got "${value}"); using ${fallback}.`);
    return fallback;
  }
  return parsed;
}

function readNodeEnv(): NodeEnv {
  const value = rawEnv("NODE_ENV");
  if (value === undefined || value === "") return "development";
  if (value === "production" || value === "test" || value === "development") return value;
  parseWarnings.push(`Unrecognized NODE_ENV "${value}"; treating it as development.`);
  return "development";
}

function readLogLevel(): LogLevelName {
  const value = rawEnv("LOG_LEVEL")?.toLowerCase();
  if (value === undefined) return "info";
  if ((LOG_LEVELS as readonly string[]).includes(value)) return value as LogLevelName;
  parseWarnings.push(`Unrecognized LOG_LEVEL "${value}"; using info (expected one of ${LOG_LEVELS.join(", ")}).`);
  return "info";
}

function readTrustProxy(): number | string | undefined {
  const value = rawEnv("TRUST_PROXY");
  if (value === undefined) return undefined;
  return /^\d+$/.test(value) ? Number(value) : value;
}

// The side effect that matters: load .env before anything is read below.
const envFile = loadEnvFile();
const nodeEnv = readNodeEnv();

/** Path of the `.env` file the loader attempted, if one was found. */
export const loadedEnvFile: string | undefined = envFile;

export const config: AppConfig = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  isTest: nodeEnv === "test",
  port: readInt("PORT", 4000, 1, 65535),
  // Keep the same default location the adapter uses: repo root, independent
  // of whether we run from src/ (ts-node) or dist/ (compiled).
  dbPath: rawEnv("DB_PATH") ?? path.join(__dirname, "../africore.db"),
  databaseUrl: rawEnv("DATABASE_URL"),
  adminToken: rawEnv("AFRISCORE_ADMIN_TOKEN"),
  idHashSalt: rawEnv("ID_HASH_SALT"),
  ledgerHmacKey: rawEnv("LEDGER_HMAC_KEY"),
  webhookAllowedHosts: rawEnv("AFRISCORE_WEBHOOK_ALLOWED_HOSTS"),
  trustProxy: readTrustProxy(),
  logLevel: readLogLevel(),
  shutdownTimeoutMs: readInt("SHUTDOWN_TIMEOUT_MS", 10_000, 1_000, 120_000),
  pg: Object.freeze({
    // Read again by the adapter directly from process.env at import time so
    // that importing the adapter never has to import this module (and thus
    // never triggers the .env side effect on the test path).
    max: readInt("PG_POOL_MAX", 10, 1, 100),
    connectionTimeoutMs: readInt("PG_CONNECTION_TIMEOUT_MS", 5_000, 100, 120_000),
    idleTimeoutMs: readInt("PG_IDLE_TIMEOUT_MS", 30_000, 1_000, 600_000),
    queryTimeoutMs: readInt("PG_QUERY_TIMEOUT_MS", 30_000, 0, 600_000),
  }),
});

/** Non-fatal problems encountered while reading the environment. */
export function parseWarningsList(): string[] {
  return [...parseWarnings];
}

function isSecret(value: string | undefined, minLength = 32): boolean {
  return !!value && value.length >= minLength;
}

/**
 * Validates the configuration and returns explicit errors/warnings instead of
 * throwing (unit-testable). `index.ts` fails fast on any error before migrate.
 *
 * Production is strict: secrets must be real (32+ chars), PostgreSQL is
 * required, and the webhook allowlist must be present. Development gets
 * loud warnings instead so a fresh checkout still boots.
 */
export function validateConfig(appConfig: AppConfig = config): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [...parseWarnings];
  const prod = appConfig.isProduction;

  if (appConfig.databaseUrl && !/^postgres(ql)?:\/\//i.test(appConfig.databaseUrl)) {
    errors.push("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }

  if (prod) {
    if (!isSecret(appConfig.gatewaySecret ?? process.env.AFRICORE_GATEWAY_SECRET)) errors.push('AFRICORE_GATEWAY_SECRET is required in production (minimum 32 characters).');
    if (process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS && !isSecret(process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS)) errors.push('AFRICORE_GATEWAY_SECRET_PREVIOUS must contain at least 32 characters when set.');
    if (!appConfig.databaseUrl) errors.push("DATABASE_URL is required in production (PostgreSQL).");
    if (!isSecret(appConfig.adminToken)) errors.push("AFRISCORE_ADMIN_TOKEN is required in production (minimum 32 characters).");
    if (!isSecret(appConfig.idHashSalt)) errors.push("ID_HASH_SALT is required in production (minimum 32 characters).");
    if (!isSecret(appConfig.ledgerHmacKey)) errors.push("LEDGER_HMAC_KEY is required in production (minimum 32 characters).");
    if (!appConfig.webhookAllowedHosts) {
      errors.push("AFRISCORE_WEBHOOK_ALLOWED_HOSTS is required in production (comma-separated HTTPS hostnames).");
    } else if (appConfig.webhookAllowedHosts.split(",").some((host) => /[:/]/.test(host.trim()))) {
      warnings.push("AFRISCORE_WEBHOOK_ALLOWED_HOSTS entries must be bare hostnames (no scheme, path or port).");
    }
    if (appConfig.trustProxy === undefined) {
      warnings.push("TRUST_PROXY is unset in production; if you run behind a proxy every caller will share one rate-limit bucket.");
    }
    if (appConfig.logLevel === "debug") {
      warnings.push("LOG_LEVEL=debug in production increases log volume and may expose request metadata.");
    }
  } else {
    // Development / test: insecure defaults are allowed, but say so loudly.
    if (!isSecret(appConfig.adminToken)) {
      warnings.push("AFRISCORE_ADMIN_TOKEN is unset or shorter than 32 characters; admin routes will return 503.");
    }
    if (!appConfig.idHashSalt) {
      warnings.push("ID_HASH_SALT is unset; PII hashes use the public development salt. Never use this data in production.");
    }
    if (!appConfig.ledgerHmacKey) {
      warnings.push("LEDGER_HMAC_KEY is unset; ledger anchors fall back to ID_HASH_SALT (or a public dev key).");
    }
    if (!appConfig.databaseUrl) {
      warnings.push(`DATABASE_URL is unset; using SQLite at ${appConfig.dbPath}.`);
    }
    if (!appConfig.webhookAllowedHosts) {
      warnings.push("AFRISCORE_WEBHOOK_ALLOWED_HOSTS is unset; webhook target hosts are not restricted outside production.");
    }
  }

  return { errors, warnings };
}

/** Throws a single actionable error when configuration is invalid. */
export function assertConfigValid(appConfig: AppConfig = config): void {
  const { errors } = validateConfig(appConfig);
  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n${errors.map((e) => ` - ${e}`).join("\n")}`);
  }
}
