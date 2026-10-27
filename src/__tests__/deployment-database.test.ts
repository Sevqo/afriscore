import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDatabase } from '../deployment-database';
test('hosted schema verification reads existing versions and tables without running migrations', async()=>{
  let migrated=false;const queries:string[]=[];
  const db={isPostgres:true,migrate:async()=>{migrated=true;},dbAll:async(sql:string)=>{queries.push(sql);return ['001-workspaces','002-stage2','003-stage3','004-account-foundation','005-workspace-experiences'].map(version=>({version}));}};
  await prepareDatabase('verify',db);assert.equal(migrated,false);assert.equal(queries.length,2);assert.ok(queries.every(sql=>sql.startsWith('SELECT')));
  await assert.rejects(prepareDatabase('verify',{...db,dbAll:async()=>[]}),/incomplete/);
  await assert.rejects(prepareDatabase('verify',{...db,isPostgres:false}),/PostgreSQL/);
  await assert.rejects(prepareDatabase('typo',db),/must be/);
  await prepareDatabase(undefined,db);assert.equal(migrated,true);
});
