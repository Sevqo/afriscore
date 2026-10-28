import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureTestEnv} from './helpers';
configureTestEnv('second-pass');
import {migrate,dbRun,dbGet,closeDb} from '../db';
import {askAssistant,aiQuotaDay,type ExplanationProvider} from '../operations/assistant';
import {activate} from '../marketplace/engine';
import {safeLogPath} from '../safe-log-path';
import {createWorkspace} from '../platform/accounts';
import type {Access} from '../platform/auth';
import {seal,unseal} from '../platform/crypto';
import {createHash,createCipheriv,randomBytes} from 'node:crypto';
import {publicWebhookAddress,resolveWebhookAddress,createWebhookTransport} from '../services/webhook-http';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {workspaceRouteAllowed,workspaceRouteKinds} from '../platform/workspace-capabilities';
import {syncManagedIdentity} from '../platform/neon-auth';
import {requestApproval,decideApproval,requireApproval} from '../operations/automation';
import {atomic,create,change} from '../operations/store';
import {subscribe,emitEvent,deliverLegacyWebhooks} from '../services/webhookService';
import {createBusiness} from '../services/businessService';
import {grantConsent} from '../services/consentService';
import {singleCurrency} from '../services/currency-integrity';
import {passwordIssue} from '../platform/password-strength';
import {createInvoice,getInvoice} from '../services/invoiceService';
import {recordPayment,getReceivablesSummary} from '../services/receivablesService';
import {computeBusinessMetrics} from '../services/businessMetricsService';
import {hashIdentifier} from '../services/personService';
const actor=randomUUID(),org=randomUUID(),org2=randomUUID();
before(async()=>{await migrate();await dbRun('DELETE FROM ac2_ai_usage');await dbRun('INSERT INTO ac_users(id,email,password_hash,verified,created_at) VALUES (?,?,?,?,?)',[actor,actor+'@example.test','fixture',1,new Date().toISOString()]);for(const id of [org,org2])await dbRun('INSERT INTO ac_organizations(id,name,profile,created_at) VALUES (?,?,?,?)',[id,'Security fixture','{}',new Date().toISOString()]);});
after(async()=>closeDb());
const a=(id=org):Access=>({actor,org:id,environment:'sandbox',role:'owner',api:false});
test('quota windows remain UTC at Nairobi midnight and capability logs redact encoded values',()=>{
 assert.equal(aiQuotaDay(new Date('2026-10-27T22:30:00Z')),'2026-10-27');
 assert.equal(aiQuotaDay(new Date('2026-10-28T00:00:00Z')),'2026-10-28');
 for(const path of ['/api/v1/checkout/secret','/api/v1/BUYER/%73ecret','/trust/share/short-token?password=hidden'])assert.ok(!safeLogPath(path).includes('secret')&&!safeLogPath(path).includes('short-token')&&!safeLogPath(path).includes('hidden'));
});
test('AEAD envelopes bind context, reject swapping and read legacy ciphertext without changing its key',()=>{
 const context=JSON.stringify(['document',org,'sandbox','fixture']);const encrypted=seal('private fixture',context);assert.match(encrypted,/^v2\./);assert.equal(unseal(encrypted,context),'private fixture');assert.throws(()=>unseal(encrypted,JSON.stringify(['document',org2,'sandbox','fixture'])));
 const raw=process.env.AFRICORE_ENCRYPTION_KEY||'local-only-africore-key-do-not-use-in-production',iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(raw).digest(),iv);const body=Buffer.concat([cipher.update('old fixture'),cipher.final()]);const legacy=[iv,cipher.getAuthTag(),body].map(v=>v.toString('hex')).join('.');assert.equal(unseal(legacy,context),'old fixture');
});
test('webhook resolution refuses private/special ranges and pins a single validated answer',async()=>{
 for(const value of ['127.0.0.1','10.1.2.3','169.254.169.254','100.64.0.1','198.18.0.1','192.0.2.1','198.51.100.1','203.0.113.1','::1','fd00::1','fe80::1','::ffff:127.0.0.1','2001:db8::1','2002:7f00:1::'])assert.equal(publicWebhookAddress(value),false,value);
 let calls=0;const resolver:any=async()=>{calls++;return [{address:'93.184.216.34',family:4}];};assert.deepEqual(await resolveWebhookAddress('fixture.example',resolver),{address:'93.184.216.34',family:4});assert.equal(calls,1);
 await assert.rejects(resolveWebhookAddress('fixture.example',async()=>[{address:'127.0.0.1',family:4}] as any));
});

