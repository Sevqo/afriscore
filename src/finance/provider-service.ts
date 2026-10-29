import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {dbAll,dbGet,dbRun,dbTransaction} from '../db';
import {Access,audit,fail} from '../platform/auth';
import {hash,now,seal,unseal,secret} from '../platform/crypto';
import {processProviderResult} from '../platform/payments';
import {DarajaSandbox,darajaConfiguration,kenyanPhone} from './providers/daraja';
const context=(a:Access,id:string)=>JSON.stringify(['provider',a.org,a.environment,id]);
export async function providerReadiness(a:Access){
 const connections=await dbAll('SELECT id,provider,account_id,label,status,created_at,updated_at FROM ac_provider_connections WHERE org_id=? AND environment=?',[a.org,a.environment]);
 return {live_enabled:false,providers:[{id:'sandbox',name:'Isolated simulator',status:'available',mode:'simulation',currencies:['KES','USD','EUR','GBP','UGX','TZS','RWF'],operations:['initiate','lookup','signed_callback','test_return'],live:false},{id:'daraja',name:'M-Pesa Daraja sandbox',status:connections.some(c=>c.provider==='daraja')?'requires_verification':'requires_credentials',enabled:process.env.AFRICORE_DARAJA_SANDBOX_ENABLED==='true',mode:'provider_sandbox',currencies:['KES'],operations:['stk_push','stk_status_query'],unsupported:['c2b_confirmation','transaction_status','refund','reversal','live_collection'],limitation:'External acceptance is not verified. A callback alone never confirms money.'}],connections};
}
export async function configureDaraja(a:Access,input:unknown){
 if(a.api||!['owner','admin'].includes(a.role)||a.environment!=='sandbox')fail(403,'Workspace administrator test session required');
 const d=z.object({label:z.string().trim().min(2).max(100),configuration:darajaConfiguration}).strict().parse(input),token=secret(),id=randomUUID();
 const configuration=seal(JSON.stringify({...d.configuration,callback_token:token}),context(a,id));
 await dbRun('INSERT INTO ac_provider_connections(id,org_id,environment,provider,account_id,label,callback_hash,configuration,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,a.org,a.environment,'daraja',d.configuration.shortcode,d.label,hash(token),configuration,'unverified',now(),now()]);
 await audit(a.org,a.actor,'payment_provider.configured',id);return {id,status:'unverified',callback_url:(process.env.AFRICORE_PUBLIC_ORIGIN||'')+'/api/v1/callbacks/daraja/'+token,live:false};
}
async function configured(a:Access,id:string){
 const row=await dbGet("SELECT * FROM ac_provider_connections WHERE id=? AND org_id=? AND environment=? AND provider='daraja'",[id,a.org,a.environment]);if(!row)fail(404,'Provider connection not found');
 const raw=JSON.parse(unseal(row.configuration,context(a,id))),{callback_token,...providerConfiguration}=raw;return {row,configuration:darajaConfiguration.parse(providerConfiguration),callbackToken:callback_token};
}
/** The attempt is durable before networking. Ambiguous initiation is never retried automatically. */
export async function initiateDaraja(a:Access,requestId:string,input:unknown,key:string,transport:typeof fetch=fetch){
 if(a.api||a.environment!=='sandbox'||process.env.AFRICORE_DARAJA_SANDBOX_ENABLED!=='true')fail(503,'Daraja sandbox requires explicit server enablement and a qualified test connection');
 const d=z.object({connection_id:z.string().uuid(),phone:z.string().min(9).max(30)}).strict().parse(input);z.string().min(8).max(200).parse(key);const phone=kenyanPhone(d.phone),fingerprint=hash(JSON.stringify([requestId,d.connection_id,phone]));
 const setup=await dbTransaction(async()=>{
  await dbRun('UPDATE ac_organizations SET name=name WHERE id=?',[a.org]);const previous=await dbGet('SELECT id,status,remote_reference,fingerprint FROM ac_payment_attempts WHERE org_id=? AND environment=? AND idempotency_key=?',[a.org,a.environment,key]);if(previous){if(previous.fingerprint!==fingerprint)fail(409,'Attempt key conflicts with original request');return {previous};}
  const request=await dbGet('SELECT * FROM ac_requests WHERE id=? AND org_id=? AND environment=?',[requestId,a.org,a.environment]);if(!request||!['pending','failed'].includes(request.status)||request.expires_at<now())fail(409,'Payment request is not open');
  if(await dbGet("SELECT id FROM ac_payment_attempts WHERE request_id=? AND status IN ('initiating','pending','unknown')",[requestId]))fail(409,'Resolve the existing payment attempt before initiating another');
  if(request.currency!=='KES'||Number(request.amount_minor)%100!==0)fail(400,'Daraja test requests require whole-shilling KES amounts');const callbackOrigin=new URL(process.env.AFRICORE_PUBLIC_ORIGIN||'http://invalid');if(callbackOrigin.protocol!=='https:')fail(503,'A trusted public HTTPS origin is required');
  const connection=await configured(a,d.connection_id),id=randomUUID();await dbRun('INSERT INTO ac_payment_attempts(id,org_id,environment,request_id,provider,account_id,idempotency_key,fingerprint,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,a.org,a.environment,requestId,'daraja',connection.row.id,key,fingerprint,'initiating',now(),now()]);return {id,request,connection};
 });
 if(setup.previous)return setup.previous;
 const callback=(process.env.AFRICORE_PUBLIC_ORIGIN||'')+'/api/v1/callbacks/daraja/'+setup.connection!.callbackToken;
 try{const result=await new DarajaSandbox(setup.connection!.configuration,transport).initiate({amount_minor:Number(setup.request!.amount_minor),currency:setup.request!.currency,phone,reference:setup.request!.id,callback_url:callback});await dbRun('UPDATE ac_payment_attempts SET status=?,remote_reference=?,result=?,updated_at=? WHERE id=?',['pending',result.checkout_id,JSON.stringify({merchant_id:result.merchant_id}),now(),setup.id!]);await audit(a.org,a.actor,'payment_attempt.initiated',setup.id);return {id:setup.id,status:'pending',confirmation:'Awaiting authenticated provider status; acknowledgement is not payment.'};}
 catch(error){await dbRun("UPDATE ac_payment_attempts SET status='unknown',updated_at=? WHERE id=?",[now(),setup.id!]);throw error;}
}
export async function refreshDaraja(a:Access,id:string,transport:typeof fetch=fetch){
 if(a.environment!=='sandbox'||process.env.AFRICORE_DARAJA_SANDBOX_ENABLED!=='true')fail(503,'Daraja sandbox is not enabled');
 const attempt=await dbGet('SELECT * FROM ac_payment_attempts WHERE id=? AND org_id=? AND environment=?',[id,a.org,a.environment]);if(!attempt||!attempt.remote_reference)fail(409,'No authoritative checkout identity is available; manual provider review is required');
 const {configuration,row:connection}=await configured(a,attempt.account_id),request=await dbGet('SELECT * FROM ac_requests WHERE id=? AND org_id=? AND environment=?',[attempt.request_id,a.org,a.environment]);
 const result=await new DarajaSandbox(configuration,transport).lookup(attempt.remote_reference);
 if(result.status!=='pending')await processProviderResult(attempt.request_id,{reference:attempt.remote_reference,provider:'daraja_sandbox',account_id:connection.account_id,status:result.status,amount_minor:Number(request.amount_minor),currency:request.currency,time_basis:'observed_confirmation'});
 await dbRun('UPDATE ac_payment_attempts SET status=?,updated_at=? WHERE id=?',[result.status,now(),id]);if(result.status!=='pending')await dbRun("UPDATE ac_payment_inbox SET status='completed' WHERE attempt_id=? AND status IN ('pending','dead_letter')",[id]);return {id,status:result.status,assurance:'Authenticated sandbox STK status tied to original merchant/checkout/amount; no live funds.'};
}
export async function receiveDaraja(token:string,input:unknown){
 z.string().length(64).parse(token);const connection=await dbGet('SELECT id,org_id,environment FROM ac_provider_connections WHERE callback_hash=?',[hash(token)]);if(!connection)fail(404,'Callback not found');
 const body=z.object({Body:z.object({stkCallback:z.object({CheckoutRequestID:z.string().min(1).max(200),MerchantRequestID:z.string().min(1).max(200),ResultCode:z.number().int()}).passthrough()})}).passthrough().parse(input);
 const attempt=await dbGet('SELECT id,result FROM ac_payment_attempts WHERE remote_reference=? AND account_id=? AND org_id=? AND environment=?',[body.Body.stkCallback.CheckoutRequestID,connection.id,connection.org_id,connection.environment]);if(!attempt||JSON.parse(attempt.result||'{}').merchant_id!==body.Body.stkCallback.MerchantRequestID)fail(409,'Unknown provider checkout identity');
 const fingerprint=hash(JSON.stringify([body.Body.stkCallback.CheckoutRequestID,body.Body.stkCallback.ResultCode]));
 await dbRun("INSERT INTO ac_payment_inbox(id,attempt_id,fingerprint,status,next_at,created_at) VALUES (?,?,?,'pending',?,?) ON CONFLICT(attempt_id,fingerprint) DO NOTHING",[randomUUID(),attempt.id,fingerprint,now(),now()]);return {accepted:true,confirmation:'pending_authenticated_query'};
}
let busy=false;
export async function processPaymentInbox(transport:typeof fetch=fetch){
 if(busy||process.env.AFRICORE_DARAJA_SANDBOX_ENABLED!=='true')return {processed:0};busy=true;let processed=0;
 try{const jobs=await dbAll("SELECT i.*,a.org_id,a.environment FROM ac_payment_inbox i JOIN ac_payment_attempts a ON a.id=i.attempt_id WHERE i.status='pending' AND i.next_at<=? ORDER BY i.created_at LIMIT 25",[now()]);for(const job of jobs){let success=false;try{const result=await refreshDaraja({org:job.org_id,environment:job.environment,actor:'provider_worker',role:'system',api:false},job.attempt_id,transport);success=result.status!=='pending';}catch{/* bounded retry, never log credentials or callback bodies */}const attempts=job.attempts+1;await dbRun('UPDATE ac_payment_inbox SET status=?,attempts=?,next_at=? WHERE id=?',[success?'completed':attempts>=5?'dead_letter':'pending',attempts,new Date(Date.now()+Math.min(3600000,1000*2**attempts)).toISOString(),job.id]);processed++;}return {processed};}finally{busy=false;}
}
