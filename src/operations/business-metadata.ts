const business=['business'] as const,products=['business','developer'] as const,all=['business','personal','developer'] as const;
export const businessRouteKinds:Record<string,readonly string[]>={};
export const businessPolicies:Record<string,{services:string[];meter?:string}>={};
function bind(paths:string[],services:string[],kinds:readonly string[]=business,meter?:string){for(const path of paths){const [method,suffix]=path.split(' '),key=method+' /organizations/:org'+suffix;businessRouteKinds[key]=kinds;businessPolicies[key]={services,meter:method==='GET'?undefined:meter};}}
bind(['GET /products','GET /products/:id','POST /products','PATCH /products/:id'],['products'],products);
bind(['GET /inventory','GET /inventory/warehouses','POST /inventory/warehouses','POST /inventory/warehouses/:id/locations','GET /inventory/movements','POST /inventory/movements','GET /inventory/reservations','GET /inventory/incoming','POST /inventory/incoming','POST /inventory/incoming/:id/action','POST /inventory/adjustment-approvals'],['inventory']);
bind(['GET /crm','GET /crm/entries','POST /crm/entries','PATCH /crm/entries/:id','GET /crm/customers/:id','PUT /crm/customers/:id','GET /crm/customers/:id/activity'],['crm']);
bind(['GET /sales/quotations','GET /sales/quotations/:id','POST /sales/quotations','PATCH /sales/quotations/:id','POST /sales/quotations/:id/action','POST /sales/quotations/:id/discount-approvals'],['sales']);
bind(['GET /business/policy','PUT /business/policy','GET /business/approvals'],[]);
bind(['POST /business/invoices/:id/correction-review'],['invoicing']);
bind(['GET /notifications/summary','POST /notifications/read-all','POST /notifications/:id/dismiss'],[],all);
bind(['GET /business/analytics','GET /business/analytics/export','GET /business/saved-reports','POST /business/saved-reports','DELETE /business/saved-reports/:id'],[],['business','personal']);

bind(['POST /business/workflows/:id/test'],['automations']);

bind(['PATCH /inventory/warehouses/:id'],['inventory']);

bind(['GET /business/orders/:id/draft','POST /business/orders/:id/draft'],['orders']);

bind(['GET /notifications/preferences','PUT /notifications/preferences'],[],all);

bind(['GET /business/analytics/records'],[],['business','personal']);

bind(['GET /inventory/replenishment-suggestions','POST /inventory/replenishment-suggestions/:id/review'],['inventory']);
