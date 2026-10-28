import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireGateway } from '../middleware/gateway';
import {config,validateConfig} from '../config';
test('configured origin lock rejects direct access while preserving health and user authorization',async()=>{
  const original=process.env.AFRICORE_GATEWAY_SECRET;process.env.AFRICORE_GATEWAY_SECRET='gateway-test-value-with-at-least-32-characters';
  const app=express();app.use(requireGateway);app.get('/v1/health',(_req,res)=>res.json({ok:true}));app.get('/api/auth/config',(req,res)=>res.json({authorization:req.header('authorization'),gatewayRemoved:!req.header('x-africore-gateway-secret')}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();if(!address||typeof address==='string')throw Error('Missing port');const base='http://127.0.0.1:'+address.port;
  try{assert.equal((await fetch(base+'/v1/health')).status,200);assert.equal((await fetch(base+'/api/auth/config')).status,403);const response=await fetch(base+'/api/auth/config',{headers:{'x-africore-gateway-secret':process.env.AFRICORE_GATEWAY_SECRET,authorization:'Bearer scoped-user'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{authorization:'Bearer scoped-user',gatewayRemoved:true});}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));if(original===undefined)delete process.env.AFRICORE_GATEWAY_SECRET;else process.env.AFRICORE_GATEWAY_SECRET=original;}
});
test('production origin lock fails closed, rotates credentials and trusts only edge-bound client metadata',async()=>{
 const previous={node:process.env.NODE_ENV,key:process.env.AFRICORE_GATEWAY_SECRET,old:process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS};
 const app=express();app.set('trust proxy',1);app.use(requireGateway);app.get('/identity',(req,res)=>res.json({ip:req.ip,removed:!req.header('x-africore-client-ip')}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as any).port;
 try{
 process.env.NODE_ENV='production';delete process.env.AFRICORE_GATEWAY_SECRET;delete process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS;
 assert.equal((await fetch(base+'/identity')).status,403);assert.ok(validateConfig({...config,isProduction:true,gatewaySecret:''}).errors.some(e=>e.includes('GATEWAY_SECRET')));
 process.env.AFRICORE_GATEWAY_SECRET='current-credential-'.repeat(3);process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS='previous-credential-'.repeat(3);
 for(const key of [process.env.AFRICORE_GATEWAY_SECRET,process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS])for(const ip of ['192.0.2.1','198.51.100.2','2001:db8::1']){const response=await fetch(base+'/identity',{headers:{'x-africore-gateway-secret':key,'x-africore-client-ip':ip,'x-forwarded-for':'spoofed, 203.0.113.1'}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ip,removed:true});}
 delete process.env.AFRICORE_GATEWAY_SECRET_PREVIOUS;assert.equal((await fetch(base+'/identity',{headers:{'x-africore-gateway-secret':'previous-credential-'.repeat(3)}})).status,403);
 assert.equal((await fetch(base+'/identity',{headers:{'x-africore-gateway-secret':process.env.AFRICORE_GATEWAY_SECRET,'x-africore-client-ip':'127.0.0.1, 192.0.2.1'}})).status,403);
 }finally{for(const [key,value]of Object.entries({NODE_ENV:previous.node,AFRICORE_GATEWAY_SECRET:previous.key,AFRICORE_GATEWAY_SECRET_PREVIOUS:previous.old})){if(value===undefined)delete process.env[key];else process.env[key]=value;}await new Promise<void>(r=>server.close(()=>r()));}
});