test('TLS delivery uses the validated address even when a second DNS lookup would rebind',async()=>{
 const previous=process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS;process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS='hooks.example';
 let resolutions=0,pinned=0;
 const resolver:any=async()=>[{address:++resolutions===1?'93.184.216.34':'127.0.0.1',family:4}];
 const requester:any=(_url:URL,options:any,callback:any)=>{
  assert.equal(options.rejectUnauthorized,true);assert.equal(options.servername,'hooks.example');assert.equal(options.agent,false);
  for(let i=0;i<2;i++)options.lookup('hooks.example',{},(_error:any,address:string)=>{assert.equal(address,'93.184.216.34');pinned++;});
  const req:any=new EventEmitter();req.setTimeout=()=>req;req.destroy=()=>req;
  req.end=()=>queueMicrotask(()=>{const res:any=new PassThrough();res.socket={remoteAddress:'93.184.216.34'};res.statusCode=200;callback(res);res.end();});return req;
 };
 try{const response=await createWebhookTransport(resolver,requester)('https://hooks.example/events',{method:'POST',body:'{}'});assert.equal(response.status,200);assert.equal(resolutions,1);assert.equal(pinned,2);}finally{if(previous===undefined)delete process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS;else process.env.AFRISCORE_WEBHOOK_ALLOWED_HOSTS=previous;}
});
test('workspace authorization uses explicit route metadata and rejects unknown routes and kinds',()=>{
 assert.ok(Object.keys(workspaceRouteKinds).length>80);assert.equal(workspaceRouteAllowed('GET','/organizations/:org/records/:kind','personal','customers'),true);assert.equal(workspaceRouteAllowed('GET','/organizations/:org/records/:kind','personal','applications'),false);assert.equal(workspaceRouteAllowed('POST','/organizations/:org/trust/credentials','developer'),false);assert.equal(workspaceRouteAllowed('GET','/organizations/:org/unreviewed','business'),false);
});
test('AI identity and global reservations survive workspace switching, concurrency and missing provider usage',async()=>{
 const names=['OPENAI_API_KEY','AFRICORE_AI_MODEL','AFRICORE_AI_USER_DAILY_LIMIT','AFRICORE_AI_DAILY_BUDGET_USD','AFRICORE_AI_MONTHLY_BUDGET_USD','AFRICORE_AI_CONCURRENCY_LIMIT','AFRICORE_AI_DISABLED'];const previous=names.map(n=>process.env[n]);
 try{Object.assign(process.env,{OPENAI_API_KEY:'fixture-never-network',AFRICORE_AI_MODEL:'fixture',AFRICORE_AI_USER_DAILY_LIMIT:'1',AFRICORE_AI_DAILY_BUDGET_USD:'5',AFRICORE_AI_MONTHLY_BUDGET_USD:'25',AFRICORE_AI_CONCURRENCY_LIMIT:'2',AFRICORE_AI_DISABLED:'false'});
 for(const id of [org,org2]){await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'owner') ON CONFLICT(org_id,user_id) DO NOTHING",[id,actor]);await activate(a(id),'assistant');}
 let calls=0;const provider:ExplanationProvider={name:'fixture',explain:async()=>{calls++;return {text:'Bounded fixture explanation',input_tokens:null,output_tokens:null};}};
 const input={question:'Explain the covered records',consent_to_provider:true};
 const outcomes=await Promise.allSettled([askAssistant(a(),input,provider),askAssistant(a(org2),input,provider)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,1);
 process.env.AFRICORE_AI_USER_DAILY_LIMIT='20';process.env.AFRICORE_AI_DAILY_BUDGET_USD='1';await assert.rejects(askAssistant(a(org2),input,provider),(e:any)=>e.status===429);assert.equal(calls,1);
 process.env.AFRICORE_AI_DISABLED='true';await assert.rejects(askAssistant(a(),input,provider),(e:any)=>e.status===503);assert.equal(calls,1);
 process.env.AFRICORE_AI_DISABLED='false';process.env.AFRICORE_AI_DAILY_BUDGET_USD='5';await assert.rejects(askAssistant({...a(),api:true},input,provider),(e:any)=>e.status===403);
 await dbRun('UPDATE ac_users SET verified=0 WHERE id=?',[actor]);await assert.rejects(askAssistant(a(),input,provider),(e:any)=>e.status===403);await dbRun('UPDATE ac_users SET verified=1 WHERE id=?',[actor]);
 }finally{await dbRun('DELETE FROM ac_memberships WHERE user_id=? AND org_id IN (?,?)',[actor,org,org2]);names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});}
});
test('workspace owner limits serialize concurrent creation and do not revoke existing access',async()=>{
 const previous=process.env.AFRICORE_WORKSPACE_OWNER_LIMIT;process.env.AFRICORE_WORKSPACE_OWNER_LIMIT='1';
 try{const input={kind:'business',name:'Security test company',display_name:'Fixture owner'};const results=await Promise.allSettled([createWorkspace(actor,input),createWorkspace(actor,input)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const count=await dbGet("SELECT COUNT(*) AS total FROM ac_memberships WHERE user_id=? AND role='owner'",[actor]);assert.equal(Number(count.total),1);}finally{if(previous===undefined)delete process.env.AFRICORE_WORKSPACE_OWNER_LIMIT;else process.env.AFRICORE_WORKSPACE_OWNER_LIMIT=previous;}
});
test('managed email changes require verification, detect conflicts and never merge identities',async()=>{
 const old=await dbGet('SELECT email FROM ac_users WHERE id=?',[actor]);const proposed=randomUUID()+'@example.test';
 const unverified=await syncManagedIdentity(actor,{email:proposed,emailVerified:false});assert.equal(unverified.email,old.email);assert.equal(Number(unverified.verified),0);
 const verified=await syncManagedIdentity(actor,{email:proposed,emailVerified:true});assert.equal(verified.email,proposed);
 const other=randomUUID();await dbRun('INSERT INTO ac_users(id,email,password_hash,verified,created_at) VALUES (?,?,?,?,?)',[other,'occupied-'+other+'@example.test','fixture',1,new Date().toISOString()]);
 await assert.rejects(syncManagedIdentity(actor,{email:'occupied-'+other+'@example.test',emailVerified:true}),(e:any)=>e.status===409);
 assert.equal((await dbGet('SELECT email FROM ac_users WHERE id=?',[actor])).email,proposed);
});
test('approval binds immutable resource state and exact outcome, and can be consumed only once',async()=>{
 const reviewer=randomUUID();await dbRun('INSERT INTO ac_users(id,email,password_hash,verified,created_at) VALUES (?,?,?,?,?)',[reviewer,reviewer+'@example.test','fixture',1,new Date().toISOString()]);await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'admin')",[org,reviewer]);
 const resource=await create(a(),'disputes',{status:'open',amount_minor:1000,currency:'KES'});
 const request=()=>atomic(a(),()=>requestApproval(a(),{approver:reviewer,action:'dispute_resolution',resource_id:resource.id,parameters:{decision:'refund'}}));
 const first=await request();await decideApproval({...a(),actor:reviewer},first.id,{decision:'approved',reason:'Reviewed exact refund evidence'});
 await change(a(),resource,{amount_minor:2000});await assert.rejects(atomic(a(),()=>requireApproval(a(),first.id,'dispute_resolution',resource.id,{decision:'refund'})),(e:any)=>e.status===409);
 const next=await request();await decideApproval({...a(),actor:reviewer},next.id,{decision:'approved',reason:'Reviewed corrected refund amount'});
 await assert.rejects(atomic(a(),()=>requireApproval(a(),next.id,'dispute_resolution',resource.id,{decision:'release'})),(e:any)=>e.status===409);
 const outcomes=await Promise.allSettled([atomic(a(),()=>requireApproval(a(),next.id,'dispute_resolution',resource.id,{decision:'refund'})),atomic(a(),()=>requireApproval(a(),next.id,'dispute_resolution',resource.id,{decision:'refund'}))]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
});
test('legacy financial events enqueue durably without networking and retry a failed delivery with a stable identity',async()=>{
 const business=await createBusiness({legal_name:'Private outbox fixture',is_sandbox:true}),client={id:randomUUID(),name:'outbox-'+randomUUID()};await grantConsent({subject_type:'business',subject_id:business.id,grantee:client.name,purpose:'fixture',scope:['invoices']});
 const sub=await subscribe({client,event_pattern:'invoice.paid',target_url:'https://example.com/fixture',environment:'sandbox'});const stored=await dbGet('SELECT secret FROM webhook_subscriptions WHERE id=?',[sub.id]);assert.notEqual(stored.secret,sub.secret);assert.match(stored.secret,/^v2\./);
 await emitEvent('invoice.paid',{invoice_id:'fixture-invoice'}, {type:'business',id:business.id,is_sandbox:true});const queued=await dbGet('SELECT * FROM ac_legacy_deliveries WHERE subscription_id=?',[sub.id]);assert.equal(queued.status,'pending');
 const ids:string[]=[];const fail:typeof fetch=async(_url,init)=>{ids.push(new Headers(init?.headers).get('AfriCore-Delivery')!);throw Error('synthetic receiver timeout');};await deliverLegacyWebhooks(fail,async()=>({allowed:true}));assert.equal((await dbGet('SELECT attempts FROM ac_legacy_deliveries WHERE id=?',[queued.id])).attempts,1);
 await dbRun('UPDATE ac_legacy_deliveries SET next_at=? WHERE id=?',[new Date(0).toISOString(),queued.id]);await deliverLegacyWebhooks(async(_url,init)=>{ids.push(new Headers(init?.headers).get('AfriCore-Delivery')!);return new Response(null,{status:200});},async()=>({allowed:true}));assert.deepEqual(ids,[queued.id,queued.id]);assert.equal((await dbGet('SELECT status FROM ac_legacy_deliveries WHERE id=?',[queued.id])).status,'delivered');
});
test('currency aggregation cannot silently combine currencies',()=>{assert.equal(singleCurrency([{currency:'USD'}]),'USD');assert.throws(()=>singleCurrency([{currency:'USD'},{currency:'KES'}]),/Mixed currencies/);});

test('password screening remains local, permits eight characters, and rejects common variants',()=>{
 for(const password of ['Password123!','Welcome2026','12345678','aaaaaaaa','abcabcabc'])assert.ok(passwordIssue(password),password);
 assert.equal(passwordIssue('H7!qR2$x'),undefined);
 assert.ok(passwordIssue('seven77'));
 assert.equal(hashIdentifier(' 12345 '),hashIdentifier('12345'));
 assert.notEqual(hashIdentifier('12345','phone'),hashIdentifier('12345','national_id'));
});

test('encryption rotation reads previous versions and staged writes retain legacy compatibility',()=>{
 const names=['AFRICORE_ENCRYPTION_KEY','AFRICORE_ENCRYPTION_KEY_ID','AFRICORE_ENCRYPTION_PREVIOUS_KEYS','AFRICORE_ENCRYPTION_WRITE_VERSION'];const previous=names.map(n=>process.env[n]);
 try{
 const old=process.env.AFRICORE_ENCRYPTION_KEY!;process.env.AFRICORE_ENCRYPTION_KEY_ID='old';
 const encrypted=seal('retained fixture','document');
 process.env.AFRICORE_ENCRYPTION_KEY_ID='new';process.env.AFRICORE_ENCRYPTION_KEY='replacement-fixture-key-not-used-in-any-deployment';process.env.AFRICORE_ENCRYPTION_PREVIOUS_KEYS=JSON.stringify({old});
 assert.equal(unseal(encrypted,'document'),'retained fixture');assert.throws(()=>unseal(encrypted,'other-document'));
 process.env.AFRICORE_ENCRYPTION_WRITE_VERSION='1';const legacy=seal('compatibility fixture','context');assert.equal(legacy.split('.').length,3);assert.equal(unseal(legacy),'compatibility fixture');
 delete process.env.AFRICORE_ENCRYPTION_PREVIOUS_KEYS;assert.throws(()=>unseal(encrypted,'document'));
 }finally{names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});}
});

