import {dbAll,dbGet,dbRun} from '../db/adapter';
import type {Access} from '../platform/auth';
import {sumMinor} from './money';
const reject=(message:string):never=>{throw Object.assign(new Error(message),{status:409});};
export async function documentBalance(a:Access,id:string,asOf?:string){
 const row=await dbGet('SELECT data,kind FROM ac_records WHERE id=? AND org_id=? AND environment=?',[id,a.org,a.environment]);
 if(!row)reject('Document not found in this workspace');
 const document=JSON.parse(row.data);
 const allocations=await dbAll('SELECT amount_minor FROM ac_effective_allocations WHERE org_id=? AND environment=? AND document_id=?'+(asOf?' AND created_at<=?':''),[a.org,a.environment,id,...(asOf?[asOf+'T23:59:59.999Z']:[])]);
 const credits=await dbAll('SELECT amount_minor FROM ac_credit_notes WHERE org_id=? AND environment=? AND invoice_id=?'+(asOf?' AND issued_on<=?':''),[a.org,a.environment,id,...(asOf?[asOf]:[])]);
 const paid_minor=sumMinor(allocations.map(r=>r.amount_minor)),credited_minor=sumMinor(credits.map(r=>r.amount_minor));
 const outstanding_minor=document.total_minor-paid_minor-credited_minor;
 if(paid_minor<0||credited_minor<0||outstanding_minor<0)reject('Document balance requires financial review');
 return {...document,id,kind:row.kind,paid_minor,credited_minor,outstanding_minor};
}
export async function refreshDocument(a:Access,id:string){
 const d=await documentBalance(a,id);
 const status=['draft','voided','cancelled'].includes(d.status)?d.status:d.credited_minor===d.total_minor?'credited':d.outstanding_minor===0?'paid':d.paid_minor>0?'partially_paid':d.kind==='orders'?'awaiting_payment':'issued';
 const next={...d,status,...(d.kind==='orders'?{payment_status:status}:{} )};
 await dbRun('UPDATE ac_records SET data=?,updated_at=? WHERE id=? AND org_id=? AND environment=?',[JSON.stringify(next),new Date().toISOString(),id,a.org,a.environment]);
 if(d.kind==='invoices'&&status==='paid'&&d.status!=='paid'){const {emit}=await import('../operations/events');await emit(a,'invoice.paid',{id,customer_id:d.customer_id,credited_minor:d.credited_minor,schema_version:1});}
 if(d.order_id){const order=await dbGet("SELECT data FROM ac_records WHERE id=? AND org_id=? AND environment=? AND kind='orders'",[d.order_id,a.org,a.environment]);if(order)await dbRun('UPDATE ac_records SET data=?,updated_at=? WHERE id=? AND org_id=? AND environment=?',[JSON.stringify({...JSON.parse(order.data),payment_status:status,paid_minor:d.paid_minor,credited_minor:d.credited_minor}),new Date().toISOString(),d.order_id,a.org,a.environment]);}
 return next;
}
