import {invoiceCorrectionContext} from '../operations/business-policy';
import {returnInput} from './contracts';
import {providerReadiness,configureDaraja,initiateDaraja,refreshDaraja,receiveDaraja} from './provider-service';
import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {access,route,fail,audit} from '../platform/auth';
import {dbAll,dbGet,dbRun} from '../db';
import {record,update,enqueue,processProviderResult} from '../platform/payments';
import {hash,now} from '../platform/crypto';
import {creditInvoice,allocatePayment,customerActivity,fulfillObligation,financialOperation} from './service';
import {documentBalance} from './ledger';
import {financialSnapshot} from '../operations/intelligence';
import {safeCSV} from '../operations/store';
export const finance=Router();
const key=(req:any)=>z.string().min(8).max(200).parse(req.headers['idempotency-key']);
finance.get('/organizations/:org/customers/:id/activity',route(async(req,res)=>res.json(await customerActivity(await access(req),String(req.params.id)))));
finance.get('/organizations/:org/customers/duplicates',route(async(req,res)=>{
 const a=await access(req),rows=(await dbAll("SELECT id,data FROM ac_records WHERE org_id=? AND environment=? AND kind='customers'",[a.org,a.environment])).map(r=>({...JSON.parse(r.data),id:r.id}));
 const groups=new Map<string,string[]>();for(const c of rows)for(const value of [c.email?String(c.email).trim().toLowerCase():null,c.phone?String(c.phone).replace(/[^0-9]/g,''):null])if(value){groups.set(value,[...(groups.get(value)||[]),c.id]);}
 res.json({groups:[...groups.values()].filter(ids=>ids.length>1).map(ids=>ids.map(id=>({id,name:rows.find(c=>c.id===id)?.name}))),classification:'Possible duplicates for review; no records are merged.'});
}));
finance.get('/organizations/:org/customers/export',route(async(req,res)=>{const a=await access(req),rows=(await dbAll("SELECT id,data FROM ac_records WHERE org_id=? AND environment=? AND kind='customers' ORDER BY id",[a.org,a.environment])).map(r=>({...JSON.parse(r.data),id:r.id}));res.type('text/csv').attachment('africore-customers.csv').send(safeCSV([['id','name','email','phone','status'],...rows.map(r=>[r.id,r.name,r.email,r.phone,r.status||'active'])]));}));
finance.post('/organizations/:org/customers/import',route(async(req,res)=>{
 const a=await access(req,'operations'),d=z.object({rows:z.array(z.object({name:z.string().trim().min(1).max(200),email:z.string().email().or(z.literal('')).default(''),phone:z.string().max(50).default('')})).min(1).max(500)}).strict().parse(req.body);
 res.status(201).json(await financialOperation(a,'customers.import',key(req),d,async()=>{let imported=0,duplicates=0;const {save}=await import('../platform/payments');const existing=(await dbAll("SELECT data FROM ac_records WHERE org_id=? AND environment=? AND kind='customers'",[a.org,a.environment])).map(r=>JSON.parse(r.data));for(const c of d.rows){if(existing.some(e=>c.email&&e.email?.toLowerCase()===c.email.toLowerCase()||c.phone&&e.phone===c.phone)){duplicates++;continue;}const saved=await save(a,'customers',{...c,type:'individual',status:'active',notes:''});const {entitlement,recordUsage}=await import('../marketplace/engine');if((await entitlement(a,'customers'))?.status==='active')await recordUsage(a,'customers','customer-import:'+saved.id,1,'customer_imported');existing.push(c);imported++;}return {id:randomUUID(),imported,duplicates};}));
}));
finance.get('/organizations/:org/invoices/:id/finance',route(async(req,res)=>{
 const a=await access(req),doc=await documentBalance(a,String(req.params.id));if(doc.kind!=='invoices')fail(404,'Invoice not found');
 res.json({invoice:doc,correction_policy:await invoiceCorrectionContext(a,doc.id),customer:doc.status!=='draft'&&doc.customer_snapshot?doc.customer_snapshot:await record(a,doc.customer_id,'customers'),customer_basis:doc.status!=='draft'?(doc.customer_snapshot?'issued_snapshot':'legacy_current_contact_no_historical_snapshot'):'current_draft_contact',activity:await dbAll('SELECT id,event_type,occurred_at FROM ac2_events WHERE org_id=? AND environment=? AND (resource_id=? OR resource_id IN (SELECT id FROM ac_requests WHERE document_id=? AND org_id=? AND environment=?)) ORDER BY occurred_at DESC LIMIT 100',[a.org,a.environment,doc.id,doc.id,a.org,a.environment]),credits:await dbAll('SELECT * FROM ac_credit_notes WHERE invoice_id=? AND org_id=? AND environment=? ORDER BY created_at',[doc.id,a.org,a.environment]),allocations:await dbAll('SELECT * FROM ac_effective_allocations WHERE document_id=? AND org_id=? AND environment=? ORDER BY created_at',[doc.id,a.org,a.environment])});
}));
finance.post('/organizations/:org/invoices/:id/credits',route(async(req,res)=>res.status(201).json(await creditInvoice(await access(req,'finance'),String(req.params.id),req.body,key(req)))));
finance.post('/organizations/:org/invoices/:id/remind',route(async(req,res)=>{
 const a=await access(req,'finance'),id=String(req.params.id),d=z.object({note:z.string().trim().min(1).max(1000)}).strict().parse(req.body);
 res.json(await financialOperation(a,'invoice.remind:'+id,key(req),d,async()=>{const invoice=await documentBalance(a,id);if(invoice.kind!=='invoices'||!['issued','partially_paid'].includes(invoice.status)||invoice.outstanding_minor<=0)fail(409,'Only an outstanding issued invoice can be followed up');await audit(a.org,a.actor,'invoice.reminder_recorded',id);await enqueue(a,'invoice.reminder_recorded',{id,note:d.note,delivery:'in_app_only'});const members=await dbAll("SELECT user_id FROM ac_memberships WHERE org_id=? AND role IN ('owner','admin','finance')",[a.org]);for(const member of members)await dbRun('INSERT INTO ac2_notifications(id,org_id,environment,user_id,category,title,body,resource_id,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(org_id,environment,user_id,dedupe_key) DO NOTHING',[randomUUID(),a.org,a.environment,member.user_id,'invoicing','Invoice follow-up',d.note,id,'invoice-remind:'+id+':'+key(req),now()]);return {id,delivery:'in_app_only',message:'Collection activity recorded. No customer email or SMS was sent.'};}));
}));
finance.get('/organizations/:org/financial-summary',route(async(req,res)=>{
 const a=await access(req),snapshot=await financialSnapshot(a,req.query);
 const {inputs,...data}=snapshot;
 if(req.query.format==='csv'){res.type('text/csv').attachment('africore-financial-activity.csv').send(safeCSV([['date','currency','confirmed_inflows_minor','recorded_outflows_minor'],...snapshot.series.map(r=>[r.date,snapshot.currency,r.confirmed_inflows_minor,r.recorded_outflows_minor])]));return;}
 res.json(data);
}));
finance.post('/organizations/:org/payment-requests/:id/cancel',route(async(req,res)=>{
 const a=await access(req,'finance');z.object({confirm:z.literal(true)}).strict().parse(req.body);
 const changed=await dbRun("UPDATE ac_requests SET status='cancelled' WHERE id=? AND org_id=? AND environment=? AND status IN ('pending','failed')",[String(req.params.id),a.org,a.environment]);if(!changed.changes)fail(409,'Only an open unpaid request can be cancelled');await audit(a.org,a.actor,'payment_request.cancelled',String(req.params.id));res.json({cancelled:true});
}));
finance.get('/organizations/:org/payment-events',route(async(req,res)=>{
 const a=await access(req),q=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0),status:z.enum(['succeeded','failed','pending','reversed','refunded']).optional()}).parse(req.query);
 res.json({data:await dbAll('SELECT e.*,d.provider,d.provider_reference,d.related_event_id FROM ac_financial_events e LEFT JOIN ac_payment_event_details d ON d.event_id=e.id WHERE e.org_id=? AND e.environment=?'+(q.status?' AND e.status=?':'')+' ORDER BY e.created_at DESC,e.id DESC LIMIT ? OFFSET ?',[a.org,a.environment,...(q.status?[q.status]:[]),q.limit,q.offset]),...q});
}));
finance.post('/organizations/:org/payment-events/:id/allocate',route(async(req,res)=>res.json(await allocatePayment(await access(req,'finance'),String(req.params.id),req.body,key(req)))));
finance.post('/organizations/:org/payment-events/:id/test-return',route(async(req,res)=>{
 const a=await access(req,'finance');if(a.api||a.environment!=='sandbox')fail(403,'An authorized human test session is required; live returns are disabled');
 const d=returnInput.parse(req.body),id=String(req.params.id);
 res.json(await financialOperation(a,'payment.test-return:'+id,key(req),d,async()=>{const e=await dbGet("SELECT e.*,d.provider_reference,d.provider FROM ac_events e LEFT JOIN ac_payment_event_details d ON d.event_id=e.id WHERE e.id=? AND e.org_id=? AND e.environment=? AND e.status='succeeded'",[id,a.org,a.environment]);if(!e)fail(404,'Original test payment not found');if(e.provider&&e.provider!=='sandbox')fail(409,'This provider does not support simulated returns; an authoritative provider return is required');await audit(a.org,a.actor,'payment.test_return_requested',id);return processProviderResult(e.request_id,{reference:'test-return:'+hash(key(req)),related_reference:e.provider_reference||e.provider_ref,status:d.type,amount_minor:d.amount_minor,currency:e.currency});}));
}));
finance.get('/organizations/:org/reconciliation/:id/candidates',route(async(req,res)=>{
 const a=await access(req),event=await dbGet('SELECT * FROM ac_events WHERE id=? AND org_id=? AND environment=?',[String(req.params.id),a.org,a.environment]);if(!event)fail(404,'Payment evidence not found');
 const rows=await dbAll("SELECT id FROM ac_records WHERE org_id=? AND environment=? AND kind='invoices' ORDER BY created_at DESC LIMIT 100",[a.org,a.environment]);
 const candidates=(await Promise.all(rows.map(r=>documentBalance(a,r.id)))).filter(d=>d.currency===event.currency&&d.outstanding_minor>0&&['issued','partially_paid'].includes(d.status));res.json({event,candidates,policy:'Same workspace/currency and open balance. A matching amount alone is not proof of the intended recipient; staff must review.'});
}));
finance.post('/organizations/:org/obligations/:id/fulfill',route(async(req,res)=>res.json(await fulfillObligation(await access(req,'finance'),String(req.params.id),req.body,key(req)))));
finance.get('/organizations/:org/obligations/:id/history',route(async(req,res)=>{
 const a=await access(req);const {get}=await import('../operations/store');await get(a,String(req.params.id),'obligations');res.json({data:await dbAll('SELECT id,due_on,action,expense_id,created_at FROM ac_obligation_occurrences WHERE org_id=? AND environment=? AND obligation_id=? ORDER BY due_on DESC',[a.org,a.environment,String(req.params.id)])});
}));

