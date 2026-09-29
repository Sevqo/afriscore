import crypto from "crypto";
import { randomUUID } from "node:crypto";
import { dbGet, dbAll, dbRun } from "../db";

export interface ApiClient {
  id: string;
  name: string;
  api_key_hash: string;
  created_at: string;
  revoked_at?: string | null;
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

/** Creates a new API client. Returns the raw API key exactly once — only
 *  the hash is persisted, so this is the caller's only chance to see it. */
export async function createApiClient(name: string): Promise<{ client: Omit<ApiClient, "api_key_hash">; apiKey: string }> {
  const rawKey = `ak_${crypto.randomBytes(24).toString("hex")}`;
  const client: ApiClient = {
    id: randomUUID(),
    name,
    api_key_hash: hashKey(rawKey),
    created_at: new Date().toISOString(),
  };

  await dbRun(
    `INSERT INTO api_clients (id, name, api_key_hash, created_at) VALUES (@id, @name, @api_key_hash, @created_at)`,
    client
  );

  return { client: { id: client.id, name: client.name, created_at: client.created_at }, apiKey: rawKey };
}

export async function verifyApiKey(rawKey: string): Promise<ApiClient | undefined> {
  const hash = hashKey(rawKey);
  return dbGet<ApiClient>(`SELECT * FROM api_clients WHERE api_key_hash = ? AND revoked_at IS NULL`, [hash]);
}

export async function listApiClients(): Promise<Omit<ApiClient, "api_key_hash">[]> {
  return dbAll(`SELECT id, name, created_at, revoked_at FROM api_clients ORDER BY created_at DESC`);
}

export async function revokeApiClient(id: string) {
  const client = await dbGet<ApiClient>(`SELECT * FROM api_clients WHERE id = ?`, [id]);
  if (!client) return undefined;
  const revokedAt = new Date().toISOString();
  await dbRun(`UPDATE api_clients SET revoked_at = ? WHERE id = ?`, [revokedAt, id]);
  return { id: client.id, name: client.name, revoked_at: revokedAt };
}

export async function rotateApiClient(id: string) {
  const client = await dbGet<ApiClient>(`SELECT * FROM api_clients WHERE id = ? AND revoked_at IS NULL`, [id]);
  if (!client) return undefined;
  const apiKey = `ak_${crypto.randomBytes(24).toString("hex")}`;
  await dbRun(`UPDATE api_clients SET api_key_hash = ? WHERE id = ? AND revoked_at IS NULL`, [hashKey(apiKey), id]);
  return { client: { id: client.id, name: client.name }, apiKey };
}