test('concurrent manual receipts cannot overpay; settlement uses the latest receipt date without promoting manual evidence',async()=>{
 const business=await createBusiness({legal_name:'Receipt integrity fixture',is_sandbox:true});
 const invoice=await createInvoice({business_id:business.id,customer_reference:'Fixture payer',amount:1000,issue_date:'2026-01-01T00:00:00Z'});
 const attempt=()=>recordPayment(business.id,invoice.id,{amount:600,method:'manual',paid_at:'2026-01-10T00:00:00Z'});
 const results=await Promise.allSettled([attempt(),attempt()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const summary=await getReceivablesSummary(business.id);assert.equal(summary?.matched_payment_ratio,0);
 await recordPayment(business.id,invoice.id,{amount:400,method:'manual',paid_at:'2026-01-15T00:00:00Z'});
 assert.equal((await getInvoice(invoice.id))?.paid_at,'2026-01-15T00:00:00Z');
});

test('metrics use the actual currency and exclude out-of-window failed records',()=>{
 const rows:any[]=['2026-01-10','2026-02-10','2026-03-10'].map((day,i)=>({id:String(i),business_id:org,amount:100+i*10,currency:'USD',type:'credit',status:'completed',occurred_at:day+'T00:00:00Z'}));
 rows.push({...rows[0],id:'future',status:'failed',occurred_at:'2027-01-01T00:00:00Z'},{...rows[0],id:'historical',status:'failed',occurred_at:'2020-01-01T00:00:00Z'});
 const metrics=computeBusinessMetrics(rows,{months:3,now:new Date('2026-03-31T00:00:00Z')});assert.equal(metrics.totals.failed_count,0);assert.equal(metrics.currency,'USD');assert.match(metrics.cash_flow.revenue_trend.detail,/USD/);assert.ok(!metrics.cash_flow.revenue_trend.detail.includes(' KES'));
});
