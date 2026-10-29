import {migrateConnected} from '../operations/connected-schema';
import {migrateApps} from '../apps/schema';
import {migrateBusinessOperations} from '../operations/business-schema';
import {migrateFinance} from '../finance/schema';
import { migrateTrust } from '../trust/schema';
import {migrateSecurity} from '../platform/security-schema';
import {migrateMarketplace} from '../marketplace/schema';
import { migrateOperations } from '../operations/schema';
import { migratePlatform } from '../platform/schema';
import { migrateAccounts } from '../platform/accounts-schema';
import { migrateWorkspaceExperiences } from '../platform/workspace-schema';
import { dbExec, isPostgres, rawSqliteDb } from "./adapter";

// Table/column types here (TEXT, REAL, INTEGER) are valid in both SQLite
// and PostgreSQL, so one schema string works for both engines — the only
// engine-specific handling needed is the two ADD-COLUMN migration guards
// below, since SQLite and Postgres differ on ALTER TABLE ... IF NOT EXISTS.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    legal_name TEXT NOT NULL,
    trading_name TEXT,
    registration_number TEXT,
    kra_pin TEXT,
    jurisdiction TEXT DEFAULT 'KE',
    industry TEXT,
    sector TEXT,
    status TEXT DEFAULT 'pending_verification',
    trust_score REAL DEFAULT 0,
    is_sandbox INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS persons (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    national_id_hash TEXT,
    phone_hash TEXT,
    status TEXT DEFAULT 'pending_verification',
    is_sandbox INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ledger (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    seq INTEGER,
    hash_version INTEGER NOT NULL DEFAULT 2,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_subject ON ledger (subject_type, subject_id, created_at);

  -- Current chain head per subject, plus a keyed anchor (HMAC) over the head
  -- so deleting trailing ledger rows or rewriting the chain is detectable by
  -- a verifier that does not share the server's key. See ledgerService.
  CREATE TABLE IF NOT EXISTS ledger_heads (
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    entry_count INTEGER NOT NULL,
    head_hash TEXT NOT NULL,
    anchor_hmac TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (subject_type, subject_id)
  );

  CREATE TABLE IF NOT EXISTS consents (
    id TEXT PRIMARY KEY,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    grantee TEXT NOT NULL,
    purpose TEXT NOT NULL,
    scope TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    granted_at TEXT NOT NULL,
    revoked_at TEXT,
    expires_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_consents_subject ON consents (subject_type, subject_id);

  CREATE TABLE IF NOT EXISTS api_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    api_key_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    account_identifier TEXT NOT NULL,
    status TEXT DEFAULT 'connected',
    scenario TEXT,
    connected_at TEXT NOT NULL,
    disconnected_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_accounts_business ON accounts (business_id);
  -- One live connection per (business, provider, account): prevents the same
  -- upstream account from being connected twice and double-ingesting.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique
    ON accounts (business_id, provider, account_identifier);

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    -- Discriminator for the dual-mode product: 'business' for merchant data,
    -- 'individual' reserved for person-scoped statement ingestion. Existing
    -- rows are business rows, hence the default.
    subject_type TEXT NOT NULL DEFAULT 'business',
    external_id TEXT NOT NULL,
    -- NUMERIC(18,2) keeps money exact on PostgreSQL (REAL there is float4 and
    -- silently loses cents). SQLite maps NUMERIC to its numeric affinity, so
    -- one schema string still works on both engines.
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    type TEXT NOT NULL,
    counterparty TEXT,
    category TEXT,
    status TEXT NOT NULL,
    source_provider TEXT NOT NULL,
    raw_status TEXT,
    occurred_at TEXT NOT NULL,
    statement_id TEXT,
    shortcode TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (account_id, external_id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_business ON transactions (business_id, occurred_at);

  CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT NOT NULL,
    event_pattern TEXT NOT NULL,
    target_url TEXT NOT NULL,
    environment TEXT NOT NULL DEFAULT 'live',
    status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    subject_type TEXT,
    subject_id TEXT,
    is_sandbox INTEGER DEFAULT 0,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    delivery_attempts INTEGER DEFAULT 0,
    last_delivery_status TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events (event_type, created_at);

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    invoice_number TEXT,
    customer_reference TEXT NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    currency TEXT DEFAULT 'KES',
    issue_date TEXT NOT NULL,
    due_date TEXT,
    -- Invoice lifecycle: draft -> sent -> partially_paid -> paid, with overdue
    -- derived from due_date. Legacy rows used 'unpaid', treated as 'sent'.
    status TEXT DEFAULT 'sent',
    matched_transaction_id TEXT,
    expected_counterparty TEXT,
    paid_amount NUMERIC(18,2),
    attachment_file_name TEXT,
    attachment_sha256 TEXT,
    attachment_size_bytes INTEGER,
    created_at TEXT NOT NULL,
    paid_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices (business_id, status);

  -- One row per recorded receipt (manual or auto-matched from a transaction).
  -- Sum(amount) is the authoritative amount paid on an invoice; invoices
  -- .paid_amount mirrors it for cheap reads.
  CREATE TABLE IF NOT EXISTS invoice_payments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    transaction_id TEXT,
    amount NUMERIC(18,2) NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    paid_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (invoice_id, transaction_id)
  );

  CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments (invoice_id, paid_at);

  -- Business track: a business can have several M-Pesa till/paybill shortcodes
  -- (and bank accounts), each of which can have statements uploaded over time.
  CREATE TABLE IF NOT EXISTS business_shortcodes (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    type TEXT NOT NULL,
    shortcode TEXT NOT NULL,
    label TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (business_id, type, shortcode)
  );

  CREATE INDEX IF NOT EXISTS idx_business_shortcodes_business ON business_shortcodes (business_id);

  CREATE TABLE IF NOT EXISTS statements (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    shortcode TEXT,
    file_name TEXT,
    content_sha256 TEXT NOT NULL,
    period_start TEXT,
    period_end TEXT,
    status TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    row_count INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    duplicate_count INTEGER DEFAULT 0,
    uploaded_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_statements_business ON statements (business_id, uploaded_at);

  -- Explicit, opt-in link between an individual borrower profile and a
  -- business profile. Absence of a row means the two profiles are isolated.
  CREATE TABLE IF NOT EXISTS business_links (
    id TEXT PRIMARY KEY,
    person_id TEXT NOT NULL,
    business_id TEXT NOT NULL,
    requested_by TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (person_id, business_id)
  );

  -- Orbit orchestration: workflow state machine + transition history.
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    state TEXT NOT NULL,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_workflows_subject ON workflows (subject_type, subject_id, created_at);

  CREATE TABLE IF NOT EXISTS workflow_events (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    event TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow ON workflow_events (workflow_id, seq);

  -- Jobs that exhausted retries; consumed by the DLQ worker.
  CREATE TABLE IF NOT EXISTS dead_letter_jobs (
    id TEXT PRIMARY KEY,
    queue TEXT NOT NULL,
    workflow_id TEXT,
    subject_type TEXT,
    subject_id TEXT,
    name TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts_made INTEGER NOT NULL,
    error_message TEXT NOT NULL,
    failed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_dead_letter_subject ON dead_letter_jobs (subject_type, subject_id, failed_at);

  -- Incoming payments the matching worker could not reconcile to an invoice.
  CREATE TABLE IF NOT EXISTS unmatched_payments (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    transaction_id TEXT,
    amount NUMERIC(18,2) NOT NULL,
    reference TEXT,
    counterparty TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_unmatched_payments_business ON unmatched_payments (business_id, status, created_at);
`;

export async function migrate(): Promise<void> {
  await dbExec(SCHEMA);
  await migratePlatform();
  await migrateOperations();
  await migrateTrust();
  await migrateAccounts();
  await migrateWorkspaceExperiences();
  await migrateSecurity();
  await migrateMarketplace();
  await migrateFinance();
  await migrateConnected();
  await migrateApps();
  await migrateBusinessOperations();

  if (isPostgres) {
    await dbExec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS matched_invoice_id TEXT;`);
    await dbExec(`ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS secret TEXT;`);
    await dbExec(`ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS client_id TEXT;`);
    await dbExec(`ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'live';`);
    await dbExec(`ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS subject_type TEXT;`);
    await dbExec(`ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS subject_id TEXT;`);
    await dbExec(`ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS is_sandbox INTEGER DEFAULT 0;`);
    await dbExec(`ALTER TABLE ledger ADD COLUMN IF NOT EXISTS seq INTEGER;`);
    await dbExec(`ALTER TABLE ledger ADD COLUMN IF NOT EXISTS hash_version INTEGER NOT NULL DEFAULT 1;`);
    await dbExec(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_sandbox INTEGER DEFAULT 0;`);
    await dbExec(`ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_sandbox INTEGER DEFAULT 0;`);
    await dbExec(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS scenario TEXT;`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS expected_counterparty TEXT;`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(18,2);`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number TEXT;`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachment_file_name TEXT;`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachment_sha256 TEXT;`);
    await dbExec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER;`);
    await dbExec(`ALTER TABLE api_clients ADD COLUMN IF NOT EXISTS revoked_at TEXT;`);
    await dbExec(`ALTER TABLE consents ADD COLUMN IF NOT EXISTS expires_at TEXT;`);
    await dbExec(`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS sector TEXT;`);
    await dbExec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subject_type TEXT NOT NULL DEFAULT 'business';`);
    await dbExec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS statement_id TEXT;`);
    await dbExec(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS shortcode TEXT;`);

    // Money precision: REAL on PostgreSQL is float4 and loses cents. These
    // rewrites are idempotent; existing values are rounded to 2 decimals.
    await dbExec(`ALTER TABLE transactions ALTER COLUMN amount TYPE NUMERIC(18,2) USING round(amount::numeric, 2);`);
    await dbExec(`ALTER TABLE invoices ALTER COLUMN amount TYPE NUMERIC(18,2) USING round(amount::numeric, 2);`);
  } else {
    const guard = (table: string, column: string, ddl: string) => {
      const cols = rawSqliteDb!.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!cols.some((c) => c.name === column)) {
        rawSqliteDb!.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };
    guard("transactions", "matched_invoice_id", "matched_invoice_id TEXT");
    guard("webhook_subscriptions", "secret", "secret TEXT");
    guard("webhook_subscriptions", "client_id", "client_id TEXT");
    guard("webhook_subscriptions", "environment", "environment TEXT NOT NULL DEFAULT 'live'");
    guard("webhook_events", "subject_type", "subject_type TEXT");
    guard("webhook_events", "subject_id", "subject_id TEXT");
    guard("webhook_events", "is_sandbox", "is_sandbox INTEGER DEFAULT 0");
    guard("ledger", "seq", "seq INTEGER");
    guard("ledger", "hash_version", "hash_version INTEGER NOT NULL DEFAULT 1");
    guard("businesses", "is_sandbox", "is_sandbox INTEGER DEFAULT 0");
    guard("persons", "is_sandbox", "is_sandbox INTEGER DEFAULT 0");
    guard("accounts", "scenario", "scenario TEXT");
    guard("invoices", "expected_counterparty", "expected_counterparty TEXT");
    guard("invoices", "paid_amount", "paid_amount NUMERIC(18,2)");
    guard("invoices", "invoice_number", "invoice_number TEXT");
    guard("invoices", "attachment_file_name", "attachment_file_name TEXT");
    guard("invoices", "attachment_sha256", "attachment_sha256 TEXT");
    guard("invoices", "attachment_size_bytes", "attachment_size_bytes INTEGER");
    guard("api_clients", "revoked_at", "revoked_at TEXT");
    guard("consents", "expires_at", "expires_at TEXT");
    guard("businesses", "sector", "sector TEXT");
    guard("transactions", "subject_type", "subject_type TEXT NOT NULL DEFAULT 'business'");
    guard("transactions", "statement_id", "statement_id TEXT");
    guard("transactions", "shortcode", "shortcode TEXT");
  }

  // Service-level guards (both engines).
  //
  // A subject's chain must never fork, so a predecessor hash may only appear
  // once per subject. On a database that already contains a fork (pre-upgrade
  // data), the index cannot be created; we log and continue so the migration
  // is not fatal, and verification reports the fork explicitly.
  try {
    await dbExec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_prev ON ledger (subject_type, subject_id, prev_hash);`);
  } catch {
    console.warn(JSON.stringify({ level: "warn", event: "migration_skipped", index: "idx_ledger_prev", reason: "existing_forked_chain" }));
  }
  try {
    await dbExec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_unique ON accounts (business_id, provider, account_identifier);`);
  } catch {
    console.warn(JSON.stringify({ level: "warn", event: "migration_skipped", index: "idx_accounts_unique", reason: "existing_duplicate_accounts" }));
  }
}


export { dbGet, dbAll, dbRun, dbExec, dbTransaction, inTransaction, isPostgres, closeDb } from "./adapter";
