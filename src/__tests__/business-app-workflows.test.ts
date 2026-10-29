import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {configureTestEnv} from './helpers';
configureTestEnv('business-app-workflows');
import {migrate,dbAll,dbGet,dbRun,closeDb} from '../db';
import {createApp} from '../app';
import {stockBalance} from '../inventory/service';
import {processProviderResult} from '../platform/payments';
import {processBusinessEvents} from '../operations/business-worker';
import {runAutomations} from '../operations/automation';
import {quantityMilli} from '../inventory/quantity';
let server:any,base:string,cookie='',org='',actor='',customerId='',productId='',warehouseId='',orderId='',invoiceId='',approverCookie='',approverId='';
const path=(suffix:string)=>'/api/v1/organizations/'+org+suffix;
const a=()=>({org,actor,role:'owner',environment:'sandbox',api:false});
async function api(p:string,method='GET',body?:any,session=cookie,key=randomUUID()){const r=await fetch(base+p,{method,headers:{Cookie:session,'Content-Type':'application/json','Idempotency-Key':key},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]||''};}
async function install(id:string,optional:string[]=[]){const preview=await api(path('/apps/'+id+'/installation-preview')+(optional.length?'?optional='+optional.join(','):''));assert.equal(preview.status,200,JSON.stringify(preview.data));const r=await api(path('/apps/'+id+'/install'),'POST',{review_hash:preview.data.review_hash,optional_services:optional});assert.equal(r.status,200,JSON.stringify(r.data));}
const document=(quantity=3)=>({customer_id:customerId,currency:'KES',items:[{description:'Synthetic shared product',quantity,unit_price_minor:100000,product_id:productId,warehouse_id:warehouseId}],issue_date:'2026-10-01',due_date:'2026-11-01'});
before(async()=>{await migrate();server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;const s=await api('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-connected-business-2026!'});cookie=s.cookie;await api('/api/auth/verify','POST',{token:s.data.verification_token});actor=(await api('/api/auth/account')).data.user.id;const w=await api('/api/auth/workspaces','POST',{kind:'business',name:'Synthetic connected apps',display_name:'Synthetic owner',services:[]});assert.equal(w.status,201);org=w.data.id;const other=await api('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-second-reviewer-2026!'});approverCookie=other.cookie;await api('/api/auth/verify','POST',{token:other.data.verification_token},approverCookie);approverId=(await api('/api/auth/account','GET',undefined,approverCookie)).data.user.id;await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'owner')",[org,approverId]);});
after(async()=>{await new Promise<void>(r=>server.close(()=>r()));await closeDb();});
test('six installations share customers/services without duplicate entitlements',async()=>{
 for(const id of ['finance','crm','inventory','sales','analytics','automations'])await install(id,id==='finance'?['payments','reconciliation']:[]);
 const apps=await api(path('/apps'));assert.equal(apps.data.apps.filter((a:any)=>a.installation?.status==='installed').length,6);
 assert.equal((await dbAll('SELECT service_id,COUNT(*) AS n FROM ac_service_entitlements WHERE org_id=? GROUP BY service_id HAVING COUNT(*)>1',[org])).length,0);
 const customer=await api(path('/records/customers'),'POST',{name:'Synthetic shared customer',address:'Original fictional address'});assert.equal(customer.status,201);customerId=customer.data.id;
 assert.equal((await api(path('/crm/customers/'+customerId),'PUT',{expected_version:0,tags:['repeat buyer'],assigned_to:actor})).status,200);
 const opportunity=await api(path('/crm/entries'),'POST',{kind:'opportunity',customer_id:customerId,title:'Synthetic desks proposal',stage:'proposal',assigned_to:actor,amount_minor:300000});assert.equal(opportunity.status,201);
 const warehouse=await api(path('/inventory/warehouses'),'POST',{code:'MAIN',name:'Synthetic warehouse'});assert.equal(warehouse.status,201);warehouseId=warehouse.data.id;
 const product=await api(path('/products'),'POST',{sku:'SHARED-001',name:'Synthetic shared product',sale_price_minor:100000,reorder_point_milli:17000});assert.equal(product.status,201);productId=product.data.id;
 assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'receipt',quantity_milli:20000,reason:'Synthetic opening stock receipt'})).status,201);
 assert.equal((await stockBalance(a(),productId)).on_hand_milli,20000);
});
test('quotation and draft order do not consume stock; confirmation atomically reserves and prepares one draft invoice',async()=>{
 const created=await api(path('/sales/quotations'),'POST',document());assert.equal(created.status,201,JSON.stringify(created.data));assert.equal((await stockBalance(a(),productId)).reserved_milli,0);
 const accepted=await api(path('/sales/quotations/'+created.data.id+'/action'),'POST',{action:'accept',expected_version:1});assert.equal(accepted.status,200);
 const converted=await api(path('/sales/quotations/'+created.data.id+'/action'),'POST',{action:'convert',expected_version:2});assert.equal(converted.status,200,JSON.stringify(converted.data));orderId=converted.data.order_id;
 assert.equal((await stockBalance(a(),productId)).reserved_milli,0);
 const confirmed=await api(path('/records/orders/'+orderId),'PATCH',{status:'awaiting_payment'});assert.equal(confirmed.status,200,JSON.stringify(confirmed.data));
 assert.deepEqual(await stockBalance(a(),productId),{on_hand_milli:20000,reserved_milli:3000,available_milli:17000,incoming_milli:0,outgoing_milli:3000,forecasted_milli:17000});
 const linked=await dbGet('SELECT invoice_id FROM ac_sales_order_links WHERE order_id=?',[orderId]);assert.ok(linked);invoiceId=linked.invoice_id;
 const invoice=await api(path('/records/invoices/'+invoiceId));assert.equal(invoice.data.status,'draft');assert.equal(invoice.data.order_id,orderId);assert.equal(invoice.data.total_minor,300000);
 assert.equal((await api(path('/records/orders/'+orderId),'PATCH',{status:'awaiting_payment'})).status,409);assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac_sales_order_links WHERE order_id=?',[orderId])).n),1);
});
test('concurrent reservations cannot oversell and cancelling an unissued order releases only its own stock',async()=>{
 const first=await api(path('/records/orders'),'POST',document(12)),second=await api(path('/records/orders'),'POST',document(12));assert.equal(first.status,201);assert.equal(second.status,201);
 const results=await Promise.all([first,second].map(o=>api(path('/records/orders/'+o.data.id),'PATCH',{status:'awaiting_payment'})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results[0].status===200?first:second,loser=results[0].status===409?first:second;
 assert.equal((await stockBalance(a(),productId)).reserved_milli,15000);assert.equal((await api(path('/records/orders/'+loser.data.id))).data.status,'draft');
 const cancelled=await api(path('/records/orders/'+winner.data.id),'PATCH',{status:'cancelled'});assert.equal(cancelled.status,200,JSON.stringify(cancelled.data));assert.equal((await stockBalance(a(),productId)).reserved_milli,3000);
});
test('issued customer details remain frozen while shared contact edits and confirmed payment reach Finance and CRM',async()=>{
 assert.equal((await api(path('/records/invoices/'+invoiceId),'PATCH',{status:'issued'})).status,200);
 assert.equal((await api(path('/records/customers/'+customerId),'PATCH',{address:'Updated fictional address',name:'Updated shared customer'})).status,200);
 const invoice=await api(path('/records/invoices/'+invoiceId));assert.equal(invoice.data.customer_snapshot.address,'Original fictional address');assert.equal((await api(path('/crm/customers/'+customerId))).data.customer.address,'Updated fictional address');
 assert.equal((await api(path('/records/invoices/'+invoiceId),'PATCH',{...document(),items:[{description:'Illegal silent change',quantity:1,unit_price_minor:1}]})).status,409);
 const request=await api(path('/payment-requests'),'POST',{document_id:invoiceId,amount_minor:300000});assert.equal(request.status,201);
 await processProviderResult(request.data.id,{reference:'synthetic-apps-'+randomUUID(),status:'succeeded',amount_minor:300000,currency:'KES'});
 const history=await api(path('/crm/customers/'+customerId+'/activity'));assert.equal(history.status,200);assert.ok(history.data.financial_activity.invoices.some((i:any)=>i.id===invoiceId&&i.outstanding_minor===0));
 const before=Number((await dbGet('SELECT COUNT(*) AS n FROM ac2_notifications WHERE org_id=?',[org])).n);await processBusinessEvents(a());const after=Number((await dbGet('SELECT COUNT(*) AS n FROM ac2_notifications WHERE org_id=?',[org])).n);assert.ok(after>before);await processBusinessEvents(a());assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac2_notifications WHERE org_id=?',[org])).n),after);
 const notifications=await api(path('/notifications/summary'));assert.ok(notifications.data.unread>0);assert.ok(notifications.data.data.some((n:any)=>n.title==='Draft invoice prepared'));
});
test('partial physical dispatch, bounded returns and adjustments preserve exact available stock',async()=>{
 const shipment=await api(path('/shipments'),'POST',{order_id:orderId,courier:'manual',tracking_reference:'Synthetic app shipment',estimated_delivery:'2026-11-01',items:[{item_index:0,quantity:1}]});assert.equal(shipment.status,201,JSON.stringify(shipment.data));
 for(const status of ['processing','ready_for_dispatch','shipped']){const r=await api(path('/shipments/'+shipment.data.id+'/transition'),'POST',{status});assert.equal(r.status,200,JSON.stringify(r.data));}
 assert.equal((await stockBalance(a(),productId)).on_hand_milli,19000);assert.equal((await stockBalance(a(),productId)).reserved_milli,2000);
 const dispatch=await dbGet("SELECT id FROM ac_stock_movements WHERE source_id=? AND kind='dispatch'",[shipment.data.id]);assert.ok(dispatch);
 assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'return',quantity_milli:1000,source_id:dispatch.id,reason:'Synthetic returned unit received'})).status,201);
 assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'return',quantity_milli:1000,source_id:dispatch.id,reason:'Duplicate excess physical return'})).status,409);
 assert.equal((await stockBalance(a(),productId)).on_hand_milli,20000);
 assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'adjustment',quantity_milli:-1000,reason:'Synthetic count correction'})).status,201);
});
test('stock write-off approval binds resource version and exact parameters, rejects replay and stale changes',async()=>{
 const movement={product_id:productId,warehouse_id:warehouseId,kind:'adjustment',quantity_milli:-6000,reason:'Synthetic significant write-off'};
 assert.equal((await api(path('/inventory/movements'),'POST',movement)).status,409);
 const approval=await api(path('/inventory/adjustment-approvals'),'POST',{approver:approverId,movement});assert.equal(approval.status,201,JSON.stringify(approval.data));
 assert.equal((await api(path('/approvals/'+approval.data.id+'/decide'),'POST',{decision:'approved',reason:'Reviewed exact synthetic stock delta'},approverCookie)).status,200);
 assert.equal((await api(path('/inventory/movements'),'POST',{...movement,quantity_milli:-6001,approval_id:approval.data.id})).status,409);
 const key=randomUUID(),posted=await api(path('/inventory/movements'),'POST',{...movement,approval_id:approval.data.id},cookie,key);assert.equal(posted.status,201,JSON.stringify(posted.data));assert.equal((await api(path('/inventory/movements'),'POST',{...movement,approval_id:approval.data.id},cookie,key)).data.id,posted.data.id);
 assert.equal((await api(path('/inventory/movements'),'POST',{...movement,approval_id:approval.data.id})).status,409);
 const stale=await api(path('/inventory/adjustment-approvals'),'POST',{approver:approverId,movement});assert.equal(stale.status,201);assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'receipt',quantity_milli:1000,reason:'Synthetic later stock change'})).status,201);assert.equal((await api(path('/approvals/'+stale.data.id+'/decide'),'POST',{decision:'approved',reason:'Attempt to approve stale resource'},approverCookie)).status,409);
});
test('business invoice credits require reviewed second-person execution and preserve issued terms',async()=>{
 const created=await api(path('/records/invoices'),'POST',{...document(),items:[{description:'Synthetic additional work',quantity:1,unit_price_minor:10000}]});assert.equal(created.status,201);const id=created.data.id;await api(path('/records/invoices/'+id),'PATCH',{status:'issued'});
 const credit={amount_minor:1000,reason:'Synthetic reviewed commercial correction',issued_on:'2026-10-29'};
 assert.equal((await api(path('/invoices/'+id+'/credits'),'POST',credit)).status,409);
 const requested=await api(path('/business/invoices/'+id+'/correction-review'),'POST',{approver:approverId,credit_note:credit});assert.equal(requested.status,201,JSON.stringify(requested.data));
 assert.equal((await api(path('/approvals/'+requested.data.id+'/decide'),'POST',{decision:'approved',reason:'Reviewed exact synthetic credit'},approverCookie)).status,200);
 assert.equal((await api(path('/invoices/'+id+'/credits'),'POST',{...credit,approval_id:requested.data.id})).status,201);
 assert.equal((await api(path('/records/invoices/'+id))).data.total_minor,10000);
});
test('cross-workspace, role, inactive-service and notification boundaries remain enforced',async()=>{
 const signup=await api('/api/auth/signup','POST',{email:randomUUID()+'@example.test',password:'Synthetic-operations-reader-2026!'}),session=signup.cookie;await api('/api/auth/verify','POST',{token:signup.data.verification_token},session);const id=(await api('/api/auth/account','GET',undefined,session)).data.user.id;
 assert.equal((await api(path('/inventory'),'GET',undefined,session)).status,403);await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'operations')",[org,id]);
 const history=await api(path('/crm/customers/'+customerId+'/activity'),'GET',undefined,session);assert.equal(history.status,200);assert.equal(history.data.financial_activity,null);
 const notification=await dbGet('SELECT id FROM ac2_notifications WHERE org_id=? AND user_id=? LIMIT 1',[org,actor]);assert.equal((await api(path('/notifications/'+notification.id),'PATCH',{},session)).status,404);
 await dbRun("UPDATE ac_service_entitlements SET status='disabled' WHERE org_id=? AND service_id='inventory'",[org]);assert.equal((await api(path('/inventory/movements'),'POST',{product_id:productId,warehouse_id:warehouseId,kind:'receipt',quantity_milli:1000,reason:'Denied inactive service operation'})).status,402);
 await dbRun("UPDATE ac_service_entitlements SET status='active' WHERE org_id=? AND service_id='inventory'",[org]);assert.equal(quantityMilli('0.125'),125);assert.throws(()=>quantityMilli('0.0001'));
});


