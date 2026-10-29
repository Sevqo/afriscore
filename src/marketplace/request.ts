import {AsyncLocalStorage} from 'node:async_hooks';
import type {Request,Response} from 'express';
import type {Access} from '../platform/auth';
import {dbTransaction} from '../db/adapter';
import {randomUUID} from 'node:crypto';
import {policyFor} from './policy';
import {requireServices,reserve,finishReservation,entitlement} from './engine';
interface Context{access?:Access;reservations?:{id:string;service:string}[];identity?:Promise<any>;}
export const marketplaceRequest=new AsyncLocalStorage<Context>();
export async function checkServiceAccess(req:Request,a:Access){
 const policy=policyFor(req.method,req.route?.path,String(req.params.kind||''));
 if(!policy)throw Object.assign(new Error('Route has no reviewed service access policy'),{status:403});
 await requireServices(a,policy.services,['GET','HEAD'].includes(req.method));
 if(a.api)await requireServices(a,['developer_api']);
 const context=marketplaceRequest.getStore();if(!context)return;
 context.access=a;
 let meter=policy.meter;
 if(meter==='customers'&&!policy.services.some(id=>id==='customers'))meter=undefined;
 // Foundation customer entry is included with Invoicing/Orders, not separately billed.
 if(meter==='customers'&&(await entitlement(a,'customers'))?.status!=='active')meter=undefined;
 if(meter==='invoicing'&&req.body?.status!=='issued')meter=undefined;
 if(meter==='assistant')meter=undefined; // successful provider result records authoritative usage
 if(meter==='verification_api'&&(await entitlement(a,'verification_api'))?.status!=='active')meter=undefined;
 if(meter==='blockchain'&&(await entitlement(a,'blockchain'))?.status!=='active')meter=undefined;
 if(meter==='expenses'&&(await entitlement(a,'expenses'))?.status!=='active')meter='cash_flow';
 if(meter==='expenses'&&req.body?.supersedes_id)meter=undefined;
 if(meter==='cash_flow'&&req.body?.supersedes_id)meter=undefined;
 if(meter==='cash_flow'&&req.method==='PATCH')meter=undefined;
 if(meter==='fulfillment'&&req.route.path!=='/organizations/:org/shipments')meter=undefined;
 if(meter==='protected_payments'&&req.route.path!=='/organizations/:org/protected-sales')meter=undefined;
 if(meter==='reconciliation'&&req.route.path!=='/organizations/:org/reconciliation/:id/review')meter=undefined;
 if(meter==='reconciliation'&&req.method!=='POST')meter=undefined;
 const services=[...new Set([...(a.api?['developer_api']:[]),...(meter?[meter]:[])])];
 context.reservations||=[];
 for(const service of services)if(!context.reservations.some(r=>r.service===service))context.reservations.push({id:await reserve(a,service),service});
}
export async function withServiceRequest(req:Request,res:Response,fn:()=>Promise<any>){
 if(!req.params.org)return fn();
 const externalReads=new Set(['/organizations/:org/assistant/conversations/:id/messages','/organizations/:org/payment-requests/:id/daraja','/organizations/:org/payment-attempts/:id/refresh','/organizations/:org/assistant','/organizations/:org/webhooks/process','/organizations/:org/trust/verify','/organizations/:org/verification']);
 const atomicWrite=!['GET','HEAD'].includes(req.method)&&!externalReads.has(req.route?.path);
 const context:Context={},original=res.json;let captured:any,hasResponse=false;
 res.json=function(body:any){captured=body;hasResponse=true;return res;};
 try{
  await marketplaceRequest.run(context,async()=>{
   const execute=async()=>{
    await fn();
    if(context.reservations&&context.access){for(const reservation of context.reservations){
     const success=res.statusCode<400;
     // Client headers cannot erase real usage: creations use committed resource
     // identity, while API units count each successfully handled request.
     const key=reservation.service==='developer_api'?randomUUID():String(captured?.id||captured?.invoice?.id||randomUUID());
     await finishReservation(context.access,reservation.id,success,req.method+':'+req.route.path+':'+key,'http_success');
    }}
   };
   if(atomicWrite)await dbTransaction(execute);else await execute();
  });
 }catch(error){
  // GET reservations are committed before the read; release them on failure.
  if(!atomicWrite&&context.reservations&&context.access)for(const r of context.reservations)await finishReservation(context.access,r.id,false,'failed','http_failure');
  throw error;
 }finally{res.json=original;}
 if(hasResponse)original.call(res,captured);
}
