const fs = require('node:fs');
const source = fs.readFileSync('src/platform/routes.ts','utf8');
const auth = fs.readFileSync('src/platform/auth.ts','utf8');
const paths = {};
const operations = [...source.matchAll(/platform\.(get|post|patch|delete)\s*\(\s*'([^']+)'/g), ...auth.matchAll(/auth\.(get|post)\s*\(\s*'([^']+)'/g)];
for (const op of operations) {
 const isAuth = op[0].startsWith('auth.'), method = op[1], path=(isAuth?'/api/auth':'/api/v1')+op[2].replace(/:(\w+)/g,'{$1}');
 const parameters = [...path.matchAll(/\{(\w+)\}/g)].map(m=>({name:m[1],in:'path',required:true,schema:{type:'string'}}));
 if (path.includes('{org}')) parameters.push({name:'X-Environment',in:'header',required:false,schema:{type:'string',enum:['sandbox','production'],default:'sandbox'}});
 if (path.endsWith('/payment-requests') && method==='post') parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:200}});
 const response={description:'JSON response; see docs/API.md for workflow and fields',content:{'application/json':{schema:{type:'object'}}}};
 const operation={summary:method.toUpperCase()+' '+op[2],operationId:(isAuth?'auth_':'workspace_')+method+'_'+op[2].replace(/[^a-zA-Z0-9]/g,'_'),parameters,responses:{'200':response,'201':response,'400':{description:'Validation failed'},'401':{description:'Authentication required'},'403':{description:'Organization, role, scope or environment denied'},'409':{description:'State or idempotency conflict'},'429':{description:'Rate limited'}},security:path.includes('/checkout/')||isAuth?[{}]:[{session:[]},{apiKey:[]}]};
 if(['post','patch'].includes(method)) operation.requestBody={required:true,content:{'application/json':{schema:{type:'object',description:'Runtime-validated by Zod schemas in src/platform; examples and fields documented in docs/API.md'}}}};
 (paths[path] ||= {})[method]=operation;
}
const doc={openapi:'3.0.3',info:{title:'AfriCore Workspace API',version:'1.0.0',description:'Actual workspace routes generated from Express registrations. Separate legacy consent API: openapi.json. All new money fields use integer minor units. Sandbox payments only.'},servers:[{url:'/'}],components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:'ac_session'},apiKey:{type:'http',scheme:'bearer'}}},paths};
const serialized=JSON.stringify(doc,null,2)+'\n';
if(process.argv.includes('--check')) {
 if(!fs.existsSync('platform-openapi.json')||fs.readFileSync('platform-openapi.json','utf8')!==serialized) {console.error('Workspace OpenAPI is stale. Run node scripts/platform-openapi.js');process.exit(1)}
 console.log(`Validated ${operations.length} workspace operations against Express registrations.`);
} else fs.writeFileSync('platform-openapi.json',serialized);