test('supported event workflows create one assigned task and one review suggestion without external actions',async()=>{
 const rule=await api(path('/automations'),'POST',{name:'Synthetic customer onboarding',template:'customer_onboarding',enabled:true,conditions:{currency:'KES',minimum_minor:0,days_before_due:2}});assert.equal(rule.status,201,JSON.stringify(rule.data));const preview=await api(path('/business/workflows/'+rule.data.id+'/test'),'POST',{confirm:true});assert.equal(preview.status,200,JSON.stringify(preview.data));assert.equal(preview.data.side_effects_performed,0);assert.equal(preview.data.action,'create_crm_follow_up');assert.equal(Number((await dbGet('SELECT COUNT(*) AS n FROM ac2_runs WHERE workflow_id=?',[rule.data.id])).n),0);
 assert.equal((await api(path('/automations'),'POST',{name:'Reject mismatched action',template:'customer_onboarding',action:'in_app_notification'})).status,400);
 const c=await api(path('/records/customers'),'POST',{name:'Synthetic workflow customer'});assert.equal(c.status,201);
 await runAutomations(a());await runAutomations(a());
 const tasks=await dbAll("SELECT * FROM ac_crm_entries WHERE org_id=? AND customer_id=? AND kind='follow_up'",[org,c.data.id]);assert.equal(tasks.length,1);assert.equal(tasks[0].assigned_to,actor);
 const run=await dbGet("SELECT * FROM ac2_runs WHERE workflow_id=? AND status='succeeded'",[rule.data.id]);assert.ok(run);assert.equal(JSON.parse(run.result).external_messages_sent,0);
 const stockRule=await api(path('/automations'),'POST',{name:'Synthetic stock replenishment',template:'stock_replenishment',enabled:true});assert.equal(stockRule.status,201,JSON.stringify(stockRule.data));
 const low=await api(path('/products'),'POST',{sku:'WORKFLOW-LOW',name:'Synthetic low stock workflow',sale_price_minor:100,reorder_point_milli:5000});assert.equal(low.status,201);await api(path('/inventory/movements'),'POST',{product_id:low.data.id,warehouse_id:warehouseId,kind:'receipt',quantity_milli:1000,reason:'Synthetic low stock receipt'});await processBusinessEvents(a());await runAutomations(a());await runAutomations(a());
 const suggestions=await dbAll("SELECT * FROM ac2_objects WHERE org_id=? AND kind='replenishment_suggestions'",[org]);assert.ok(suggestions.length>=1);assert.equal(new Set(suggestions.map((r:any)=>r.id)).size,suggestions.length);
 const stockRun=await dbGet("SELECT * FROM ac2_runs WHERE workflow_id=? AND status='succeeded'",[stockRule.data.id]);assert.ok(stockRun);assert.equal(JSON.parse(stockRun.result).supplier_orders_created,0);
});

