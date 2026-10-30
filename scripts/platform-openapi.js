const finance = require('node:fs').readFileSync('src/finance/routes.ts','utf8');
const fs = require('node:fs');
const source = fs.readFileSync('src/platform/routes.ts', 'utf8');
const auth = fs.readFileSync('src/platform/auth.ts', 'utf8');
const stage2 = fs.readFileSync('src/operations/routes.ts', 'utf8');
const connected=fs.readFileSync('src/operations/connected-routes.ts','utf8');
const stage3 = fs.readFileSync('src/trust/routes.ts', 'utf8');
const marketplace = fs.readFileSync('src/marketplace/routes.ts', 'utf8');
const { z } = require('zod');
const contracts = require('../dist/operations/contracts');
const schemaNames = [
  'expenseSchema',
  'obligationSchema',
  'forecastSchema',
  'automationSchema',
  'shipmentSchema',
  'evidenceSchema',
  'saleSchema',
  'disputeSchema',
  'assistantInput',
  'workflowEditInput','workflowControlInput','feedbackInput','approvalCancelInput',
];
const trustContracts = require('../dist/trust/contracts');
const trustSchemaNames = [
  'passportInput',
  'evidenceInput',
  'identityInput',
  'issueInput',
  'relationshipInput',
  'requestInput',
  'grantInput',
];
const schemas = Object.fromEntries(
  schemaNames.map((name) => [
    name,
    z.toJSONSchema(contracts[name], {
      target: 'openapi-3.0',
      unrepresentable: 'any',
    }),
  ]),
);
for (const name of trustSchemaNames)
  schemas['trust_' + name] = z.toJSONSchema(trustContracts[name], {
    target: 'openapi-3.0',
    unrepresentable: 'any',
  });
