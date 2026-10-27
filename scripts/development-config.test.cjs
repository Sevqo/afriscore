const {test}=require('node:test');const assert=require('node:assert/strict');const {developmentConfig}=require('./development-config.cjs');
test('development uses fixed ports and exact origins',()=>{const c=developmentConfig({},['192.0.2.10']);assert.equal(c.port,5175);assert.equal(c.readyTimeoutMs,120000);assert.equal(c.apiPort,4005);assert.deepEqual(c.origins,['http://localhost:5175','http://192.0.2.10:5175']);assert.ok(!c.origins.includes('*'));});
test('invalid TLS, port and origin combinations fail before startup',()=>{for(const env of [{DEV_API_READY_TIMEOUT_MS:'0'},{DEV_API_READY_TIMEOUT_MS:'300001'},{DEV_PORT:'0'},{DEV_PORT:'5175',DEV_API_PORT:'5175'},{DEV_TLS_CERT:'cert'},{APP_PUBLIC_URL:'https://example.test'},{APP_PUBLIC_URL:'http://localhost:5175/path'}])assert.throws(()=>developmentConfig(env));const c=developmentConfig({DEV_TLS_CERT:'cert',DEV_TLS_KEY:'key',APP_PUBLIC_URL:'https://africore.local:5175'});assert.equal(c.scheme,'https');assert.ok(c.origins.includes('https://africore.local:5175'));});

const {developmentEnvironmentFile}=require('./development-config.cjs');
test('environment selection preserves explicit configuration and supports a private external env file',()=>{
 const fake=(paths,content='{"envFile":"C:/private/development.env"}')=>({existsSync:p=>paths.includes(p),readFileSync:()=>content});
 assert.equal(developmentEnvironmentFile({DEV_ENV_FILE:'explicit.env'},fake(['.env.neon.development'])),'explicit.env');
 assert.equal(developmentEnvironmentFile({},fake(['.env.neon.development','.africore-dev.json'])),'.env.neon.development');
 assert.equal(developmentEnvironmentFile({},fake(['.africore-dev.json'])),'C:/private/development.env');
 assert.equal(developmentEnvironmentFile({},fake([])),'.env');
 for(const value of ['bad','{}','{"envFile":false}'])assert.throws(()=>developmentEnvironmentFile({},fake(['.africore-dev.json'],value)));
});
