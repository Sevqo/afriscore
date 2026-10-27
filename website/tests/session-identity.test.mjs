import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionIdentity } from '../src/accounts/session-identity.ts';
const jwt=(exp=Date.now()/1000+900)=>'eyJhbGciOiJFZERTQSJ9.'+Buffer.from(JSON.stringify({exp})).toString('base64url')+'.test-signature';
test('workspace identity uses the SDK session JWT without calling the cached /token endpoint',async()=>{
  const token=jwt();let calls=0;
  const headers=await sessionIdentity({getSession:async options=>{calls++;assert.equal(options.fetchOptions.credentials,'include');return {data:{user:{id:'test'},session:{token}}};},token:()=>{throw Error('must not call token');}});
  assert.deepEqual(headers,{Authorization:'Bearer '+token});assert.equal(calls,1);
});
test('expired or opaque cached sessions force one provider read and never send an opaque token',async()=>{
  for(const old of ['opaque-cookie-token',jwt(Date.now()/1000-1)]){let calls=0;const token=jwt();const headers=await sessionIdentity({getSession:async options=>{calls++;if(calls===2)assert.equal(options.fetchOptions.headers['X-Force-Fetch'],'true');return {data:{user:{id:'test'},session:{token:calls===1?old:token}}};}});assert.equal(headers.Authorization,'Bearer '+token);assert.equal(calls,2);}
  await assert.rejects(sessionIdentity({getSession:async()=>({data:{user:{id:'test'},session:{token:'opaque'}}})}),/could not be restored/);
  assert.deepEqual(await sessionIdentity({getSession:async()=>({data:null})}),{});
});
test('installed Neon SDK /token cache behavior reproduces the old failure and session identity works',async()=>{
  const original=globalThis.fetch;const token=jwt();let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({user:{id:'sdk-test',email:'sdk@example.invalid'},session:{token:'opaque-cookie-token',expiresAt:new Date(Date.now()+86400000).toISOString()}},{headers:{'set-auth-jwt':token}});};
  try{
    const {createAuthClient}=await import('@neondatabase/auth');const {BetterAuthVanillaAdapter}=await import('@neondatabase/auth/vanilla');
    const client=createAuthClient('https://auth.example.invalid',{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include'}})});
    const session=await client.getSession();assert.equal(session.data.session.token,token);
    const old=await client.token();assert.equal(old.data.token,undefined);assert.equal(calls,1);
    assert.deepEqual(await sessionIdentity(client),{Authorization:'Bearer '+token});
  }finally{globalThis.fetch=original;}
});
