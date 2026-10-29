import type {ServicePolicy} from '../marketplace/policy';
export const financeRouteKinds:Record<string,readonly string[]>={};
export const financePolicies:Record<string,ServicePolicy>={};
const bind=(kinds:string[],services:string[],routes:string[],meter?:string)=>{for(const route of routes){const [method,path]=route.split(' '),key=method+' /organizations/:org'+path;financeRouteKinds[key]=kinds;financePolicies[key]={services,meter:method==='POST'?meter:undefined};}};
const all=['business','personal','developer'];
bind(all,['customers','invoicing','orders'],['GET /customers/:id/activity','GET /customers/duplicates','GET /customers/export','POST /customers/import']);
bind(all,['invoicing'],['GET /invoices/:id/finance','POST /invoices/:id/credits','POST /invoices/:id/remind']);
bind(all,[],['GET /financial-summary']);
bind(all,['payments'],['POST /payment-requests/:id/cancel','GET /payment-events','POST /payment-events/:id/test-return']);
bind(['business','developer'],['reconciliation'],['POST /payment-events/:id/allocate','GET /reconciliation/:id/candidates']);
bind(['business','personal'],['cash_flow'],['POST /obligations/:id/fulfill','GET /obligations/:id/history']);

bind(all,['payments'],['GET /payment-providers','POST /payment-providers/daraja','POST /payment-requests/:id/daraja','GET /payment-attempts','POST /payment-attempts/:id/refresh']);

bind(all,['payments'],['GET /payment-requests']);
