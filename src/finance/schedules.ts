import {randomUUID} from 'node:crypto';
import {dbAll,dbGet,dbRun,dbTransaction} from '../db';
import {emit} from '../operations/events';
import {now} from '../platform/crypto';
let busy=false,offset=0;
/** In-app reminders only. Plans never create an expense or move funds automatically. */
export async function processFinancialSchedules(at=new Date()){
 if(busy)return {processed:0};busy=true;let processed=0;
 try{
  const rows=await dbAll("SELECT o.* FROM ac2_objects o JOIN ac_service_entitlements e ON e.org_id=o.org_id AND e.environment=o.environment AND e.service_id='cash_flow' JOIN ac_services s ON s.id=e.service_id LEFT JOIN ac_workspaces w ON w.id=o.org_id WHERE o.kind='obligations' AND e.status='active' AND s.enabled=1 AND (w.status IS NULL OR w.status='active') ORDER BY o.id LIMIT 500 OFFSET ?",[offset]);offset=rows.length===500?offset+500:0;
  for(const row of rows){const o=JSON.parse(row.data);if(o.status!=='active')continue;const day=new Intl.DateTimeFormat('en-CA',{timeZone:o.timezone||'Africa/Nairobi'}).format(at),days=Math.floor((Date.parse(o.next_due_date)-Date.parse(day))/86400000);if(days>(o.reminder_days??3))continue;
   await dbTransaction(async()=>{await dbRun('UPDATE ac_organizations SET name=name WHERE id=?',[row.org_id]);const current=await dbGet('SELECT version,data FROM ac2_objects WHERE id=? AND org_id=? AND environment=?',[row.id,row.org_id,row.environment]);if(!current||current.version!==row.version||JSON.parse(current.data).status!=='active')return;if(!await dbGet("SELECT e.service_id FROM ac_service_entitlements e JOIN ac_services s ON s.id=e.service_id WHERE e.org_id=? AND e.environment=? AND e.service_id='cash_flow' AND e.status='active' AND s.enabled=1",[row.org_id,row.environment]))return;const key='obligation-due:'+row.id+':'+o.next_due_date,a={org:row.org_id,environment:row.environment,actor:'financial_schedule',role:'system',api:false};await emit(a,'obligation.due',{id:row.id,due_on:o.next_due_date,classification:'planned_obligation'},{key});
    const members=await dbAll("SELECT user_id FROM ac_memberships WHERE org_id=? AND role IN ('owner','admin','finance')",[row.org_id]);for(const member of members)await dbRun("INSERT INTO ac2_notifications(id,org_id,environment,user_id,category,title,body,resource_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,user_id,dedupe_key) DO NOTHING",[randomUUID(),row.org_id,row.environment,member.user_id,'cash_flow','Upcoming obligation',o.description+' is due '+o.next_due_date+'. This is a plan, not a paid expense.',row.id,key,now()]);
   });processed++;
  }return {processed};
 }finally{busy=false;}
}
