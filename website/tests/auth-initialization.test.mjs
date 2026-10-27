import {test} from 'node:test';
import assert from 'node:assert/strict';
import {singleFlight} from '../src/accounts/single-flight.ts';
test('concurrent authentication callers share one client and can retry a failed initialization',async()=>{
  let calls=0,release;
  const initialize=singleFlight(()=>{calls++;return new Promise(resolve=>{release=resolve;});});
  const first=initialize(),second=initialize();assert.equal(calls,1);assert.equal(first,second);
  const client={ready:true};release(client);assert.equal(await first,client);assert.equal(await initialize(),client);
  let attempts=0;
  const retry=singleFlight(async()=>{if(++attempts===1)throw new Error('offline');return client;});
  await assert.rejects(retry(),/offline/);assert.equal(await retry(),client);assert.equal(attempts,2);
});
