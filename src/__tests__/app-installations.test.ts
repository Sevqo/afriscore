import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureTestEnv} from './helpers';
configureTestEnv('app-installations');
import {migrate,dbGet,dbAll,dbRun,closeDb} from '../db';
import {createApp} from '../app';
let server:any,base:string,cookie='',org='',actor='';
async function api(p:string,method='GET',body?:any,session=cookie,key=randomUUID()) {const response=await fetch(base+p,{method,headers:{Cookie:session,'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
const path=(suffix:string)=>'/api/v1/organizations/'+org+suffix;
async function install(id:string,optional:string[]=[]){const preview=await api(path('/apps/'+id+'/installation-preview')+(optional.length?'?optional='+optional.join(','):''));assert.equal(preview.status,200,JSON.stringify(preview.data));const body={review_hash:preview.data.review_hash,optional_services:optional};const result=await api(path('/apps/'+id+'/install'),'POST',body);assert.equal(result.status,200,JSON.stringify(result.data));return result;}
before(async()=>{await migrate();server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;const signup=await api('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-business-app-test-2026!'});cookie=signup.cookie;await api('/api/auth/verify','POST',{token:signup.data.verification_token});actor=(await api('/api/auth/account')).data.user.id;const workspace=await api('/api/auth/workspaces','POST',{kind:'business',name:'Synthetic business app install',display_name:'Fixture owner',services:[]});assert.equal(workspace.status,201);org=workspace.data.id;});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await closeDb();});
test('one reviewed installation activates canonical entitlements with no duplicated or metered installation',async()=>{
 const preview=await api(path('/apps/finance/installation-preview?optional=payments,reconciliation'));assert.equal(preview.status,200);assert.equal(preview.data.installation_fee_minor,0);assert.equal(preview.data.services.length,5);
 const body={review_hash:preview.data.review_hash,optional_services:['payments','reconciliation']},key=randomUUID();const first=await api(path('/apps/finance/install'),'POST',body,cookie,key);assert.equal(first.status,200,JSON.stringify(first.data));const replay=await api(path('/apps/finance/install'),'POST',body,cookie,key);assert.deepEqual(replay.data,first.data);
 assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac_service_entitlements WHERE org_id=?',[org])).n),5);
 assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac_app_history WHERE org_id=?',[org])).n),1);
 assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac_usage_events WHERE org_id=?',[org])).n),0);
 assert.equal((await api(path('/services/invoicing/deactivate'),'POST',{confirm:true})).status,409);
});
test('shared and direct activation origins survive uninstall, while sole services can stop without deleting records',async()=>{
 await install('crm');await install('sales');await api(path('/services/customers/activate'),'POST',{});
 const customer=await api(path('/records/customers'),'POST',{name:'Shared customer'});assert.equal(customer.status,201);
 const preview=await api(path('/apps/crm/uninstallation-preview'));const removed=await api(path('/apps/crm/uninstall'),'POST',{review_hash:preview.data.review_hash,service_action:'deactivate_sole'});assert.equal(removed.status,200,JSON.stringify(removed.data));assert.ok(removed.data.kept_services.includes('customers'));assert.ok(removed.data.deactivated_services.includes('crm'));
 assert.equal((await api(path('/records/customers/'+customer.data.id))).status,200);
 const finance=await api(path('/apps/finance/uninstallation-preview'));const result=await api(path('/apps/finance/uninstall'),'POST',{review_hash:finance.data.review_hash,service_action:'keep'});assert.equal(result.status,200);assert.equal((await dbGet("SELECT status FROM ac_service_entitlements WHERE org_id=? AND service_id='invoicing'",[org])).status,'active');
 assert.ok((await dbAll("SELECT * FROM ac_service_activation_sources WHERE org_id=? AND service_id='invoicing'",[org])).some(s=>s.source_type==='direct'));
});
test('stale review, paid price change, nonadministrator and cross-workspace requests cannot install',async()=>{
 const preview=await api(path('/apps/inventory/installation-preview'));await dbRun("UPDATE ac_services SET version=version+1 WHERE id='inventory'");try{assert.equal((await api(path('/apps/inventory/install'),'POST',{review_hash:preview.data.review_hash,optional_services:[]})).status,409);}finally{await dbRun("UPDATE ac_services SET version=version-1 WHERE id='inventory'");}
 const other=await api('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-other-app-user-2026!'});assert.equal((await api(path('/apps/analytics/install'),'POST',{review_hash:'a'.repeat(64),optional_services:[]},other.cookie)).status,403);
 const user=(await api('/api/auth/account','GET',undefined,other.cookie)).data.user.id;await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'viewer')",[org,user]);assert.equal((await api(path('/apps/analytics/installation-preview'),'GET',undefined,other.cookie)).status,403);
 const originalPrices=await dbAll("SELECT version,data FROM ac_service_prices WHERE service_id='intelligence'");const paidPreview=await api(path('/apps/analytics/installation-preview'));await dbRun("UPDATE ac_service_prices SET data=? WHERE service_id='intelligence'",[JSON.stringify({service_id:'intelligence',version:'changed-paid',currency:'KES',model:'metered',unit:'analysis requests',included:0,unit_minor:100,fixed_minor:0,tiers:[],minimum_minor:0,cap_minor:null,period:'monthly',effective_at:'2026-10-28T00:00:00.000Z',expires_at:null,tax_treatment:'Fixture',description:'Fixture price'})]);try{assert.equal((await api(path('/apps/analytics/install'),'POST',{review_hash:paidPreview.data.review_hash,optional_services:[]})).status,409);}finally{for(const row of originalPrices)await dbRun("UPDATE ac_service_prices SET data=? WHERE service_id='intelligence' AND version=?",[row.data,row.version]);}
});
test('dependency deactivation order is safe and a direct dependent preserves its required product service',async()=>{
 await install('inventory');await api(path('/services/inventory/activate'),'POST',{});const preview=await api(path('/apps/inventory/uninstallation-preview'));assert.ok(preview.data.services.find((s:any)=>s.id==='products').shared);const result=await api(path('/apps/inventory/uninstall'),'POST',{review_hash:preview.data.review_hash,service_action:'deactivate_sole'});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal((await dbGet("SELECT status FROM ac_service_entitlements WHERE org_id=? AND service_id='products'",[org])).status,'active');
});
test('app compatibility denies Developer installations and offers a limited Personal registry',async()=>{
 const personal=await api('/api/auth/workspaces','POST',{kind:'personal',name:'Fixture personal',display_name:'Fixture personal',services:[]});assert.equal(personal.status,201);const pp='/api/v1/organizations/'+personal.data.id;const catalog=await api(pp+'/apps');assert.deepEqual(catalog.data.apps.map((a:any)=>a.id),['finance','analytics']);assert.equal((await api(pp+'/apps/sales/installation-preview')).status,403);
 const developer=await api('/api/auth/workspaces','POST',{kind:'developer',name:'Fixture developer',display_name:'Fixture developer',services:[]});assert.equal(developer.status,201);assert.equal((await api('/api/v1/organizations/'+developer.data.id+'/apps')).status,403);
});
