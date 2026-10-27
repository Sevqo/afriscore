import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from 'pg';
import {configureTestEnv} from './helpers';
const {isPg}=configureTestEnv('postgres-disconnect');
import {dbTransaction,dbGet,closeDb} from '../db';
after(closeDb);
test('a checked-out PostgreSQL connection failure rejects its transaction and the pool recovers',{skip:!isPg},async()=>{
  const killer=new Client({connectionString:process.env.TEST_DATABASE_URL});await killer.connect();
  try{
    await assert.rejects(dbTransaction(async()=>{
      const row=await dbGet<{pid:number}>('SELECT pg_backend_pid() AS pid');assert.ok(row);
      await killer.query('SELECT pg_terminate_backend($1)',[row.pid]);
      await new Promise(resolve=>setTimeout(resolve,30));
      await dbGet('SELECT 1');
    }),/terminat|connection|closed/i);
    assert.equal((await dbGet<{ok:number}>('SELECT 1 AS ok'))?.ok,1);
  }finally{await killer.end();}
});
