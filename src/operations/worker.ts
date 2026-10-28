import { dbAll,dbGet } from '../db';
import { runAutomations } from './automation';
import { all } from './store';
import { sync } from './integrations';
import type { Access } from '../platform/auth';
import { logger } from '../logging';
let busy = false;
export async function processOperations() {
  if (busy) return { busy: true };
  busy = true;
  try {
    const orgs = await dbAll(
      'SELECT id FROM ac_organizations ORDER BY created_at',
    );
    let processed = 0,
      failed = 0;
    for (const org of orgs) {
      for (const environment of ['sandbox', 'production']) {
        const a: Access = {
          org: org.id,
          environment,
          actor: 'stage2_worker',
          role: 'system',
          api: false,
        };
        try {
          const enabled=async(service:string)=>!!await dbGet("SELECT e.service_id FROM ac_service_entitlements e JOIN ac_services s ON s.id=e.service_id WHERE e.org_id=? AND e.environment=? AND e.service_id=? AND e.status='active' AND s.enabled=1",[a.org,a.environment,service]);
          if(await enabled('automations'))await runAutomations(a);
          for (const c of (await enabled('connect')?await all(a, 'connectors'):[]).filter(
            (c) =>
              c.status === 'retrying' &&
              c.next_retry_at <= new Date().toISOString(),
          ))
            await sync(a, c.id);
          processed++;
        } catch {
          failed++;
          logger.error('stage2_workspace_failed', {
            org_id: org.id,
            environment,
            code: 'execution_failed',
          });
        }
      }
    }
    return { processed, failed };
  } finally {
    busy = false;
  }
}
