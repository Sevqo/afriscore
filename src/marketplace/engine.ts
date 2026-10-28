import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {dbAll,dbGet,dbRun,dbTransaction} from '../db/adapter';
import type {Access} from '../platform/auth';
import type {ServiceDefinition} from './catalog';
import {costMinor,priceInput,type Price} from './pricing';
function reject(status:number,message:string):never{throw Object.assign(new Error(message),{status});}
const stamp=()=>new Date().toISOString();
export const billingPeriod=(value=new Date())=>value.toISOString().slice(0,7);
export const collection={enabled:false,provider:'unconfigured',async collect():Promise<never>{return reject(503,'Customer charging is disabled; no authorized collection provider is configured');}};
export async function lockWorkspace(org:string){if(!(await dbRun('UPDATE ac_organizations SET name=name WHERE id=?',[org])).changes)reject(404,'Workspace not found');}
async function currentManager(a:Access){
 const row=await dbGet('SELECT m.role,w.status FROM ac_memberships m LEFT JOIN ac_workspaces w ON w.id=m.org_id WHERE m.org_id=? AND m.user_id=?',[a.org,a.actor]);
 if(a.api||!row||!['owner','admin'].includes(row.role)||row.status&&row.status!=='active')reject(403,'Current workspace owner or admin access is required');
}
async function history(a:Access,service:string,action:string,data:object={}){await dbRun('INSERT INTO ac_service_history(id,org_id,environment,service_id,actor,action,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,service,a.actor,action,JSON.stringify(data),stamp()]);}
export async function definitions(){return (await dbAll('SELECT * FROM ac_services ORDER BY id')).map(row=>({...JSON.parse(row.definition),enabled:!!row.enabled,version:row.version}) as ServiceDefinition&{enabled:boolean});}
export async function workspaceKind(org:string){return (await dbGet('SELECT kind FROM ac_workspaces WHERE id=?',[org]))?.kind||'business';}
export async function entitlement(a:Pick<Access,'org'|'environment'>,id:string){return dbGet('SELECT * FROM ac_service_entitlements WHERE org_id=? AND environment=? AND service_id=?',[a.org,a.environment,id]);}
export function setupReady(id:string){
 if(id==='assistant')return !!process.env.OPENAI_API_KEY&&!!process.env.AFRICORE_AI_MODEL&&process.env.AFRICORE_AI_DISABLED!=='true';
 if(id==='webhooks')return !!(process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS||'').split(',').find(h=>h.trim()&&h.trim()!=='disabled.invalid');
 return true;
}
async function eligiblePrice(id:string,at=stamp()){
 const rows=await dbAll('SELECT * FROM ac_service_prices WHERE service_id=? ORDER BY created_at DESC,id DESC',[id]);
 return rows.find(row=>{const p=JSON.parse(row.data);return p.effective_at<=at&&(!p.expires_at||p.expires_at>at);})||reject(409,'No effective price is published for this service');
}
export async function catalogFor(a:Access){
 const [kind,all,entitlements,prices]=await Promise.all([workspaceKind(a.org),definitions(),dbAll('SELECT * FROM ac_service_entitlements WHERE org_id=? AND environment=? ORDER BY position,service_id',[a.org,a.environment]),dbAll('SELECT * FROM ac_service_prices ORDER BY created_at DESC,id DESC')]);
 const defs=all.filter(s=>s.kinds.includes(kind));
 return {workspace_id:a.org,environment:a.environment,kind,collection_enabled:false,currency:'KES',services:defs.map(s=>{const e=entitlements.find(e=>e.service_id===s.id);const row=prices.find(p=>p.id===e?.price_id)||prices.find(p=>p.service_id===s.id&&JSON.parse(p.data).effective_at<=stamp()&&(!JSON.parse(p.data).expires_at||JSON.parse(p.data).expires_at>stamp()));return {...s,status:!s.enabled?'unavailable':e?.status||'available',entitlement:e?{status:e.status,favorite:!!e.favorite,position:e.position,activated_at:e.activated_at,updated_at:e.updated_at}:null,price:row?JSON.parse(row.data):null,setup_ready:setupReady(s.id)};}),foundation:['Identity','Workspaces','Account security','Team access','Basic reporting and exports','Account notifications','Audit history','Service discovery','Usage & Billing']};
}
export async function activate(a:Access,id:string,input:unknown={}){
 if(a.api||!['owner','admin'].includes(a.role))reject(403,'A workspace owner or admin must manage services');
 const d=z.object({confirm_price_version:z.string().max(60).optional()}).strict().parse(input);
 return dbTransaction(async()=>{
  await lockWorkspace(a.org);
  await currentManager(a);
  const s=(await definitions()).find(s=>s.id===id);if(!s||!s.enabled)reject(404,'Service is unavailable');
  if(!s.kinds.includes(await workspaceKind(a.org)))reject(403,'Service is not eligible for this workspace type');
  if(s.availability==='unavailable')reject(409,'Service is not available for activation');
  if(a.environment==='production'&&s.availability==='evaluation')reject(409,'This product supports test operations only; live activation is unavailable');
  for(const dep of s.dependencies)if((await entitlement(a,dep))?.status!=='active')reject(409,'Activate the disclosed dependency first: '+dep);
  const current=await entitlement(a,id);
  if(current?.status==='suspended')reject(403,'Service is suspended; request an access review');
  if(current?.status==='active'&&setupReady(id))return {service_id:id,status:'active',existing:true};
  const price=current&&current.status!=='disabled'?await dbGet('SELECT * FROM ac_service_prices WHERE id=?',[current.price_id]):await eligiblePrice(id);
  const p:Price=JSON.parse(price.data);
  if(p.model!=='free'&&!Number((await dbGet('SELECT verified FROM ac_users WHERE id=?',[a.actor]))?.verified))reject(403,'Verify your email before activating a non-free estimate plan');
  if(p.model!=='free'&&d.confirm_price_version!==p.version)reject(409,'Review and explicitly confirm this price version before activation');
  const status=setupReady(id)?'active':'requires_setup',at=stamp();
  await dbRun('INSERT INTO ac_service_entitlements(org_id,environment,service_id,status,price_id,activated_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,service_id) DO UPDATE SET status=excluded.status,price_id=excluded.price_id,activated_at=excluded.activated_at,updated_at=excluded.updated_at',[a.org,a.environment,id,status,price.id,at,at]);
  await history(a,id,'activated',{status,price_version:p.version,charging_enabled:false});
  return {service_id:id,status,existing:!!current,charging_enabled:false};
 });
}
export async function deactivate(a:Access,id:string,input:unknown){
 if(a.api||!['owner','admin'].includes(a.role))reject(403,'A workspace owner or admin must manage services');
 z.object({confirm:z.literal(true)}).strict().parse(input);
 return dbTransaction(async()=>{
  await lockWorkspace(a.org);await currentManager(a);const e=await entitlement(a,id);if(!e)reject(404,'Service was not activated');
  if(e.status==='suspended')reject(403,'Suspension requires an internal access review');
  const dependents=(await definitions()).filter(s=>s.dependencies.includes(id));
  for(const s of dependents)if((await entitlement(a,s.id))?.status==='active')reject(409,'Deactivate dependent service first: '+s.name);
  const pending=await dbGet("SELECT COUNT(*) AS total FROM ac_usage_reservations WHERE org_id=? AND environment=? AND service_id=? AND status='reserved'",[a.org,a.environment,id]);
  // In-progress reservations remain accountable. A crash fails closed until reviewed.
  if(Number(pending.total))reject(409,'An operation is in progress. Wait for completion or request review before deactivation.');
  if(id==='automations'){
   const running=await dbGet("SELECT COUNT(*) AS total FROM ac2_runs WHERE org_id=? AND environment=? AND status='running'",[a.org,a.environment]);if(Number(running.total))reject(409,'A workflow is running; wait before deactivating');
   await dbRun("UPDATE ac2_runs SET status='cancelled',updated_at=? WHERE org_id=? AND environment=? AND status IN ('pending','retrying')",[stamp(),a.org,a.environment]);
  }
  await dbRun("UPDATE ac_service_entitlements SET status='disabled',updated_at=? WHERE org_id=? AND environment=? AND service_id=?",[stamp(),a.org,a.environment,id]);
  await history(a,id,'deactivated',{history_retained:true,provider_disconnected:false,collection_enabled:false});
  return {status:'disabled',history_retained:true,message:'New service operations stopped. Authorized historical reads and exports remain available. No external subscription or collection was started.'};
 });
}
export async function requireServices(a:Access,ids:string[],readOnly=false){
 if(!ids.length)return;
 const rows=await dbAll('SELECT e.service_id,e.status,s.enabled FROM ac_service_entitlements e JOIN ac_services s ON s.id=e.service_id WHERE e.org_id=? AND e.environment=?',[a.org,a.environment]);
 if(!rows.some(e=>ids.includes(e.service_id)&&e.enabled&&(e.status==='active'||readOnly&&['disabled','requires_setup'].includes(e.status))))reject(402,'Activate the required service in Explore Services: '+ids.join(' or '));
}
export async function estimate(a:Pick<Access,'org'|'environment'>,period=billingPeriod()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))reject(400,'Invalid billing period');
 const events=await dbAll('SELECT service_id,price_id,SUM(quantity) AS quantity FROM ac_usage_events WHERE org_id=? AND environment=? AND period=? GROUP BY service_id,price_id',[a.org,a.environment,period]);
 const lifecycle=await dbAll("SELECT service_id,action,data,created_at,id FROM ac_service_history WHERE org_id=? AND environment=? AND action IN ('activated','deactivated','suspended','legacy_access.preserved') ORDER BY created_at,id",[a.org,a.environment]);
 const prices=await dbAll('SELECT * FROM ac_service_prices'),lines:any[]=[];
 const groups=new Map(events.map(e=>[e.service_id+'\0'+e.price_id,e]));
 const end=new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),1)).toISOString(),start=period+'-01T00:00:00.000Z';
 for(let i=0;i<lifecycle.length;i++){
  const event=lifecycle[i],data=JSON.parse(event.data);
  if(!['activated','legacy_access.preserved'].includes(event.action)||data.status!=='active'||event.created_at>=end)continue;
  const next=lifecycle.slice(i+1).find(e=>e.service_id===event.service_id);
  if(event.created_at<start&&next&&next.created_at<=start)continue;
  const priceId=event.service_id+':'+data.price_version,key=event.service_id+'\0'+priceId;
  groups.set(key,groups.get(key)||{service_id:event.service_id,price_id:priceId,quantity:0});
 }
 for(const g of groups.values()){
  const row=prices.find(p=>p.id===g.price_id);if(!row)reject(503,'Historical price is unavailable');const p:Price=JSON.parse(row.data),quantity=Math.max(0,Number(g.quantity));
  lines.push({service_id:g.service_id,price_version:p.version,price_id:row.id,model:p.model,currency:p.currency,unit:p.unit,quantity,included:p.included,remaining_allowance:Math.max(0,p.included-quantity),estimated_minor:costMinor(p,quantity)});
 }
 const total=lines.reduce((sum,l)=>sum+BigInt(l.estimated_minor),0n);if(total>BigInt(Number.MAX_SAFE_INTEGER))reject(503,'Aggregate estimate exceeds supported precision');
 return {period,currency:'KES',classification:'estimate',collection_enabled:false,amount_due_minor:0,estimated_minor:Number(total),lines};
}
export async function limitsFor(a:Access){return dbAll('SELECT * FROM ac_service_limits WHERE org_id=? AND environment=?',[a.org,a.environment]);}
export async function setLimit(a:Access,service:string,input:unknown){
 if(a.api||!['owner','admin'].includes(a.role))reject(403,'Owner or admin required');
 const d=z.object({monthly_budget_minor:z.number().int().min(0).max(1e9).nullable(),quantity_limit:z.number().int().min(0).max(1e9).nullable(),hard_stop:z.boolean(),thresholds:z.array(z.number().int().min(1).max(100)).min(1).max(10)}).strict().parse(input);
 if(service!=='all'&&!(await definitions()).some(s=>s.id===service))reject(404,'Unknown service');
 return dbTransaction(async()=>{await lockWorkspace(a.org);await dbRun('INSERT INTO ac_service_limits(org_id,environment,service_id,monthly_budget_minor,quantity_limit,hard_stop,thresholds) VALUES (?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,service_id) DO UPDATE SET monthly_budget_minor=excluded.monthly_budget_minor,quantity_limit=excluded.quantity_limit,hard_stop=excluded.hard_stop,thresholds=excluded.thresholds',[a.org,a.environment,service,d.monthly_budget_minor,d.quantity_limit,d.hard_stop?1:0,JSON.stringify([...new Set(d.thresholds)].sort((a,b)=>a-b))]);await history(a,service,'limit.updated',d);return d;});
}
export async function checkLimits(a:Access,id:string,quantity:number){
 const current=await estimate(a),reservations=await dbAll("SELECT service_id,price_id,SUM(quantity) AS quantity FROM ac_usage_reservations WHERE org_id=? AND environment=? AND status='reserved' GROUP BY service_id,price_id",[a.org,a.environment]);
 const target=await entitlement(a,id);if(!target)reject(402,'Service activation required');
 const prices=await dbAll('SELECT * FROM ac_service_prices');
 const projected=current.lines.map(l=>({...l}));
 for(const r of [...reservations,{service_id:id,price_id:target.price_id,quantity}]){
  let line=projected.find(l=>l.price_id===r.price_id);if(!line){const row=prices.find(p=>p.id===r.price_id);if(!row)reject(503,'Price unavailable');const p=JSON.parse(row.data);line={service_id:r.service_id,price_id:r.price_id,quantity:0,estimated_minor:0};projected.push(line);}
  line.quantity+=Number(r.quantity);line.estimated_minor=costMinor(JSON.parse(prices.find(p=>p.id===r.price_id)!.data),line.quantity);
 }
 for(const limit of await limitsFor(a)){
  const scoped=limit.service_id==='all'?projected:projected.filter(l=>l.service_id===limit.service_id),amount=scoped.reduce((s,l)=>s+l.estimated_minor,0),units=scoped.reduce((s,l)=>s+l.quantity,0);
  if(limit.hard_stop&&(limit.monthly_budget_minor!==null&&amount>Number(limit.monthly_budget_minor)||limit.quantity_limit!==null&&units>Number(limit.quantity_limit)))reject(429,'Workspace usage or spending limit reached');
 }
}
export async function reserve(a:Access,id:string,quantity=1){if(!Number.isSafeInteger(quantity)||quantity<1||quantity>1e9)reject(400,'Invalid reservation quantity');return dbTransaction(async()=>{await lockWorkspace(a.org);await requireServices(a,[id]);await checkLimits(a,id,quantity);const e=await entitlement(a,id),request=randomUUID();await dbRun('INSERT INTO ac_usage_reservations(id,org_id,environment,service_id,actor,quantity,price_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[request,a.org,a.environment,id,a.actor,quantity,e.price_id,'reserved',stamp(),stamp()]);return request;});}
export async function recordUsage(a:Access,id:string,key:string,quantity:number,source:string,priceId?:string,related?:string,period=billingPeriod()){
 return dbTransaction(async()=>{await lockWorkspace(a.org);
 if(!Number.isSafeInteger(quantity)||!quantity||Math.abs(quantity)>1e9)reject(400,'Invalid usage quantity');
 if(quantity<0&&(!related||a.role!=='operator'))reject(403,'Negative usage requires an internal audited correction');
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))reject(400,'Invalid billing period');
 const existing=await dbGet('SELECT * FROM ac_usage_events WHERE org_id=? AND environment=? AND service_id=? AND idempotency_key=?',[a.org,a.environment,id,key]);
 if(existing){if(Number(existing.quantity)!==quantity||existing.source!==source)reject(409,'Usage replay conflicts with recorded evidence');return existing;}
 const s=(await definitions()).find(s=>s.id===id);if(!s)reject(404,'Unknown service');
 const e=await entitlement(a,id),rowId=randomUUID();
 const selectedPrice=priceId||e?.price_id||id+':evaluation-v1';
 if(!await dbGet('SELECT id FROM ac_service_prices WHERE id=? AND service_id=?',[selectedPrice,id]))reject(409,'Usage price does not belong to this service');
 if(related){const original=await dbGet('SELECT * FROM ac_usage_events WHERE id=? AND org_id=? AND environment=? AND service_id=?',[related,a.org,a.environment,id]);if(!original||Number(original.quantity)<=0||original.period!==period||original.price_id!==selectedPrice)reject(409,'Correction must retain original scope, price and period');const corrections=await dbGet('SELECT COALESCE(SUM(quantity),0) AS quantity FROM ac_usage_events WHERE related_event_id=?',[related]);if(Number(original.quantity)+Number(corrections.quantity)+quantity<0)reject(409,'Correction exceeds original units');}
 await dbRun('INSERT INTO ac_usage_events(id,org_id,environment,service_id,meter_id,actor,occurred_at,period,quantity,unit,source,idempotency_key,price_id,related_event_id,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[rowId,a.org,a.environment,id,s.meter,a.actor,stamp(),period,quantity,s.unit,source,key,priceId||e?.price_id||id+':evaluation-v1',related||null,'{}']);
 await history(a,id,related?'usage.corrected':'usage.recorded',{event_id:rowId,quantity,source});
 return {id:rowId,quantity};
 });
}
export async function finishReservation(a:Access,reservation:string,success:boolean,key:string,source:string){return dbTransaction(async()=>{
 await lockWorkspace(a.org);const r=await dbGet('SELECT * FROM ac_usage_reservations WHERE id=? AND org_id=? AND environment=?',[reservation,a.org,a.environment]);if(!r||r.status!=='reserved')return;
 if(success)await recordUsage(a,r.service_id,key,Number(r.quantity),source,r.price_id);
 await dbRun('UPDATE ac_usage_reservations SET status=?,updated_at=? WHERE id=?',[success?'succeeded':'released',stamp(),reservation]);
 if(success)await raiseAlerts(a);
});}
export async function raiseAlerts(a:Access){
 const usage=await estimate(a);
 for(const limit of await limitsFor(a))for(const kind of ['quantity','spending']){
  const relevant=usage.lines.filter(l=>limit.service_id==='all'||l.service_id===limit.service_id),value=relevant.reduce((n,l)=>n+(kind==='quantity'?l.quantity:l.estimated_minor),0),ceiling=kind==='quantity'?limit.quantity_limit:limit.monthly_budget_minor;
  if(ceiling===null)continue;
  for(const threshold of JSON.parse(limit.thresholds))if(value>0&&value*100>=Number(ceiling)*threshold){
   const at=stamp(),key=['service-usage',limit.service_id,usage.period,threshold,kind].join(':');
   await dbRun('INSERT INTO ac_usage_alerts(id,org_id,environment,service_id,period,threshold,kind,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,service_id,period,threshold,kind) DO NOTHING',[randomUUID(),a.org,a.environment,limit.service_id,usage.period,threshold,kind,at]);
   const managers=await dbAll("SELECT user_id FROM ac_memberships WHERE org_id=? AND role IN ('owner','admin')",[a.org]);
   for(const member of managers)await dbRun('INSERT INTO ac2_notifications(id,org_id,environment,user_id,category,title,body,resource_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,user_id,dedupe_key) DO NOTHING',[randomUUID(),a.org,a.environment,member.user_id,'service_usage','Service usage threshold reached',`${limit.service_id} reached ${threshold}% of its ${kind} limit for ${usage.period}. Costs are evaluation estimates; collection remains disabled.`,null,key,at]);
  }
 }
}
export async function publishPrice(a:Access,input:unknown){if(a.role!=='operator')reject(403,'Internal operator required');const p=priceInput.parse(input);if(!(await definitions()).some(s=>s.id===p.service_id))reject(404,'Unknown service');const id=p.service_id+':'+p.version;await dbTransaction(async()=>{const inserted=await dbRun('INSERT INTO ac_service_prices(id,service_id,version,data,created_at) VALUES (?,?,?,?,?) ON CONFLICT(service_id,version) DO NOTHING',[id,p.service_id,p.version,JSON.stringify(p),stamp()]);if(!inserted.changes)reject(409,'Published price versions are immutable');await history(a,p.service_id,'price.published',{price_id:id});});return {id,collection_enabled:false};}
export async function correction(a:Access,eventId:string,quantity:number,reason:string){return dbTransaction(async()=>{
 await lockWorkspace(a.org);if(a.role!=='operator')reject(403,'Internal operator required');if(!Number.isSafeInteger(quantity)||quantity<1||reason.length<10)reject(400,'Positive correction and reason required');
 const event=await dbGet('SELECT * FROM ac_usage_events WHERE id=? AND org_id=? AND environment=?',[eventId,a.org,a.environment]);if(!event||Number(event.quantity)<=0)reject(404,'Original usage not found');
 const prior=await dbGet('SELECT COALESCE(SUM(quantity),0) AS total FROM ac_usage_events WHERE related_event_id=?',[eventId]);if(quantity>Number(event.quantity)+Number(prior.total))reject(409,'Correction exceeds original units');
 const result=await recordUsage(a,event.service_id,'correction:'+randomUUID(),-quantity,'internal_correction',event.price_id,event.id,event.period);await history(a,event.service_id,'correction.reason',{event_id:eventId,reason});return result;
});}
