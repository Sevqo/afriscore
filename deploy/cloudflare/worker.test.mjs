import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handle } from './worker.mjs';
const env = { BACKEND_ORIGIN:'https://africore-api.example', AFRICORE_GATEWAY_SECRET:'x'.repeat(40), NEON_AUTH_ORIGIN:'https://auth.example', ASSETS:{ fetch:async () => new Response('<html>app</html>',{headers:{'Content-Type':'text/html'}}) } };
test('API paths preserve method, exact query, body and identity without leaking the gateway credential',async()=>{
  let seen;
  const response=await handle(new Request('https://africore.example/api/v1/records?cursor=a%2Fb',{method:'POST',headers:{authorization:'Bearer user-jwt',origin:'https://africore.example','x-africore-gateway-secret':'spoof','x-forwarded-for':'spoof','CF-Connecting-IP':'192.0.2.1'},body:'{"amount":100}'}),env,async request=>{seen=request;return Response.json({ok:true});});
  assert.equal(seen.url,'https://africore-api.example/api/v1/records?cursor=a%2Fb'); assert.equal(seen.headers.get('authorization'),'Bearer user-jwt'); assert.equal(seen.headers.get('origin'),'https://africore.example'); assert.equal(seen.headers.get('x-forwarded-for'),'192.0.2.1'); assert.equal(seen.headers.get('x-africore-gateway-secret'),env.AFRICORE_GATEWAY_SECRET); assert.equal(await seen.text(),'{"amount":100}'); assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('x-africore-gateway-secret'),null);
});
test('HTML backend wake-up pages, redirects, malformed origins and failures are never SPA API successes',async()=>{
  for(const upstream of [()=>new Response('loading',{headers:{'Content-Type':'text/html'}}),()=>Response.redirect('https://other.example'),()=>{throw Error('private details');}]){const response=await handle(new Request('https://africore.example/api/auth/config'),env,upstream);assert.equal(response.status,503);assert.equal((await response.json()).error,'backend_unavailable');}
  for(const invalid of [{...env,BACKEND_ORIGIN:'http://localhost'},{...env,AFRICORE_GATEWAY_SECRET:''}])assert.equal((await handle(new Request('https://africore.example/v1/health'),invalid)).status,503);
});
test('direct workspace refresh uses static fallback with auth CSP; internal paths and non-GET assets are denied',async()=>{
  const response=await worker.fetch(new Request('https://africore.example/app/personal'),env,{}); assert.equal(response.status,200);assert.match(response.headers.get('Content-Security-Policy'),/https:\/\/auth.example/);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal((await handle(new Request('https://africore.example/internal/jobs'),env)).status,404);
  assert.equal((await handle(new Request('https://africore.example/app',{method:'POST'}),env)).status,405);
  assert.equal((await handle(new Request('http://africore.example/login'),env)).status,308);
});
