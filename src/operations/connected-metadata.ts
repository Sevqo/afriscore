import type {ServicePolicy} from '../marketplace/policy';
export const connectedRouteKinds:Record<string,readonly string[]>={},connectedPolicies:Record<string,ServicePolicy>={};
const bind=(kinds:string[],services:string[],routes:string[])=>{for(const r of routes){const [method,path]=r.split(' '),key=method+' /organizations/:org'+path;connectedRouteKinds[key]=kinds;connectedPolicies[key]={services};}};
bind(['personal','business','developer'],['assistant'],['GET /assistant/conversations','POST /assistant/conversations','GET /assistant/conversations/:id/messages','POST /assistant/conversations/:id/messages','DELETE /assistant/conversations/:id','POST /assistant/conversations/:id/messages/:message/feedback','GET /assistant/usage']);
bind(['business','developer'],['data','connect'],['GET /data/quality','POST /data/imports']);
bind(['business'],['intelligence'],['GET /intelligence/alerts','PUT /intelligence/alerts/policy','POST /intelligence/alerts/evaluate','PATCH /intelligence/alerts/:id']);
bind(['business'],['trust_network','passport'],['GET /trust/assessment']);

bind(['business'],['automations'],['PUT /automations/:id/configuration','GET /automations/:id/versions','POST /automation-runs/:id/control']);

bind(['business'],['forecasting'],['GET /forecasts/evaluations']);

bind(['business'],[],['POST /approvals/:id/cancel']);