const financialContracts=require('../dist/finance/contracts');for(const [name,schema] of Object.entries(financialContracts))schemas['finance_'+name]=z.toJSONSchema(schema,{target:'openapi-3.0',unrepresentable:'any'});
for(const [name,schema] of Object.entries({dataImportInput:require('../dist/operations/data-platform').dataImportInput,alertPolicy:require('../dist/operations/alerts').alertPolicy}))schemas[name]=z.toJSONSchema(schema,{target:'openapi-3.0',unrepresentable:'any'});
for(const [name,schema]of Object.entries(require('../dist/inventory/contracts')))schemas['inventory_'+name]=z.toJSONSchema(schema,{target:'openapi-3.0',unrepresentable:'any'});
for(const [name,schema] of Object.entries({app_installInput:require('../dist/apps/installations').installInput,app_uninstallInput:require('../dist/apps/installations').uninstallInput,crm_entryInput:require('../dist/operations/crm').crmEntryInput,analytics_savedReportInput:require('../dist/operations/business-analytics').savedReportInput,sales_documentInput:require('../dist/platform/domain').documentSchema}))schemas[name]=z.toJSONSchema(schema,{target:'openapi-3.0',unrepresentable:'any'});
const paths = {};
const operations = [
 ...fs.readFileSync('src/apps/routes.ts','utf8').matchAll(/appRoutes\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
 ...fs.readFileSync('src/operations/business-routes.ts','utf8').matchAll(/business\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...connected.matchAll(/connected\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...finance.matchAll(/finance\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...source.matchAll(/platform\.(get|post|patch|delete)\s*\(\s*'([^']+)'/g),
  ...stage2.matchAll(/operations\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...stage3.matchAll(/trust\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...marketplace.matchAll(/marketplace\.(get|post|put|patch|delete)\s*\(\s*'([^']+)'/g),
  ...auth.matchAll(/auth\.(get|post|patch)\s*\(\s*'([^']+)'/g),
];
for (const op of operations) {
  const isAuth = op[0].startsWith('auth.'),
    method = op[1],
    path =
      (isAuth ? '/api/auth' : '/api/v1') + op[2].replace(/:(\w+)/g, '{$1}');
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
  if (path.includes('{org}'))
    parameters.push({
      name: 'X-Environment',
      in: 'header',
      required: false,
      schema: {
        type: 'string',
        enum: ['sandbox', 'production'],
        default: 'sandbox',
      },
    });
  if ((method==='post'&&(/\/business\/orders\/\{id\}\/draft$/.test(path)||/\/inventory\/replenishment-suggestions\/\{id\}\/review$/.test(path)))||(method==='patch'&&/\/inventory\/warehouses\/\{id\}$/.test(path))||path.endsWith('/payment-requests') && method === 'post'||method==='post'&&/\/(?:adjustment-approvals|discount-approvals|correction-review)$/.test(path)||['post','put','patch'].includes(method)&&(/\/apps\/[^/]+\/(?:install|uninstall)$/.test(path)||/\/products(?:\/\{id\})?$/.test(path)||/\/inventory\/(?:warehouses(?:\/\{id\}\/locations)?|movements|incoming(?:\/\{id\}\/action)?)$/.test(path)||/\/crm\/(?:entries(?:\/\{id\})?|customers\/\{id\})$/.test(path)||/\/sales\/quotations(?:\/\{id\}(?:\/action)?)?$/.test(path)))
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: true,
      schema: { type: 'string', minLength: 8, maxLength: 200 },
    });
  const response = {
    description: 'JSON response; see docs/API.md for workflow and fields',
    content: { 'application/json': { schema: { type: 'object' } } },
  };
  const operation = {
    summary: method.toUpperCase() + ' ' + op[2],
    operationId:
      (isAuth ? 'auth_' : 'workspace_') +
      method +
      '_' +
      op[2].replace(/[^a-zA-Z0-9]/g, '_'),
    parameters,
    responses: {
      200: response,
      201: response,
      400: { description: 'Validation failed' },
      401: { description: 'Authentication required' },
      403: { description: 'Organization, role, scope or environment denied' },
      409: { description: 'State or idempotency conflict' },
      429: { description: 'Rate limited' },
    },
    security:
      path.includes('/checkout/') || (isAuth && ['/config','/signup','/signin','/recover','/verify','/reset'].includes(op[2]))
        ? [{}]
        : [{ session: [] }, { managedSession: [] }, ...(!isAuth?[{ apiKey: [] }]:[])],
  };
  if (['post', 'patch','put','delete'].includes(method))
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            description:
              'Runtime-validated by Zod schemas in src/platform; examples and fields documented in docs/API.md',
          },
        },
      },
    };
  if(method==='post'&&(/\/messages$/.test(path)||/\/data\/imports$/.test(path)||/\/automation-runs\//.test(path)||/\/approvals\/.*\/cancel$/.test(path)))parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:150}});
  if(path.includes('/assistant/')||(method!=='get'&&(path.endsWith('/data/imports')||path.endsWith('/configuration')||path.includes('/automation-runs/')||/\/approvals\/.*\/cancel$/.test(path))))operation.security=[{session:[]},{managedSession:[]}];
  if(method==='post'&&path.endsWith('/messages'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/assistantInput'};
  if(method==='post'&&path.endsWith('/data/imports'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/dataImportInput'};
  if(method==='put'&&path.endsWith('/alerts/policy'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/alertPolicy'};
  if(method==='put'&&path.endsWith('/configuration'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/workflowEditInput'};
  if(method==='post'&&path.includes('/automation-runs/')&&path.endsWith('/control'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/workflowControlInput'};
  if(method==='post'&&path.endsWith('/feedback'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/feedbackInput'};
  if(method==='post'&&path.includes('/approvals/')&&path.endsWith('/cancel'))operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/approvalCancelInput'};
  if(path.includes('/apps/')&&method!=='get'||path.endsWith('/business/workflows/{id}/test')||/\/(?:adjustment-approvals|discount-approvals|correction-review)$/.test(path))operation.security=[{session:[]},{managedSession:[]}];
  const businessSchema=method==='post'?(path.endsWith('/install')?'app_installInput':path.endsWith('/uninstall')?'app_uninstallInput':path.endsWith('/products')?'inventory_productInput':path.endsWith('/inventory/warehouses')?'inventory_warehouseInput':path.endsWith('/locations')?'inventory_locationInput':path.endsWith('/inventory/movements')?'inventory_movementInput':path.endsWith('/inventory/incoming')?'inventory_incomingInput':path.endsWith('/crm/entries')?'crm_entryInput':path.endsWith('/sales/quotations')?'sales_documentInput':path.endsWith('/business/saved-reports')?'analytics_savedReportInput':null):null;
  if(businessSchema)operation.requestBody.content['application/json'].schema={$ref:'#/components/schemas/'+businessSchema};
  const schemaName = path.includes('/trust/')
    ? path.endsWith('/passport')
      ? 'trust_passportInput'
      : path.endsWith('/evidence')
        ? 'trust_evidenceInput'
        : path.endsWith('/identity-reviews')
          ? 'trust_identityInput'
          : path.endsWith('/issuance-requests')
            ? 'trust_issueInput'
            : path.endsWith('/relationships')
              ? 'trust_relationshipInput'
              : path.endsWith('/requests')
                ? 'trust_requestInput'
                : path.endsWith('/grants')
                  ? 'trust_grantInput'
                  : null
    : path.endsWith('/expenses')
      ? 'expenseSchema'
      : path.endsWith('/obligations')
        ? 'obligationSchema'
        : path.endsWith('/forecasts')
          ? 'forecastSchema'
          : path.endsWith('/automations')
            ? 'automationSchema'
            : path.endsWith('/shipments')
              ? 'shipmentSchema'
              : path.endsWith('/protected-sales')
                ? 'saleSchema'
                : path.endsWith('/assistant')
                  ? 'assistantInput'
                  : path.endsWith('/disputes')
                    ? 'disputeSchema'
                    : path.endsWith('/evidence')
                      ? 'evidenceSchema'
                      : null;
  if (method === 'post' && schemaName)
    operation.requestBody.content['application/json'].schema = {
      $ref: '#/components/schemas/' + schemaName,
    };
  if (path.startsWith('/api/v1/trust/') && !path.includes('/presentations/'))
    operation.security = [{}];
  if (path.includes('/trust/presentations/'))
    operation.security = [{ session: [] },{ managedSession: [] }];
  if (
    path.includes('/trust/') &&
    path.includes('/organizations/') &&
    method !== 'get'
  )
    operation.security = [{ session: [] },{ managedSession: [] }];
  if (path.includes('/trust/status/'))
    operation.responses[200].content = {
      'application/vc+jwt': { schema: { type: 'string' } },
    };
  if (path.includes('/buyer/')) {
    operation.security = [{}];
    operation.description =
      'Requires an unexpired opaque buyer capability in the URL. Sandbox only. Buyer actions cannot claim live settlement.';
  }
  if (path.includes('/internal')) operation.security = [{ session: [] },{ managedSession: [] }];
  if (path.includes('/callbacks/'))
    operation.security = [{ sandboxSignature: [] }];
  (paths[path] ||= {})[method] = operation;
}
const doc = {
  openapi: '3.0.3',
  info: {
    title: 'AfriCore Workspace API',
    version: '1.0.0',
    description:
      'Actual workspace routes generated from Express registrations. Separate legacy consent API: openapi.json. All new money fields use integer minor units. Sandbox payments only.',
  },
  servers: [{ url: '/' }],
  components: {
    schemas,
    securitySchemes: {
      session: { type: 'apiKey', in: 'cookie', name: 'ac_session' },
      managedSession:{type:'http',scheme:'bearer',bearerFormat:'JWT',description:'Validated managed identity token. Current application membership is still required.'},
      apiKey: { type: 'http', scheme: 'bearer' },
      sandboxSignature: {
        type: 'apiKey',
        in: 'header',
        name: 'AfriCore-Signature',
      },
    },
  },
  paths,
};
const serialized = JSON.stringify(doc, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (
    !fs.existsSync('platform-openapi.json') ||
    fs.readFileSync('platform-openapi.json', 'utf8') !== serialized
  ) {
    console.error(
      'Workspace OpenAPI is stale. Run node scripts/platform-openapi.js',
    );
    process.exit(1);
  }
  console.log(
    `Validated ${operations.length} workspace operations against Express registrations.`,
  );
} else fs.writeFileSync('platform-openapi.json', serialized);
