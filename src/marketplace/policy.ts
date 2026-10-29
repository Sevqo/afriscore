import {connectedPolicies} from '../operations/connected-metadata';
import {financePolicies} from '../finance/metadata';
/** Exact declared Express route metadata; unknown optional routes fail closed. */
import {marketplaceRouteKinds} from './metadata';
const root='/organizations/:org';
export interface ServicePolicy{services:string[];meter?:string;}
export const servicePolicies:Record<string,ServicePolicy>={};
for(const key of Object.keys(marketplaceRouteKinds))servicePolicies[key]={services:key==='POST /organizations/:org/verification'?['verification_api']:[]};
const bind=(services:string[],routes:string[],meter?:string)=>{for(const route of routes){const [method,path]=route.split(' ');servicePolicies[method+' '+root+path]={services,meter:method==='GET'?undefined:meter};}};
bind([],['PATCH ','GET /team','POST /invitations','PATCH /team/:member','DELETE /team/:member','PATCH /invitations/:invitation','DELETE /invitations/:invitation','GET /audit','GET /report','GET /overview','GET /personal-summary','GET /request-logs','GET /notifications','PATCH /notifications/:id','PUT /notification-preferences','GET /approvals','POST /approvals','POST /approvals/:id/decide','GET /evidence/:resource','GET /evidence/:resource/:id/download']);
bind(['income'],['GET /personal-income','POST /personal-income'],'income');
bind(['expenses','cash_flow'],['GET /expenses','POST /expenses'],'expenses');
bind(['cash_flow'],['GET /obligations','POST /obligations','PATCH /obligations/:id'],'cash_flow');
bind(['payments'],['POST /payment-requests','GET /payments']);
bind(['reconciliation'],['GET /reconciliation','POST /reconciliation/:id/review','POST /import'],'reconciliation');
bind(['developer_api'],['POST /credentials','GET /credentials','DELETE /credentials/:id']);
bind([],['DELETE /credentials/:id']); // Security revocation never requires a paid service.
bind(['webhooks'],['POST /webhooks','GET /webhooks','POST /webhooks/process','POST /webhooks/:id/rotate','POST /deliveries/:id/replay']);
bind(['intelligence'],['GET /intelligence','GET /risk-signals','POST /risk-signals/review']);
bind(['forecasting'],['POST /forecasts'],'forecasting');
bind(['assistant'],['POST /assistant'],'assistant');
bind(['automations'],['GET /automations/templates','GET /automations','POST /automations','PATCH /automations/:id','POST /automations/process','GET /automation-runs']);
bind(['fulfillment'],['GET /shipments','POST /shipments','POST /shipments/:id/transition','POST /shipments/:id/evidence'],'fulfillment');
bind(['protected_payments'],['GET /protected-sales','POST /protected-sales','GET /protected-sales/:id','POST /protected-sales/:id/action','GET /disputes','POST /disputes/:id/respond','POST /disputes/:id/resolve'],'protected_payments');
bind(['connect'],['GET /connectors/catalog','GET /connectors','POST /connectors','POST /connectors/:id/sync','POST /connectors/:id/action','POST /connectors/:id/import']);
bind(['passport','credentials','verification','trust_network','blockchain'],['GET /trust/passport']);
bind(['passport'],['POST /trust/passport','PATCH /trust/passport','POST /trust/evidence','GET /trust/requests','POST /trust/requests','POST /trust/requests/:id/reject','GET /trust/grants','POST /trust/grants','POST /trust/grants/:id/revoke','GET /trust/history','POST /trust/corrections','GET /trust/sources','GET /trust/reports']);
bind(['verification'],['POST /trust/identity-reviews','POST /trust/documents','GET /trust/documents/:id/download']);
bind(['credentials'],['GET /trust/credentials','POST /trust/credentials','GET /trust/credentials/:id','POST /trust/issuance-requests','GET /trust/issuance-requests','POST /trust/credentials/:id/status','GET /trust/issuers','POST /trust/issuers','POST /trust/issuers/:id/rotate','GET /trust/credentials/:id/export','POST /trust/issuance-requests/:id/cancel']);
bind(['blockchain'],['GET /trust/credentials/:id/proof']);
bind(['trust_network'],['GET /trust/relationships','POST /trust/relationships','POST /trust/relationships/:id/respond']);
bind(['passport'],['POST /trust/passport'],'passport');
bind(['trust_network'],['POST /trust/relationships'],'trust_network');
servicePolicies['POST '+root+'/verification']={services:['verification_api'],meter:'verification_api'};
servicePolicies['POST '+root+'/trust/verify']={services:['credentials','verification_api'],meter:'verification_api'};
servicePolicies['GET '+root+'/trust/credentials/:id/proof']={services:['blockchain'],meter:'blockchain'};
bind(['credentials','verification_api'],['POST /trust/verify']);
export function policyFor(method:string,route:string,kind?:string):ServicePolicy|undefined{
 if(route===root+'/records/:kind'||route===root+'/records/:kind/:id'){
  const services:Record<string,string[]>={customers:['customers','invoicing','orders'],orders:['orders'],invoices:['invoicing'],transactions:['payments','reconciliation'],applications:['developer_api'],integrations:['connect']};
  return services[kind||'']?{services:method==='GET'&&kind==='orders'?['orders','fulfillment','protected_payments']:services[kind!],meter:method==='POST'&&kind==='customers'?'customers':method==='POST'&&kind==='orders'?'orders':method==='PATCH'&&kind==='invoices'?'invoicing':undefined}:undefined;
 }
 return servicePolicies[(method==='HEAD'?'GET':method)+' '+route]||financePolicies[(method==='HEAD'?'GET':method)+' '+route]||connectedPolicies[(method==='HEAD'?'GET':method)+' '+route];
}
