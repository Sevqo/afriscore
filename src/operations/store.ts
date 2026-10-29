import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { dbAll, dbGet, dbRun, dbTransaction } from '../db';
import { Access, audit, fail } from '../platform/auth';
import { now } from '../platform/crypto';
export const kinds = [
  'forecast_snapshots',
  'expenses',
  'obligations',
  'automations',
  'shipments',
  'protected_sales',
  'disputes',
  'connectors',
  'risk_reviews',
  'notification_preferences',
] as const;
export type Kind = (typeof kinds)[number];
export interface DomainObject {
  id: string;
  org_id: string;
  environment: string;
  kind: Kind;
  version: number;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}
export const day = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
export const addDays = (date: string, n: number) =>
  new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000)
    .toISOString()
    .slice(0, 10);
export { minor } from './contracts';
export async function atomic<T>(a: Access, fn: () => Promise<T>): Promise<T> {
  return dbTransaction(async () => {
    await dbRun('UPDATE ac_organizations SET name=name WHERE id=?', [a.org]);
    return fn();
  });
}
function decode(row: any): DomainObject {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    org_id: row.org_id,
    environment: row.environment,
    kind: row.kind,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
export async function list(a: Access, kind: Kind, limit = 100, offset = 0) {
  return (
    await dbAll(
      'SELECT * FROM ac2_objects WHERE org_id=? AND environment=? AND kind=? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [a.org, a.environment, kind, limit, offset],
    )
  ).map(decode);
}
export async function all(a: Access, kind: Kind) {
  return (
    await dbAll(
      'SELECT * FROM ac2_objects WHERE org_id=? AND environment=? AND kind=? ORDER BY created_at',
      [a.org, a.environment, kind],
    )
  ).map(decode);
}
export async function get(a: Access, id: string, kind?: Kind) {
  const row = await dbGet(
    'SELECT * FROM ac2_objects WHERE id=? AND org_id=? AND environment=?' +
      (kind ? ' AND kind=?' : ''),
    [id, a.org, a.environment, ...(kind ? [kind] : [])],
  );
  if (!row) fail(404, 'Resource not found');
  return decode(row);
}
export async function create(
  a: Access,
  kind: Kind,
  data: Record<string, unknown>,
  id: string = randomUUID(),
) {
  const stamp = now();
  await dbRun(
    'INSERT INTO ac2_objects(id,org_id,environment,kind,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [id, a.org, a.environment, kind, JSON.stringify(data), stamp, stamp],
  );
  await audit(a.org, a.actor, kind + '.created', id);
  return get(a, id, kind);
}
export async function change(
  a: Access,
  object: DomainObject,
  data: Record<string, unknown>,
) {
  const {
    id,
    org_id,
    environment,
    kind,
    version,
    created_at,
    updated_at,
    ...rest
  } = object;
  const result = await dbRun(
    'UPDATE ac2_objects SET data=?,version=version+1,updated_at=? WHERE id=? AND org_id=? AND environment=? AND version=?',
    [
      JSON.stringify({ ...rest, ...data }),
      now(),
      id,
      a.org,
      a.environment,
      version,
    ],
  );
  if (!result.changes) fail(409, 'Resource changed; reload before retry');
  return get(a, id, kind);
}
export async function legacy(a: Access, kind: string) {
  return (
    await dbAll(
      'SELECT id,data,created_at FROM ac_records WHERE org_id=? AND environment=? AND kind=? ORDER BY created_at',
      [a.org, a.environment, kind],
    )
  ).map((r) => ({ ...JSON.parse(r.data), id: r.id, created_at: r.created_at }));
}
export function safeCSV(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map(
          (v) =>
            '"' +
            String(v ?? '')
              .replace(/^[=+@\-\t\r]/, "'")
              .replace(/"/g, '""') +
            '"',
        )
        .join(','),
    )
    .join('\r\n');
}
