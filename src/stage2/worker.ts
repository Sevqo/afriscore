import { dbAll } from '../db';
import { runAutomations } from './automation';
import { all } from './store';
import { sync } from './integrations';
import type { Access } from '../platform/auth';
let busy = false;
export async function processStage2() {
  if (busy) return { busy: true };
  busy = true;
  try {
    const orgs = await dbAll(
      'SELECT id FROM ac_organizations ORDER BY created_at',
    );
    let processed = 0;
    for (const org of orgs) {
      for (const environment of ['sandbox', 'production']) {
        const a: Access = {
          org: org.id,
          environment,
          actor: 'stage2_worker',
          role: 'system',
          api: false,
        };
        await runAutomations(a);
        for (const c of (await all(a, 'connectors')).filter(
          (c) =>
            c.status === 'retrying' &&
            c.next_retry_at <= new Date().toISOString(),
        ))
          await sync(a, c.id);
        processed++;
      }
    }
    return { processed };
  } finally {
    busy = false;
  }
}
