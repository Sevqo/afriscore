import crypto, { timingSafeEqual } from "node:crypto";
import { randomUUID } from "node:crypto";
import { dbGet, dbAll, dbRun, dbTransaction, isPostgres } from "../db";

/**
 * Hash-chained, HMAC-anchored trust ledger.
 *
 * Every event is appended as a row whose hash covers the previous entry's
 * hash, so any change to an earlier entry invalidates every later one.
 *
 * Two additions make the chain meaningfully tamper-evident rather than
 * merely tamper-suggesting:
 *
 *  1. A monotonic per-subject `seq`, hashed into each v2 entry, fixes the
 *     ordering ambiguity of ISO timestamps (two appends in the same
 *     millisecond used to tie) and a UNIQUE(subject_type, subject_id,
 *     prev_hash) index makes a forked chain physically unstorable.
 *  2. `ledger_heads` stores the current head hash, entry count and an
 *     HMAC-SHA256 over both, keyed with LEDGER_HMAC_KEY. Verification
 *     compares the recomputed chain against that anchor, so deleting the
 *     tail of the ledger (or rewriting every hash from scratch) is detected
 *     by anyone who does not hold the server key — including a database-only
 *     attacker. Pre-upgrade rows keep hash_version 1 and are still verified
 *     with the original unkeyed scheme.
 */

const GENESIS_HASH = "0".repeat(64);
const HASH_VERSION_V2 = 2;
const DEV_LEDGER_KEY = "afriscore-dev-ledger-key";

export interface LedgerEntry {
  id: string;
  subject_type: string;
  subject_id: string;
  event_type: string;
  event_data: string;
  prev_hash: string;
  entry_hash: string;
  seq?: number | null;
  hash_version?: number;
  created_at: string;
}

interface LedgerHead {
  subject_type: string;
  subject_id: string;
  entry_count: number;
  head_hash: string;
  anchor_hmac: string;
  updated_at: string;
}

export interface ChainVerification {
  valid: boolean;
  brokenAt?: string;
  reason?: string;
  entryCount: number;
  anchored: boolean;
}

function ledgerKey(): string {
  const key = process.env.LEDGER_HMAC_KEY || process.env.ID_HASH_SALT;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("LEDGER_HMAC_KEY is not set — refusing to write an unkeyed ledger in production.");
    }
    return DEV_LEDGER_KEY;
  }
  return key;
}

