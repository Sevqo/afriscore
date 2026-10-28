import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureTestEnv} from './helpers';
configureTestEnv('marketplace');
import {migrate,dbGet,dbAll,dbRun,closeDb} from '../db';
import {createApp} from '../app';
import {reserve,finishReservation,correction,publishPrice,estimate,recordUsage} from '../marketplace/engine';
import {evaluationPrice} from '../marketplace/schema';
import type {Access} from '../platform/auth';
import {workspaceRouteKinds} from '../platform/workspace-capabilities';
import {policyFor} from '../marketplace/policy';
let server:ReturnType<ReturnType<typeof createApp>['listen']>,base:string,cookie:string,org:string,actor:string;
async function request(path:string,method='GET',body?:unknown,session=cookie){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:session},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json() as any,cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
const path=(suffix:string)=>'/api/v1/organizations/'+org+suffix;
const access=():Access=>({org,actor,role:'owner',api:false,environment:'sandbox'});
before(async()=>{
 await migrate();server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+(server.address() as any).port;
 const signup=await request('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-marketplace-fixture-2026!'});assert.equal(signup.status,201);cookie=signup.cookie;
 assert.equal((await request('/api/auth/verify','POST',{token:signup.data.verification_token})).status,200);
 actor=(await request('/api/auth/account')).data.user.id;
 const workspace=await request('/api/auth/workspaces','POST',{kind:'business',name:'Synthetic marketplace fixture',display_name:'Fixture owner',country:'KE',currency:'KES',timezone:'Africa/Nairobi'});assert.equal(workspace.status,201);org=workspace.data.id;
});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await closeDb();});
test('all declared workspace routes have an explicit product or foundation policy',()=>{
 for(const key of Object.keys(workspaceRouteKinds)){const [method,route]=key.split(' ');if(route.includes('/records/:kind'))continue;assert.ok(policyFor(method,route),key);}
 assert.equal(policyFor('POST','/organizations/:org/unknown'),undefined);
});
test('new workspace starts without optional services; foundation and included customer entry work',async()=>{
 const catalog=await request(path('/services'));assert.equal(catalog.status,200);assert.equal(catalog.data.workspace_id,org);assert.equal(catalog.data.services.filter((s:any)=>s.entitlement).length,0);
 assert.equal((await request(path('/report'))).status,200);
 assert.equal((await request(path('/records/customers'),'POST',{name:'Requires selection'})).status,402);
 assert.equal((await request(path('/services/invoicing/activate'),'POST',{})).status,200);
 assert.equal((await request(path('/records/customers'),'POST',{name:'Included customer entry'})).status,201);
 assert.equal((await request(path('/services/credentials/activate'),'POST',{})).status,409);
 assert.equal((await request(path('/services/payments/activate'),'POST',{})).status,200);
});
test('parallel reservations enforce a hard quantity cap and release failures',async()=>{
 assert.equal((await request(path('/usage/limits/invoicing'),'PUT',{monthly_budget_minor:null,quantity_limit:1,hard_stop:true,thresholds:[100]})).status,200);
 const competing=await Promise.allSettled([reserve(access(),'invoicing'),reserve(access(),'invoicing')]);assert.equal(competing.filter(r=>r.status==='fulfilled').length,1);
 const winner=competing.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<string>;
 await finishReservation(access(),winner.value,false,'failed-fixture','fixture');
 const retry=await reserve(access(),'invoicing');await finishReservation(access(),retry,true,'fixture-issued-invoice','fixture');
 await finishReservation(access(),retry,true,'fixture-issued-invoice','fixture');
 assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac_usage_events WHERE org_id=?',[org])).n),1);
 const event=await dbGet('SELECT * FROM ac_usage_events WHERE org_id=?',[org]);
 await assert.rejects(correction({...access(),role:'operator'},event.id,2,'Synthetic over-correction fixture'),/exceeds/);
 await correction({...access(),role:'operator'},event.id,1,'Synthetic correction fixture');
 assert.equal(Number((await dbGet('SELECT SUM(quantity) AS n FROM ac_usage_events WHERE org_id=?',[org])).n),0);
 const usage=await request(path('/usage'));assert.equal(usage.data.amount_due_minor,0);assert.equal(usage.data.collection_enabled,false);
});
test('deactivation retains records, stops writes and keeps authorized historical reads',async()=>{
 assert.equal((await request(path('/services/invoicing/deactivate'),'POST',{confirm:true})).status,200);
 const rows=await request(path('/records/customers'));assert.equal(rows.status,200);assert.equal(rows.data.data.length,1);
 assert.equal((await request(path('/records/customers'),'POST',{name:'Off service denied'})).status,402);
 assert.equal((await request(path('/services/credentials/activate'),'POST',{},'')).status,401);
});
test('price versions are immutable, reactivation requires confirmation, and cancellation history determines fixed estimates',async()=>{
 const operator={...access(),role:'operator'},price={...evaluationPrice('invoicing'),model:'flat',version:'synthetic-flat-v1',fixed_minor:100,effective_at:'2026-01-01T00:00:00.000Z'};
 await publishPrice(operator,price);await assert.rejects(publishPrice(operator,price),/immutable/);
 assert.equal((await request(path('/services/invoicing/activate'),'POST',{})).status,409);
 assert.equal((await request(path('/services/invoicing/activate'),'POST',{confirm_price_version:price.version})).status,200);
 let row=(await dbAll("SELECT id,data FROM ac_service_history WHERE org_id=? AND service_id='invoicing' AND action='activated'",[org])).find(row=>JSON.parse(row.data).price_version===price.version);
 await dbRun('UPDATE ac_service_history SET created_at=? WHERE id=?',['2026-01-15T00:00:00.000Z',row!.id]);
 assert.equal((await request(path('/services/invoicing/deactivate'),'POST',{confirm:true})).status,200);
 row=await dbGet("SELECT id FROM ac_service_history WHERE org_id=? AND service_id='invoicing' AND action='deactivated' ORDER BY created_at DESC LIMIT 1",[org]);
 await dbRun('UPDATE ac_service_history SET created_at=? WHERE id=?',['2026-02-10T00:00:00.000Z',row!.id]);
 await request(path('/services/invoicing/preferences'),'PATCH',{favorite:true,position:0});
 assert.equal((await estimate(access(),'2026-01')).estimated_minor,100);
 assert.equal((await estimate(access(),'2026-02')).estimated_minor,100);
 assert.equal((await estimate(access(),'2026-03')).estimated_minor,0);
 await publishPrice(operator,{...price,version:'synthetic-flat-v2',fixed_minor:900});
 assert.equal((await estimate(access(),'2026-01')).estimated_minor,100);
 assert.equal((await estimate(access(),'2026-01')).amount_due_minor,0);
 // The shared PostgreSQL test database is reused by later journey suites.
 // Publish a free fixture successor; retain both historical price versions.
 await publishPrice(operator,{...evaluationPrice('invoicing'),version:'zz-synthetic-restored-free',effective_at:'2026-01-01T00:00:00.000Z'});
});
test('usage corrections cannot move a charge across tenant, period or service',async()=>{
 const event=await dbGet('SELECT * FROM ac_usage_events WHERE org_id=? AND quantity>0',[org]);
 await assert.rejects(recordUsage({...access(),role:'operator'},'payments','invalid-cross-service',-1,'internal_correction',event.price_id,event.id,event.period),/price|scope/);
 await assert.rejects(recordUsage(access(),'invoicing','invalid-customer-correction',-1,'customer',event.price_id,event.id,event.period),/internal/);
 const alerts=await dbGet("SELECT COUNT(*) AS n FROM ac2_notifications WHERE org_id=? AND category='service_usage'",[org]);assert.ok(Number(alerts.n)>=1);
});
test('Personal Expenses operates without Business products and persists in foundation reporting',async()=>{
 const w=await request('/api/auth/workspaces','POST',{kind:'personal',name:'Independent personal fixture',display_name:'Fixture owner'});assert.equal(w.status,201);const root='/api/v1/organizations/'+w.data.id;
 const catalog=await request(root+'/services');assert.ok(!catalog.data.services.some((s:any)=>s.id==='passport'));assert.equal(catalog.data.services.filter((s:any)=>s.entitlement).length,0);
 assert.equal((await request(root+'/services/expenses/activate','POST',{})).status,200);
 const expense=await request(root+'/expenses','POST',{description:'Independent expense fixture',amount_minor:1234,currency:'KES',occurred_on:'2026-10-01',category:'stock'});assert.equal(expense.status,201);
 assert.equal((await request(root+'/personal-summary?currency=KES')).data.recorded_expenses_minor,1234);
 assert.equal((await request(root+'/services/passport/activate','POST',{})).status,403);
 assert.equal((await request(root+'/expenses')).data.data[0].id,expense.data.id);
});
test('Developer API entitlement is enforced for keys, usage is scoped and revocation remains available after deactivation',async()=>{
 const w=await request('/api/auth/workspaces','POST',{kind:'developer',name:'Independent developer fixture',display_name:'Fixture owner'});assert.equal(w.status,201);const root='/api/v1/organizations/'+w.data.id;
 for(const service of ['developer_api','invoicing'])assert.equal((await request(root+'/services/'+service+'/activate','POST',{})).status,200);
 const app=await request(root+'/records/applications','POST',{name:'Synthetic API application'});assert.equal(app.status,201);
 const key=await request(root+'/credentials','POST',{application_id:app.data.id,scopes:['read']});assert.equal(key.status,201);
 const call=()=>fetch(base+root+'/records/customers',{headers:{Authorization:'Bearer '+key.data.key,'X-Environment':'sandbox'}});
 let response=await call();assert.equal(response.status,200);await response.arrayBuffer();
 assert.equal(Number((await dbGet("SELECT SUM(quantity) AS n FROM ac_usage_events WHERE org_id=? AND service_id='developer_api'",[w.data.id])).n),1);
 assert.equal((await request(root+'/services/developer_api/deactivate','POST',{confirm:true})).status,200);
 response=await call();assert.equal(response.status,402);await response.arrayBuffer();
 assert.equal((await request(root+'/credentials/'+key.data.id,'DELETE',{})).status,200);
});
