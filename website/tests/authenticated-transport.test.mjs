import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedTransport} from '../src/lib/authenticated-transport.ts';
test('operations, trust and downloads carry current identity and preserve request metadata',async()=>{
  let sent=[],counter=0;
  const send=createAuthenticatedTransport(async(path,options)=>{sent.push({path,options});return new Response('ok');},async()=>({Authorization:'Bearer test-'+(++counter)}),()=>false);
  for(const path of ['/api/v1/organizations/test/intelligence','/api/v1/organizations/test/passport','/api/v1/organizations/test/report?format=csv']) {
    await send(path,{headers:{'X-Environment':'sandbox','Idempotency-Key':'unique'},method:'POST',body:'{}'});
    const {options}=sent.at(-1);assert.equal(options.headers.get('Authorization'),'Bearer test-'+counter);assert.equal(options.headers.get('X-Environment'),'sandbox');assert.equal(options.headers.get('Idempotency-Key'),'unique');assert.equal(options.credentials,'same-origin');
  }
  await assert.rejects(send('https://untrusted.example/api/'),/same-origin/);assert.equal(sent.length,3);
  await send('/api/v1/organizations/test/records/customers',{headers:{Authorization:'Bearer scoped-explorer-key'}});assert.equal(sent.at(-1).options.headers.get('Authorization'),'Bearer scoped-explorer-key');assert.equal(counter,3);
});
test('demo and public legacy auth do not initialize managed authentication',async()=>{
  const identity=async()=>{throw new Error('must not obtain identity');};
  for(const demo of [true,false]) {
    const send=createAuthenticatedTransport(async(_path,options)=>new Response(options.headers.get('Authorization')||'none'),identity,()=>demo);
    assert.equal(await (await send(demo?'/api/v1/organizations':'/api/auth/signin')).text(),'none');
  }
});
