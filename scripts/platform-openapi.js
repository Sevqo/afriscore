const fs = require('node:fs');
const source = fs.readFileSync('src/platform/routes.ts', 'utf8');
const auth = fs.readFileSync('src/platform/auth.ts', 'utf8');
const stage2 = fs.readFileSync('src/operations/routes.ts', 'utf8');
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
const paths = {};
const operations = [
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
  if (path.endsWith('/payment-requests') && method === 'post')
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
  if (['post', 'patch'].includes(method))
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
