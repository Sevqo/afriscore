import { test } from 'node:test';
import assert from 'node:assert/strict';
import {QueryCache,queryKey,cacheable} from '../src/lib/query-cache.ts';
import {selectRange,rangeAvailable} from '../src/charts/model.ts';
test('private queries deduplicate, expire, isolate scopes, and resist a late response after invalidation',async()=>{
 let now=0,calls=0;const cache=new QueryCache(()=>now,15);const key=queryKey('user-a','sandbox','/a');const load=async()=>{calls++;return {amount:10};};
 const [one,two]=await Promise.all([cache.read(key,load),cache.read(key,load)]);assert.equal(calls,1);assert.deepEqual(one,two);
 (await cache.read(key,load)).amount=99;assert.equal((await cache.read(key,load)).amount,10);
 await cache.read(queryKey('user-b','sandbox','/a'),load);await cache.read(queryKey('user-a','production','/a'),load);assert.equal(calls,3);
 now=16;await cache.read(key,load);assert.equal(calls,4);
 let release;const pending=cache.read('late',()=>new Promise(resolve=>{release=resolve;}));cache.clear();release({old:true});await pending;assert.equal(cache.peek('late'),undefined);
 assert.equal(cacheable('/api/v1/organizations/org-a/credentials'),false);assert.equal(cacheable('/api/v1/checkout/private-capability'),false);assert.equal(cacheable('/api/v1/organizations/org-a/records/invoices?currency=KES'),true);
});
test('all historical ranges remain selectable with zero or short history and never invent points',()=>{
 for(const range of ['7D','30D','90D','YTD','1Y','ALL']){assert.equal(rangeAvailable([],range),true);assert.deepEqual(selectRange([],range),[]);}
 const points=[{date:'2026-01-01',value:5},{date:'2026-01-07',value:9},{date:'2026-01-08',value:11}];assert.deepEqual(selectRange(points,'7D',false,'2026-01-07').map(p=>p.value),[5,9]);assert.deepEqual(selectRange(points,'7D',false,'2026-02-01'),[]);assert.equal(selectRange(points,'YTD',false,'2026-01-07').length,2);
});
test('cancelling obsolete workspace reads aborts only their pending requests',async()=>{
 const cache=new QueryCache();let oldSignal;
 const old=cache.read('old',signal=>{oldSignal=signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled'))));});
 await cache.read('current',async()=>({safe:true}));
 const rejected=assert.rejects(old,/cancelled/);cache.cancelPending(key=>key==='old');await rejected;
 assert.equal(oldSignal.aborted,true);assert.deepEqual(cache.peek('current'),{safe:true});
 cache.invalidate(key=>key==='current');assert.equal(cache.peek('current'),undefined);
});
