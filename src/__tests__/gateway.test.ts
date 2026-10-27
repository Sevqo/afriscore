import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireGateway } from '../middleware/gateway';
test('configured origin lock rejects direct access while preserving health and user authorization',async()=>{
  const original=process.env.AFRICORE_GATEWAY_SECRET;process.env.AFRICORE_GATEWAY_SECRET='gateway-test-value-with-at-least-32-characters';
  const app=express();app.use(requireGateway);app.get('/v1/health',(_req,res)=>res.json({ok:true}));app.get('/api/auth/config',(req,res)=>res.json({authorization:req.header('authorization'),gatewayRemoved:!req.header('x-africore-gateway-secret')}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Missing port');const base='http://127.0.0.1:'+address.port;
  try{assert.equal((await fetch(base+'/v1/health')).status,200);assert.equal((await fetch(base+'/api/auth/config')).status,403);const response=await fetch(base+'/api/auth/config',{headers:{'x-africore-gateway-secret':process.env.AFRICORE_GATEWAY_SECRET,authorization:'Bearer scoped-user'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{authorization:'Bearer scoped-user',gatewayRemoved:true});}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));if(original===undefined)delete process.env.AFRICORE_GATEWAY_SECRET;else process.env.AFRICORE_GATEWAY_SECRET=original;}
});
