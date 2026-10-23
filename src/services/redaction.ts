import { LedgerEntry } from "./ledgerService";

/**
 * Trust-record endpoints are gated by the `trust_score` scope. That scope
 * promises a verification/trust judgement — not the underlying KYC file — so
 * ledger `event_data` is projected to a per-event-type whitelist before it is
 * returned to a partner. Anything not listed (financial amounts, legal names,
 * registration numbers, identifiers) is omitted, and identifier columns are
 * never returned at all (only present/absent booleans).
 */
const SAFE_EVENT_DATA: Record<string, string[]> = {
  "verification.checks_run": ["checks"],
  "verification.status_changed": ["from", "to"],
  "score.updated": ["trust_score"],
  "consent.granted": ["grantee", "purpose", "scope"],
  "consent.revoked": ["grantee"],
};

export interface RedactedLedgerEvent {
  id: string;
  event_type: string;
  created_at: string;
  entry_hash: string;
  seq?: number | null;
  data: Record<string, unknown>;
}

function projectEventData(eventType: string, raw: string): Record<string, unknown> {
  const allowed = SAFE_EVENT_DATA[eventType];
  if (!allowed) return {};
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const field of allowed) {
    if (parsed[field] !== undefined) out[field] = parsed[field];
  }
  return out;
}

export function redactLedgerEvents(entries: LedgerEntry[]): RedactedLedgerEvent[] {
  return entries.map((entry) => ({
    id: entry.id,
    event_type: entry.event_type,
    created_at: entry.created_at,
    entry_hash: entry.entry_hash,
    seq: entry.seq ?? null,
    data: projectEventData(entry.event_type, entry.event_data),
  }));
}
