import {financeRouteKinds} from '../finance/metadata';
/** Explicit route metadata. New routes remain denied until reviewed here. */
import {marketplaceRouteKinds} from '../marketplace/metadata';
export const workspaceRouteKinds:Record<string,readonly string[]>={
  "GET /organizations/:org/request-logs": [
    "business",
    "developer"
  ],
  "GET /organizations/:org/personal-income": [
    "business",
    "personal"
  ],
  "POST /organizations/:org/personal-income": [
    "business",
    "personal"
  ],
  "GET /organizations/:org/personal-summary": [
    "business",
    "personal"
  ],
  "PATCH /organizations/:org": [
    "business"
  ],
  "GET /organizations/:org/team": [
    "business"
  ],
  "POST /organizations/:org/invitations": [
    "business"
  ],
  "PATCH /organizations/:org/team/:member": [
    "business"
  ],
  "DELETE /organizations/:org/team/:member": [
    "business"
  ],
  "PATCH /organizations/:org/invitations/:invitation": [
    "business"
  ],
  "DELETE /organizations/:org/invitations/:invitation": [
    "business"
  ],
  "GET /organizations/:org/records/:kind": [
    "business",
    "personal",
    "developer"
  ],
  "POST /organizations/:org/records/:kind": [
    "business",
    "personal",
    "developer"
  ],
  "GET /organizations/:org/records/:kind/:id": [
    "business",
    "personal",
    "developer"
  ],
  "PATCH /organizations/:org/records/:kind/:id": [
    "business",
    "personal",
    "developer"
  ],
  "POST /organizations/:org/payment-requests": [
    "business",
    "personal",
    "developer"
  ],
  "GET /organizations/:org/payments": [
    "business"
  ],
  "GET /organizations/:org/reconciliation": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/reconciliation/:id/review": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/import": [
    "business"
  ],
  "GET /organizations/:org/report": [
    "business"
  ],
  "POST /organizations/:org/credentials": [
    "business",
    "developer"
  ],
  "GET /organizations/:org/credentials": [
    "business",
    "developer"
  ],
  "DELETE /organizations/:org/credentials/:id": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/webhooks": [
    "business",
    "developer"
  ],
  "GET /organizations/:org/webhooks": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/webhooks/process": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/webhooks/:id/rotate": [
    "business",
    "developer"
  ],
  "POST /organizations/:org/deliveries/:id/replay": [
    "business",
    "developer"
  ],
  "GET /organizations/:org/audit": [
    "business",
    "developer"
  ],
  "GET /organizations/:org/intelligence": [
    "business"
  ],
  "POST /organizations/:org/forecasts": [
    "business"
  ],
  "GET /organizations/:org/expenses": [
    "business",
    "personal"
  ],
  "POST /organizations/:org/expenses": [
    "business",
    "personal"
  ],
  "GET /organizations/:org/obligations": [
    "business"
  ,"personal"],
  "POST /organizations/:org/obligations": [
    "business"
  ,"personal"],
  "PATCH /organizations/:org/obligations/:id": [
    "business"
  ,"personal"],
  "POST /organizations/:org/assistant": [
    "business"
  ],
  "GET /organizations/:org/automations/templates": [
    "business"
  ],
  "GET /organizations/:org/automations": [
    "business"
  ],
  "POST /organizations/:org/automations": [
    "business"
  ],
  "PATCH /organizations/:org/automations/:id": [
    "business"
  ],
  "POST /organizations/:org/automations/process": [
    "business"
  ],
  "GET /organizations/:org/automation-runs": [
    "business"
  ],
  "GET /organizations/:org/notifications": [
    "business"
  ],
  "PATCH /organizations/:org/notifications/:id": [
    "business"
  ],
  "PUT /organizations/:org/notification-preferences": [
    "business"
  ],
  "GET /organizations/:org/approvals": [
    "business"
  ],
  "POST /organizations/:org/approvals": [
    "business"
  ],
  "POST /organizations/:org/approvals/:id/decide": [
    "business"
  ],
  "GET /organizations/:org/shipments": [
    "business"
  ],
  "POST /organizations/:org/shipments": [
    "business"
  ],
  "POST /organizations/:org/shipments/:id/transition": [
    "business"
  ],
  "POST /organizations/:org/shipments/:id/evidence": [
    "business"
  ],
  "GET /organizations/:org/protected-sales": [
    "business"
  ],
  "POST /organizations/:org/protected-sales": [
    "business"
  ],
  "GET /organizations/:org/protected-sales/:id": [
    "business"
  ],
  "POST /organizations/:org/protected-sales/:id/action": [
    "business"
  ],
  "GET /organizations/:org/disputes": [
    "business"
  ],
  "POST /organizations/:org/disputes/:id/respond": [
    "business"
  ],
  "POST /organizations/:org/disputes/:id/resolve": [
    "business"
  ],
  "GET /organizations/:org/evidence/:resource": [
    "business"
  ],
  "GET /organizations/:org/evidence/:resource/:id/download": [
    "business"
  ],
  "GET /organizations/:org/connectors/catalog": [
    "business"
  ],
  "GET /organizations/:org/connectors": [
    "business"
  ],
  "POST /organizations/:org/connectors": [
    "business"
  ],
  "POST /organizations/:org/connectors/:id/sync": [
    "business"
  ],
  "POST /organizations/:org/connectors/:id/action": [
    "business"
  ],
  "GET /organizations/:org/risk-signals": [
    "business"
  ],
  "POST /organizations/:org/risk-signals/review": [
    "business"
  ],
  "POST /organizations/:org/connectors/:id/import": [
    "business"
  ],
  "GET /organizations/:org/trust/passport": [
    "business"
  ],
  "POST /organizations/:org/trust/passport": [
    "business"
  ],
  "PATCH /organizations/:org/trust/passport": [
    "business"
  ],
  "POST /organizations/:org/trust/evidence": [
    "business"
  ],
  "POST /organizations/:org/trust/identity-reviews": [
    "business"
  ],
  "POST /organizations/:org/trust/documents": [
    "business"
  ],
  "GET /organizations/:org/trust/documents/:id/download": [
    "business"
  ],
  "GET /organizations/:org/trust/credentials": [
    "business"
  ],
  "POST /organizations/:org/trust/credentials": [
    "business"
  ],
  "GET /organizations/:org/trust/credentials/:id": [
    "business"
  ],
  "POST /organizations/:org/trust/issuance-requests": [
    "business"
  ],
  "GET /organizations/:org/trust/issuance-requests": [
    "business"
  ],
  "POST /organizations/:org/trust/credentials/:id/status": [
    "business"
  ],
  "GET /organizations/:org/trust/credentials/:id/proof": [
    "business"
  ],
  "GET /organizations/:org/trust/issuers": [
    "business"
  ],
  "POST /organizations/:org/trust/issuers": [
    "business"
  ],
  "POST /organizations/:org/trust/issuers/:id/rotate": [
    "business"
  ],
  "GET /organizations/:org/trust/relationships": [
    "business"
  ],
  "POST /organizations/:org/trust/relationships": [
    "business"
  ],
  "POST /organizations/:org/trust/relationships/:id/respond": [
    "business"
  ],
  "GET /organizations/:org/trust/requests": [
    "business"
  ],
  "POST /organizations/:org/trust/requests": [
    "business"
  ],
  "POST /organizations/:org/trust/requests/:id/reject": [
    "business"
  ],
  "GET /organizations/:org/trust/grants": [
    "business"
  ],
  "POST /organizations/:org/trust/grants": [
    "business"
  ],
  "POST /organizations/:org/trust/grants/:id/revoke": [
    "business"
  ],
  "GET /organizations/:org/trust/history": [
    "business"
  ],
  "POST /organizations/:org/trust/corrections": [
    "business"
  ],
  "GET /organizations/:org/trust/sources": [
    "business"
  ],
  "GET /organizations/:org/trust/credentials/:id/export": [
    "business"
  ],
  "POST /organizations/:org/trust/issuance-requests/:id/cancel": [
    "business"
  ],
  "POST /organizations/:org/trust/verify": [
    "business"
  ],
  "GET /organizations/:org/trust/reports": [
    "business"
  ]
};
export function workspaceRouteAllowed(method:string,route:string,kind:string,recordKind?:string){
 const key=(method==='HEAD'?'GET':method)+' '+route;
 const allowed=workspaceRouteKinds[key]||marketplaceRouteKinds[key]||financeRouteKinds[key];if(!allowed?.includes(kind))return false;
 if(route.includes('/records/:kind')){if(kind==='personal')return ['customers','invoices','transactions'].includes(recordKind||'');if(kind==='developer')return ['applications','customers','orders','invoices','transactions'].includes(recordKind||'');}
 return true;
}
