import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWriteIntents} from '../src/apps/write-intents.ts';
test('uncertain business writes reuse their idempotency key while new successful intents stay distinct',async()=>{
 const calls=[];let lost=true,n=0;const client=createWriteIntents(async(path,method,body,headers)=>{calls.push({path,method,body,key:headers?.['Idempotency-Key']});if(lost){lost=false;throw Error('response lost after commit');}return {saved:true};},'actor:workspace:sandbox',()=>String(++n));
 await assert.rejects(client.call('/inventory/movements','POST',{quantity_milli:1000}),/response lost/);
 await client.call('/inventory/movements','POST',{quantity_milli:1000});assert.equal(calls[0].key,calls[1].key);
 await client.call('/inventory/movements','POST',{quantity_milli:1000});assert.notEqual(calls[1].key,calls[2].key);
 await client.call('/products');assert.equal(calls[3].key,undefined);
});
test('unresolved write intents are never evicted into an unsafe retry',async()=>{
 let n=0;const keys=[];const client=createWriteIntents(async(_path,_method,_body,headers)=>{keys.push(headers['Idempotency-Key']);throw Error('uncertain');},'scope',()=>String(++n));
 for(let i=0;i<64;i++)await assert.rejects(client.call('/products','POST',{sku:String(i)}),/uncertain/);
 await assert.rejects(client.call('/products','POST',{sku:'new'}),/Too many unconfirmed/);assert.equal(n,64);
 await assert.rejects(client.call('/products','POST',{sku:'0'}),/uncertain/);assert.equal(keys[0],keys.at(-1));
});

test('concurrent identical stock submissions produce one network write and one result',async()=>{
 let calls=0,release;const gate=new Promise(resolve=>{release=resolve;}),client=createWriteIntents(async()=>{calls++;await gate;return {movement_id:'same-movement'};},'actor:workspace:sandbox',()=> 'same-key');
 const one=client.call('/inventory/movements','POST',{quantity_milli:1000}),two=client.call('/inventory/movements','POST',{quantity_milli:1000});await Promise.resolve();assert.equal(calls,1);release();assert.deepEqual(await one,await two);
});