finance.get('/organizations/:org/payment-providers',route(async(req,res)=>res.json(await providerReadiness(await access(req)))));
finance.post('/organizations/:org/payment-providers/daraja',route(async(req,res)=>res.status(201).json(await configureDaraja(await access(req,'admin'),req.body))));
finance.post('/organizations/:org/payment-requests/:id/daraja',route(async(req,res)=>res.status(202).json(await initiateDaraja(await access(req,'finance'),String(req.params.id),req.body,key(req)))));
finance.post('/organizations/:org/payment-attempts/:id/refresh',route(async(req,res)=>res.json(await refreshDaraja(await access(req,'finance'),String(req.params.id)))));
finance.get('/organizations/:org/payment-attempts',route(async(req,res)=>{const a=await access(req);res.json({data:await dbAll('SELECT id,request_id,provider,status,remote_reference,created_at,updated_at FROM ac_payment_attempts WHERE org_id=? AND environment=? ORDER BY created_at DESC LIMIT 100',[a.org,a.environment])});}));
finance.post('/callbacks/daraja/:token',route(async(req,res)=>{res.status(202).json(await receiveDaraja(String(req.params.token),req.body));}));

finance.get('/organizations/:org/payment-requests',route(async(req,res)=>{const a=await access(req),q=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).default(0)}).parse(req.query);res.json({data:await dbAll('SELECT id,document_id,amount_minor,currency,status,expires_at,created_at FROM ac_requests WHERE org_id=? AND environment=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',[a.org,a.environment,q.limit,q.offset]),...q});}));