/** v1 (pre-upgrade) hash: what older rows were written with. */
function hashLegacy(prevHash: string, subjectType: string, subjectId: string, eventType: string, eventData: string, createdAt: string): string {
  const payload = `${prevHash}|${subjectType}|${subjectId}|${eventType}|${eventData}|${createdAt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/** v2 hash: includes the entry id and sequence number. */
function hashV2(
  prevHash: string,
  id: string,
  seq: number,
  subjectType: string,
  subjectId: string,
  eventType: string,
  eventData: string,
  createdAt: string
): string {
  const payload = `${HASH_VERSION_V2}|${prevHash}|${id}|${seq}|${subjectType}|${subjectId}|${eventType}|${eventData}|${createdAt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function anchorFor(subjectType: string, subjectId: string, entryCount: number, headHash: string): string {
  return crypto
    .createHmac("sha256", ledgerKey())
    .update(`${subjectType}|${subjectId}|${entryCount}|${headHash}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "23505" || !!e?.message?.includes("UNIQUE constraint failed");
}

async function getHead(subjectType: string, subjectId: string): Promise<LedgerHead | undefined> {
  return dbGet<LedgerHead>(`SELECT * FROM ledger_heads WHERE subject_type = ? AND subject_id = ?`, [subjectType, subjectId]);
}

async function getLastEntry(subjectType: string, subjectId: string): Promise<LedgerEntry | undefined> {
  return dbGet<LedgerEntry>(
    `SELECT * FROM ledger WHERE subject_type = ? AND subject_id = ? ORDER BY COALESCE(seq, 0) DESC, created_at DESC, id DESC LIMIT 1`,
    [subjectType, subjectId]
  );
}

async function countEntries(subjectType: string, subjectId: string): Promise<number> {
  const row = await dbGet<{ c: number | string }>(`SELECT COUNT(*) AS c FROM ledger WHERE subject_type = ? AND subject_id = ?`, [
    subjectType,
    subjectId,
  ]);
  return Number(row?.c ?? 0);
}

/**
 * Append a new tamper-evident event to a subject's trust ledger.
 * Atomic with the head update; concurrent appenders can never fork the chain
 * (SQLite is serialised, PostgreSQL retries on the predecessor UNIQUE index).
 */
export async function appendEvent(
  subjectType: "business" | "person",
  subjectId: string,
  eventType: string,
  eventData: object
): Promise<LedgerEntry> {
  const dataStr = JSON.stringify(eventData);
  let attempt = 0;

  for (;;) {
    try {
      return await dbTransaction(async () => {
        // Serialise appends per subject. SQLite is already serialised by the
        // adapter's mutex; PostgreSQL needs an explicit per-subject lock or
        // two concurrent appends can read the same predecessor and race the
        // UNIQUE(subject_type, subject_id, prev_hash) index into a retry storm.
        if (isPostgres) {
          await dbRun(`SELECT pg_advisory_xact_lock(hashtext(?))`, [`ledger:${subjectType}:${subjectId}`]);
        }

        const head = await getHead(subjectType, subjectId);
        const last = head ? undefined : await getLastEntry(subjectType, subjectId);
        const prevHash = head ? head.head_hash : last ? last.entry_hash : GENESIS_HASH;
        const entryCount = head ? Number(head.entry_count) : last ? await countEntries(subjectType, subjectId) : 0;
        const seq = entryCount + 1;
        const createdAt = new Date().toISOString();
        const id = randomUUID();
        const entryHash = hashV2(prevHash, id, seq, subjectType, subjectId, eventType, dataStr, createdAt);

        const entry: LedgerEntry = {
          id,
          subject_type: subjectType,
          subject_id: subjectId,
          event_type: eventType,
          event_data: dataStr,
          prev_hash: prevHash,
          entry_hash: entryHash,
          seq,
          hash_version: HASH_VERSION_V2,
          created_at: createdAt,
        };

        await dbRun(
          `INSERT INTO ledger (id, subject_type, subject_id, event_type, event_data, prev_hash, entry_hash, seq, hash_version, created_at)
           VALUES (@id, @subject_type, @subject_id, @event_type, @event_data, @prev_hash, @entry_hash, @seq, @hash_version, @created_at)`,
          entry
        );

        const headHash = entryHash;
        await dbRun(
          `INSERT INTO ledger_heads (subject_type, subject_id, entry_count, head_hash, anchor_hmac, updated_at)
           VALUES (@subject_type, @subject_id, @entry_count, @head_hash, @anchor_hmac, @updated_at)
           ON CONFLICT (subject_type, subject_id) DO UPDATE SET
             entry_count = excluded.entry_count,
             head_hash = excluded.head_hash,
             anchor_hmac = excluded.anchor_hmac,
             updated_at = excluded.updated_at`,
          {
            subject_type: subjectType,
            subject_id: subjectId,
            entry_count: seq,
            head_hash: headHash,
            anchor_hmac: anchorFor(subjectType, subjectId, seq, headHash),
            updated_at: createdAt,
          }
        );

        return entry;
      });
    } catch (err) {
      // A concurrent append on PostgreSQL can win the predecessor unique
      // index between our read and our insert. Recompute and retry briefly.
      if (isUniqueViolation(err) && attempt < 3) {
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

export async function getLedger(subjectType: "business" | "person", subjectId: string): Promise<LedgerEntry[]> {
  return dbAll<LedgerEntry>(
    `SELECT * FROM ledger WHERE subject_type = ? AND subject_id = ? ORDER BY COALESCE(seq, 0) ASC, created_at ASC, id ASC`,
    [subjectType, subjectId]
  );
}

/**
 * Re-walks the chain, checks sequencing and validates the keyed head anchor.
 * Returns valid:false (with the offending entry) when any entry was altered,
 * removed, reordered, or when the tail was truncated.
 */
export async function verifyChainIntegrity(
  subjectType: "business" | "person",
  subjectId: string
): Promise<ChainVerification> {
  const entries = await getLedger(subjectType, subjectId);
  const head = await getHead(subjectType, subjectId);

  let expectedPrev = GENESIS_HASH;
  let expectedSeq: number | null = null;
  let sawV2 = false;

  for (const entry of entries) {
    if (entry.prev_hash !== expectedPrev) {
      return { valid: false, brokenAt: entry.id, reason: "prev_hash_mismatch", entryCount: entries.length, anchored: !!head };
    }

    const version = Number(entry.hash_version ?? 1);
    if (version >= HASH_VERSION_V2) {
      sawV2 = true;
      const seq = Number(entry.seq);
      if (!Number.isInteger(seq) || seq < 1) {
        return { valid: false, brokenAt: entry.id, reason: "missing_seq", entryCount: entries.length, anchored: !!head };
      }
      if (expectedSeq !== null && seq !== expectedSeq) {
        return { valid: false, brokenAt: entry.id, reason: "seq_gap", entryCount: entries.length, anchored: !!head };
      }
      expectedSeq = seq + 1;
    }

    const recomputed =
      version >= HASH_VERSION_V2
        ? hashV2(
            entry.prev_hash,
            entry.id,
            Number(entry.seq),
            entry.subject_type,
            entry.subject_id,
            entry.event_type,
            entry.event_data,
            entry.created_at
          )
        : hashLegacy(entry.prev_hash, entry.subject_type, entry.subject_id, entry.event_type, entry.event_data, entry.created_at);

    if (recomputed !== entry.entry_hash) {
      return { valid: false, brokenAt: entry.id, reason: "hash_mismatch", entryCount: entries.length, anchored: !!head };
    }

    expectedPrev = entry.entry_hash;
  }

  // Post-upgrade chains must be anchored; a missing anchor row means it was
  // deleted, so the chain cannot be trusted.
  if (!head) {
    if (sawV2) {
      return { valid: false, reason: "missing_anchor", entryCount: entries.length, anchored: false };
    }
    return { valid: true, entryCount: entries.length, anchored: false };
  }

  if (Number(head.entry_count) !== entries.length) {
    return { valid: false, reason: "entry_count_mismatch", entryCount: entries.length, anchored: true };
  }

  const computedHead = entries.length ? entries[entries.length - 1].entry_hash : GENESIS_HASH;
  if (computedHead !== head.head_hash) {
    return { valid: false, reason: "head_mismatch", entryCount: entries.length, anchored: true };
  }

  let expectedAnchor: string;
  try {
    expectedAnchor = anchorFor(subjectType, subjectId, Number(head.entry_count), head.head_hash);
  } catch (err) {
    return { valid: false, reason: "anchor_key_unavailable", entryCount: entries.length, anchored: true };
  }
  if (!safeEqual(expectedAnchor, head.anchor_hmac)) {
    return { valid: false, reason: "anchor_mismatch", entryCount: entries.length, anchored: true };
  }

  return { valid: true, entryCount: entries.length, anchored: true };
}
