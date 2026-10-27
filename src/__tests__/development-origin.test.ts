import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {configureTestEnv} from './helpers';
configureTestEnv('development-origin');
import {sameOrigin} from '../platform/auth';
import {closeDb} from '../db';
after(closeDb);
test('development origin allowlist is exact and cannot weaken production or cross-site checks',async()=>{
  const old={node:process.env.NODE_ENV,origin:process.env.AFRICORE_PUBLIC_ORIGIN,dev:process.env.AFRICORE_DEV_ORIGINS};
  const app=express();app.post('/guard',sameOrigin,(_req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const request=(origin:string,extra:Record<string,string>={})=>fetch('http://127.0.0.1:'+address.port+'/guard',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:'{}'});
  try{
    process.env.NODE_ENV='development';process.env.AFRICORE_PUBLIC_ORIGIN='https://app.example.test';process.env.AFRICORE_DEV_ORIGINS='https://phone.example.test';
    assert.equal((await request('https://phone.example.test')).status,200);
    assert.equal((await request('https://phone.example.test.attacker.test')).status,403);
    assert.equal((await request('https://phone.example.test',{'Sec-Fetch-Site':'cross-site'})).status,403);
    assert.equal((await request('https://phone.example.test',{'Content-Type':'text/plain'})).status,415);
    process.env.NODE_ENV='production';assert.equal((await request('https://phone.example.test')).status,403);
    assert.equal((await request('https://app.example.test')).status,200);
  }finally{
    for(const [key,value] of Object.entries({NODE_ENV:old.node,AFRICORE_PUBLIC_ORIGIN:old.origin,AFRICORE_DEV_ORIGINS:old.dev}))if(value===undefined)delete process.env[key];else process.env[key]=value;
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
