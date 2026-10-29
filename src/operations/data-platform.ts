import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {dbAll,dbRun} from '../db';
import {Access,audit,fail} from '../platform/auth';
import {now,hash} from '../platform/crypto';
import {financialOperation,canonical} from '../finance/service';
import {entitlement,checkLimits,recordUsage} from '../marketplace/engine';
import {emit} from './events';
export const dataImportInput=z.object({
 source_id:z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
 purpose:z.string().trim().min(10).max(500),authorized:z.literal(true),
 rows:z.array(z.object({external_id:z.string().trim().min(1).max(150),amount_minor:z.number().int().positive().max(100000000000),currency:z.enum(['KES','USD','EUR','GBP','UGX','TZS','RWF']),type:z.enum(['inflow','outflow']),occurred_at:z.string().datetime({offset:true})}).strict()).min(1).max(1000),
}).strict();
export async function importAuthorizedData(a:Access,input:unknown,key:string){
 const d=dataImportInput.parse(input);
 if(a.api)fail(403,'A human member must authorize a file import');
 if(new Set(d.rows.map(r=>r.external_id)).size!==d.rows.length)fail(400,'Duplicate source identifiers in this batch');
 return financialOperation(a,'data.import',key,d,async()=>{
  const existing=new Map<string,string>();
  // Bounded set lookups avoid a provider/database round trip for every CSV row.
  for(let i=0;i<d.rows.length;i+=250){const ids=d.rows.slice(i,i+250).map(r=>r.external_id);const rows=await dbAll('SELECT source_record_id,fingerprint FROM ac_data_lineage WHERE org_id=? AND environment=? AND source_id=? AND source_record_id IN ('+ids.map(()=>'?').join(',')+')',[a.org,a.environment,d.source_id,...ids]);for(const row of rows)existing.set(row.source_record_id,row.fingerprint);}
  const pending:any[]=[];let duplicates=0;
  for(const sourceRow of d.rows){
   const row={...sourceRow,occurred_at:new Date(sourceRow.occurred_at).toISOString()};
   if(Date.parse(row.occurred_at)>Date.now()+300000)fail(400,'Source dates cannot be in the future');
   const fingerprint=hash(canonical(row)),old=existing.get(row.external_id);
   if(old){if(old!==fingerprint)fail(409,'Source record changed; resolve the conflict without overwriting history');duplicates++;}
   else pending.push({...row,fingerprint,record_id:randomUUID()});
  }
  const service=(await entitlement(a,'data'))?.status==='active'?'data':'connect';
  if(pending.length)await checkLimits(a,service,service==='data'?pending.length:1);
  const stamp=now(),id=randomUUID();
  // 75 rows keeps each statement below the conservative 999 SQLite parameter floor.
  for(let i=0;i<pending.length;i+=75){
   const chunk=pending.slice(i,i+75),records:any[]=[],lineage:any[]=[];
   for(const row of chunk){const {fingerprint,record_id,...r}=row;
    records.push(record_id,a.org,a.environment,'transactions',JSON.stringify({...r,source:d.source_id,provenance:'merchant_imported',provider_verified:false,processing_status:'recorded',imported_at:stamp,imported_by:a.actor,import_batch_id:id,normalization_version:'canonical-transactions-v1'}),stamp,stamp);
    lineage.push(randomUUID(),a.org,a.environment,d.source_id,r.external_id,record_id,fingerprint,'canonical-transactions-v1',r.occurred_at,stamp);
   }
   await dbRun('INSERT INTO ac_records(id,org_id,environment,kind,data,created_at,updated_at) VALUES '+chunk.map(()=>'(?,?,?,?,?,?,?)').join(','),records);
   await dbRun('INSERT INTO ac_data_lineage(id,org_id,environment,source_id,source_record_id,record_id,fingerprint,transformation_version,occurred_at,imported_at) VALUES '+chunk.map(()=>'(?,?,?,?,?,?,?,?,?,?)').join(','),lineage);
  }
  if(pending.length)await recordUsage(a,service,'data-import:'+id,service==='data'?pending.length:1,'authorized_normalization_completed');
  await audit(a.org,a.actor,'data.import_authorized',id);
  await emit(a,'data.sync_completed',{id,source_id:d.source_id,imported:pending.length,duplicates,purpose:d.purpose,assurance:'merchant_imported'},{key:'data-import:'+id});
  return {id,imported:pending.length,duplicates,classification:'merchant_imported',provider_verified:false};
 });
}
export async function dataQuality(a:Access,limit=50,offset=0){
 const sources=await dbAll('SELECT source_id,COUNT(*) AS records,MAX(imported_at) AS last_sync,MAX(occurred_at) AS latest_occurrence FROM ac_data_lineage WHERE org_id=? AND environment=? GROUP BY source_id ORDER BY source_id',[a.org,a.environment]);
 const rows=await dbAll('SELECT id,source_id,source_record_id,record_id,transformation_version,occurred_at,imported_at FROM ac_data_lineage WHERE org_id=? AND environment=? ORDER BY imported_at DESC,id DESC LIMIT ? OFFSET ?',[a.org,a.environment,limit,offset]);
 return {sources:sources.map(s=>({...s,records:Number(s.records),assurance:'merchant_imported',stale:Date.parse(s.last_sync)<Date.now()-30*86400000})),data:rows,limit,offset,limitations:'Authorized imports retain their origin; they do not establish bank verification, revenue, profit or payment confirmation. Conflicting source identities are rejected, never silently overwritten.'};
}
