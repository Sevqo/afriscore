import {z} from 'zod';
import {dbGet} from '../db/adapter';
import {type Access,fail} from '../platform/auth';
import {requireServices,checkLimits} from '../marketplace/engine';
import {record} from '../platform/payments';
import {product,stockBalance} from '../inventory/service';
import {create,get} from './store';
import {createCrmEntry} from './crm';
import {workflowAction} from './contracts';
export async function executeBusinessWorkflow(a:Access,w:any,run:any){
 const event=await dbGet('SELECT * FROM ac2_events WHERE id=? AND org_id=? AND environment=?',[run.trigger_key,a.org,a.environment]);if(!event)fail(409,'Workflow source event is unavailable');const payload=z.object({id:z.string().uuid()}).passthrough().parse(JSON.parse(event.payload));
 const action=workflowAction(w.template);
 if(action==='create_crm_follow_up'){
  if(event.event_type!=='customer.created')fail(409,'Unexpected workflow event');await requireServices(a,['crm']);const customer=await record(a,payload.id,'customers');if(customer.status==='archived')return {action,skipped:true,reason:'customer_archived',completed_units:0};
  await checkLimits(a,'crm',1);const entry=await createCrmEntry(a,{kind:'follow_up',customer_id:customer.id,title:w.name+' · customer onboarding',notes:'Created by a reviewed supported workflow. No customer message was sent.',assigned_to:a.actor,due_at:new Date(Date.parse(run.created_at)+w.conditions.days_before_due*86400000).toISOString()},'workflow:'+run.id,run.id);
  const {recordUsage}=await import('../marketplace/engine');await recordUsage(a,'crm','workflow.crm:'+run.id,1,'workflow_followup_created');return {action,resource_id:entry.id,completed_units:1,external_messages_sent:0};
 }
 if(action==='replenishment_suggestion'){
  if(event.event_type!=='inventory.reorder_needed')fail(409,'Unexpected workflow event');await requireServices(a,['inventory']);const p=await product(a,payload.id),balance=await stockBalance(a,p.id);if(!p.track_inventory||p.status!=='active'||balance.available_milli>p.reorder_point_milli)return {action,skipped:true,reason:'stock_recovered',completed_units:0};
  const existing=await dbGet("SELECT id FROM ac2_objects WHERE id=? AND org_id=? AND environment=? AND kind='replenishment_suggestions'",[run.id,a.org,a.environment]);const suggestion=existing?await get(a,run.id,'replenishment_suggestions'):await create(a,'replenishment_suggestions',{product_id:p.id,source_run_id:run.id,status:'open',available_milli:balance.available_milli,reorder_point_milli:p.reorder_point_milli,suggested_quantity_milli:Math.min(1e12,Math.max(0,p.reorder_point_milli*2-balance.available_milli)),unit:p.unit,policy:'Review suggestion only; no purchase order, supplier message or payment is authorized.'},run.id);
  return {action,resource_id:suggestion.id,completed_units:1,supplier_orders_created:0,external_messages_sent:0};
 }
 return fail(400,'Unsupported business workflow action');
}
