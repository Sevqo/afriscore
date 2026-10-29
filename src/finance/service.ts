import {creditInput,allocationInput,fulfillmentInput} from './contracts';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {dbAll,dbGet,dbRun,dbTransaction} from '../db';
import {Access,audit,fail} from '../platform/auth';
import {hash,now} from '../platform/crypto';
import {record,update,enqueue} from '../platform/payments';
import {documentBalance,refreshDocument} from './ledger';
import {nextOccurrence,sumMinor} from './money';
import {all,get,change,atomic} from '../operations/store';
export function canonical(value:any):string {return JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])):value);}
export async function financialOperation<T>(a:Access,operation:string,key:string,input:unknown,run:()=>Promise<T>):Promise<T>{
 z.string().min(8).max(200).parse(key);
 return dbTransaction(async()=>{
  await dbRun('UPDATE ac_organizations SET name=name WHERE id=?',[a.org]);
  const fingerprint=hash(canonical(input)),old=await dbGet('SELECT fingerprint,response FROM ac_finance_operations WHERE org_id=? AND environment=? AND operation=? AND idempotency_key=?',[a.org,a.environment,operation,key]);
  if(old){if(old.fingerprint!==fingerprint)fail(409,'Idempotency key conflicts with the original input');return JSON.parse(old.response);}
  const result=await run();
  await dbRun('INSERT INTO ac_finance_operations(org_id,environment,operation,idempotency_key,fingerprint,response,created_at) VALUES (?,?,?,?,?,?,?)',[a.org,a.environment,operation,key,fingerprint,JSON.stringify(result),now()]);
  return result;
 });
}
export async function creditInvoice(a:Access,id:string,input:unknown,key:string){
 const d=creditInput.parse(input);
 return financialOperation(a,'invoice.credit:'+id,key,d,async()=>{
  const invoice=await documentBalance(a,id);if(invoice.kind!=='invoices'||!['issued','partially_paid','paid'].includes(invoice.status))fail(409,'Only an issued invoice can receive a credit note');
  if(d.issued_on<invoice.issue_date||d.issued_on>now().slice(0,10))fail(400,'Credit date must follow invoice issue and not be in the future');
  if(d.amount_minor>invoice.outstanding_minor)fail(409,'Credit exceeds the unpaid amount; paid amounts require an authorized refund');
  const policy=await dbGet('SELECT configuration FROM ac_business_policies WHERE org_id=? AND environment=?',[a.org,a.environment]);
  if(policy&&JSON.parse(policy.configuration).require_invoice_correction_approval){const {requireApproval}=await import('../operations/automation');await requireApproval(a,d.approval_id,'invoice_adjustment',id,{credit_note:{amount_minor:d.amount_minor,reason:d.reason,issued_on:d.issued_on}});}
  const credit={id:randomUUID(),reference:'CRN-'+randomUUID().slice(0,12).toUpperCase(),invoice_id:id,...d};
  await dbRun('INSERT INTO ac_credit_notes(id,org_id,environment,invoice_id,reference,amount_minor,reason,issued_on,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',[credit.id,a.org,a.environment,id,credit.reference,d.amount_minor,d.reason,d.issued_on,a.actor,now()]);
  const refreshed=await refreshDocument(a,id);await dbRun("UPDATE ac_requests SET status='cancelled' WHERE document_id=? AND org_id=? AND environment=? AND status IN ('pending','failed')",[id,a.org,a.environment]);await audit(a.org,a.actor,'invoice.credited',credit.id);await enqueue(a,'invoice.credited',{id,credit_note_id:credit.id,amount_minor:d.amount_minor});
  return {...credit,invoice:refreshed};
 });
}
export async function allocatePayment(a:Access,eventId:string,input:unknown,key:string){
 const d=allocationInput.parse(input);
 if(new Set(d.allocations.map(r=>r.document_id)).size!==d.allocations.length)fail(400,'Combine repeated invoice targets');
 return financialOperation(a,'payment.allocate:'+eventId,key,d,async()=>{
  const event=await dbGet("SELECT * FROM ac_financial_events WHERE id=? AND org_id=? AND environment=? AND status='succeeded'",[eventId,a.org,a.environment]);if(!event)fail(404,'Confirmed payment evidence not found');
  const reversed=await dbAll("SELECT e.amount_minor FROM ac_events e JOIN ac_payment_event_details d ON d.event_id=e.id WHERE d.related_event_id=? AND e.status IN ('reversed','refunded')",[eventId]);const returned=sumMinor(reversed.map(r=>r.amount_minor));
  const used=await dbAll('SELECT amount_minor FROM ac_effective_allocations WHERE event_id=? AND org_id=? AND environment=?',[eventId,a.org,a.environment]);
  if(sumMinor(d.allocations.map(r=>r.amount_minor))+sumMinor(used.map(r=>r.amount_minor))>Number(event.amount_minor)-returned)fail(409,'Allocation exceeds available confirmed funds');
  for(const target of d.allocations){
   const doc=await documentBalance(a,target.document_id);
   if(doc.kind!=='invoices'||!['issued','partially_paid'].includes(doc.status)||doc.currency!==event.currency||target.amount_minor>doc.outstanding_minor)fail(409,'Invoice state, currency or outstanding amount does not permit allocation');
   await dbRun('INSERT INTO ac_allocation_changes(id,org_id,environment,event_id,document_id,amount_minor,reason,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[randomUUID(),a.org,a.environment,eventId,doc.id,target.amount_minor,d.reason,now(),now()]);
   await refreshDocument(a,doc.id);
  }
  const remaining=Number(event.amount_minor)-returned-sumMinor(used.map(r=>r.amount_minor))-sumMinor(d.allocations.map(r=>r.amount_minor));await dbRun("UPDATE ac_exceptions SET status=? WHERE event_id=? AND org_id=? AND environment=?",[remaining===0?'resolved':'pending_review',eventId,a.org,a.environment]);
  await audit(a.org,a.actor,'payment.allocated',eventId);await enqueue(a,'payment.allocated',{event_id:eventId,allocations:d.allocations});return {id:eventId,allocations:d.allocations};
 });
}
export async function customerActivity(a:Access,id:string){
 const customer=await record(a,id,'customers');const documents=(await dbAll("SELECT id,data,kind,created_at FROM ac_records WHERE org_id=? AND environment=? AND kind IN ('invoices','orders')",[a.org,a.environment])).map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,created_at:r.created_at})).filter(r=>r.customer_id===id);
 const invoices=await Promise.all(documents.filter(r=>r.kind==='invoices').map(r=>documentBalance(a,r.id)));
 const totals:Record<string,number>={};for(const i of invoices.filter(i=>!['draft','voided'].includes(i.status)))totals[i.currency]=sumMinor([totals[i.currency]||0,i.outstanding_minor]);
 const events=await dbAll('SELECT * FROM ac2_events WHERE org_id=? AND environment=? ORDER BY occurred_at DESC,id DESC LIMIT 500',[a.org,a.environment]);
 const requests=await dbAll('SELECT id,document_id FROM ac_requests WHERE org_id=? AND environment=?',[a.org,a.environment]);
 const ids=new Set([id,...documents.map(r=>r.id),...requests.filter(r=>documents.some(d=>d.id===r.document_id)).map(r=>r.id)]);
 return {customer,orders:documents.filter(r=>r.kind==='orders'),invoices,outstanding_by_currency:totals,activity:events.filter(e=>ids.has(e.resource_id)).slice(0,100),coverage:'Customer documents and linked domain events; separate currencies are never combined.'};
}
export async function fulfillObligation(a:Access,id:string,input:unknown,key:string){
 const d=fulfillmentInput.parse(input);
 return financialOperation(a,'obligation.fulfill:'+id,key,d,async()=>{
  const obligation=await get(a,id,'obligations');if(obligation.status!=='active')fail(409,'Only an active obligation can be fulfilled');
  if(obligation.next_due_date>new Intl.DateTimeFormat('en-CA',{timeZone:obligation.timezone||'Africa/Nairobi'}).format(new Date()))fail(409,'This occurrence is not due yet');
  const existing=await dbGet('SELECT id FROM ac_obligation_occurrences WHERE org_id=? AND environment=? AND obligation_id=? AND due_on=?',[a.org,a.environment,id,obligation.next_due_date]);if(existing)fail(409,'Occurrence already handled');
  let expense_id:string|null=null;
  if(d.action==='fulfill'&&d.record_expense){const {addExpense}=await import('../operations/intelligence');const expense=await addExpense(a,{description:obligation.description,amount_minor:obligation.amount_minor,currency:obligation.currency,occurred_on:obligation.next_due_date,category:obligation.category||'other',obligation_id:id});expense_id=expense.id;const {entitlement,recordUsage}=await import('../marketplace/engine');const service=(await entitlement(a,'expenses'))?.status==='active'?'expenses':'cash_flow';await recordUsage(a,service,'obligation-expense:'+expense.id,1,'obligation_expense_recorded');}
  const occurrenceId=randomUUID();await dbRun('INSERT INTO ac_obligation_occurrences(id,org_id,environment,obligation_id,due_on,action,expense_id,created_at) VALUES (?,?,?,?,?,?,?,?)',[occurrenceId,a.org,a.environment,id,obligation.next_due_date,d.action,expense_id,now()]);
  const next=nextOccurrence(obligation.next_due_date,obligation.recurrence,obligation.anchor_day||Number(obligation.next_due_date.slice(8)));
  const result=await change(a,obligation,{anchor_day:obligation.anchor_day||Number(obligation.next_due_date.slice(8)),...(next?{next_due_date:next}:{status:'completed'})});
  await audit(a.org,a.actor,'obligation.'+d.action,occurrenceId);await enqueue(a,'obligation.fulfilled',{id,occurrence_id:occurrenceId,expense_id,action:d.action});return {id:occurrenceId,obligation:result,expense_id};
 });
}