test('analytics uses covered sources and actor-private saved reports',async()=>{
 const report=await api(path('/business/analytics?currency=KES&from=2026-10-01&to=2026-10-29'));assert.equal(report.status,200,JSON.stringify(report.data));assert.ok(report.data.inventory.total_products>=1);assert.equal(report.data.inventory.valuation,null);assert.ok(report.data.definitions.sales.includes('not recognized revenue'));
 const saved=await api(path('/business/saved-reports'),'POST',{name:'Synthetic reviewed view',configuration:{query:{currency:'KES',from:'2026-10-01',to:'2026-10-29'},widgets:['financial','inventory']}});assert.equal(saved.status,201,JSON.stringify(saved.data));
 assert.ok((await api(path('/business/saved-reports'))).data.data.some((r:any)=>r.id===saved.data.id));assert.ok(!(await api(path('/business/saved-reports'),'GET',undefined,approverCookie)).data.data.some((r:any)=>r.id===saved.data.id));
 assert.equal((await api(path('/business/saved-reports/'+saved.data.id),'DELETE',{},approverCookie)).status,404);
 assert.equal((await api(path('/business/saved-reports/'+saved.data.id),'DELETE',{})).status,200);
 assert.equal((await api(path('/business/analytics?from=2026-10-29&to=2026-10-01'))).status,400);
});
