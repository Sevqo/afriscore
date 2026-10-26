import { dbAll, dbRun } from '../db';
import { now } from '../platform/crypto';
import { emit } from '../stage2/events';
import { runAnchorQueue } from './proofs';
import { flags } from './store';
let busy = false;
export async function processTrust() {
  if (busy || !flags().passport_beta) return;
  busy = true;
  try {
    for (const row of await dbAll(
      "SELECT id,org_id,environment FROM ac3_credentials WHERE status='active' AND valid_until<? LIMIT 100",
      [now()],
    )) {
      const result = await dbRun(
        "UPDATE ac3_credentials SET status='expired' WHERE id=? AND status='active'",
        [row.id],
      );
      if (result.changes)
        await emit(
          {
            org: row.org_id,
            environment: row.environment,
            actor: 'trust-worker',
            role: 'system',
            api: false,
          },
          'credential.expired',
          { id: row.id },
        );
    }
    await runAnchorQueue();
  } finally {
    busy = false;
  }
}
