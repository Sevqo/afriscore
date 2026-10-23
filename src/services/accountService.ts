import { randomUUID } from "node:crypto";
import { dbGet, dbAll, dbRun } from "../db";
import { getBusiness } from "./businessService";
import { appendEvent } from "./ledgerService";
import { emitEvent } from "./webhookService";

export interface Account {
  id: string;
  business_id: string;
  provider: string;
  account_identifier: string;
  status: string;
  scenario?: string;
  connected_at: string;
  disconnected_at?: string;
}

export async function connectAccount(
  businessId: string,
  provider: "mpesa" | "bank" | "sandbox",
  accountIdentifier: string,
  scenario?: string
): Promise<Account> {
  const business = await getBusiness(businessId);
  if (!business) throw new Error("business_not_found");

  // One live connection per upstream account: re-connecting the same
  // provider/account would ingest the same transactions twice and let one
  // payment settle two invoices.
  const existing = await dbGet<Account>(
    `SELECT * FROM accounts WHERE business_id = ? AND provider = ? AND account_identifier = ?`,
    [businessId, provider, accountIdentifier]
  );
  if (existing) throw new Error("account_already_connected");

  const account: Account = {
    id: randomUUID(),
    business_id: businessId,
    provider,
    account_identifier: accountIdentifier,
    status: "connected",
    scenario,
    connected_at: new Date().toISOString(),
  };

  await dbRun(
    `INSERT INTO accounts (id, business_id, provider, account_identifier, status, scenario, connected_at)
     VALUES (@id, @business_id, @provider, @account_identifier, @status, @scenario, @connected_at)`,
    account
  );

  await appendEvent("business", businessId, "account.connected", { account_id: account.id, provider, scenario });
  await emitEvent("account.connected", { account_id: account.id, business_id: businessId, provider }, {
    type: "business",
    id: businessId,
    is_sandbox: business.is_sandbox,
  });

  return account;
}

/** Disconnects an account. Historical transactions stay (they already
 *  happened), but the account can no longer be synced — fills in the
 *  `disconnected_at` column the schema always had but nothing set. */
export async function disconnectAccount(accountId: string, businessId?: string): Promise<Account> {
  const account = await getAccount(accountId);
  if (!account || (businessId && account.business_id !== businessId)) throw new Error("account_not_found");

  // Idempotent: disconnecting twice must not append duplicate audit events.
  if (account.status === "disconnected") return account;

  const business = await getBusiness(account.business_id);
  const now = new Date().toISOString();
  await dbRun(`UPDATE accounts SET status = 'disconnected', disconnected_at = ? WHERE id = ?`, [now, accountId]);
  await appendEvent("business", account.business_id, "account.disconnected", { account_id: accountId, provider: account.provider });
  await emitEvent("account.disconnected", { account_id: accountId, business_id: account.business_id }, {
    type: "business",
    id: account.business_id,
    is_sandbox: !!business?.is_sandbox,
  });

  return (await getAccount(accountId))!;
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return dbGet<Account>(`SELECT * FROM accounts WHERE id = ?`, [id]);
}

export async function listAccountsForBusiness(businessId: string): Promise<Account[]> {
  return dbAll<Account>(`SELECT * FROM accounts WHERE business_id = ? ORDER BY connected_at DESC`, [businessId]);
}
