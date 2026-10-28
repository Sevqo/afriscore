const kinds=['personal','business','developer'] as const;
export const marketplaceRouteKinds:Record<string,readonly string[]>={
 'GET /organizations/:org/services':kinds,
 'POST /organizations/:org/services/:service/activate':kinds,
 'POST /organizations/:org/services/:service/deactivate':kinds,
 'PATCH /organizations/:org/services/:service/preferences':kinds,
 'GET /organizations/:org/usage':kinds,
 'GET /organizations/:org/usage/events':kinds,
 'GET /organizations/:org/usage/export':kinds,
 'PUT /organizations/:org/usage/limits/:service':kinds,
 'POST /organizations/:org/billing/statements':kinds,
 'GET /organizations/:org/billing/statements/:id':kinds,
 'POST /organizations/:org/verification':['business','developer'],
 'GET /organizations/:org/overview':['business'],
};
