/* Explicit maintenance for the approved development branch only. No .env loader,
 * auth-schema writes, test cleanup, reset, key rotation or network logging. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {parseEnv}=require('node:util');
const websocket=process.argv.includes('--websocket');
const marketplace=process.argv.includes('--marketplace');
const driver=websocket?require('../.tmp/security/neon-runtime/node_modules/@neondatabase/serverless'):require('pg');
if(websocket){driver.neonConfig.webSocketConstructor=WebSocket;driver.neonConfig.useSecureWebSocket=true;}
const {Client}=driver;
let stage='configuration';
async function main(){
 const settings=parseEnv(fs.readFileSync('.env.neon.development','utf8'));
 if(settings.NEON_PROJECT_ID!=='autumn-water-21744826'||settings.NEON_BRANCH_ID!=='br-jolly-lake-b4ff04st')throw Error('Development branch guard failed');
 const url=new URL(settings.DIRECT_URL);
 if(url.hostname!=='ep-square-mountain-b4ht9gb5.c-6.us-east-2.aws.neon.tech'||url.pathname!=='/neondb')throw Error('Direct development endpoint guard failed');
 const keyText=settings.AFRICORE_ENCRYPTION_KEY;
 if(!keyText||keyText.length<32)throw Error('Existing encryption key required');
 for(const parameter of ['sslmode','sslrootcert','sslcert','sslkey','channel_binding'])url.searchParams.delete(parameter);
 const client=new Client({connectionString:url.href,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,query_timeout:60000});
 stage='verified_tls_connection';await client.connect();
 try{
  stage='read_only_snapshot';await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const snapshot={version:1,project:settings.NEON_PROJECT_ID,branch:settings.NEON_BRANCH_ID,at:new Date().toISOString(),tables:[]};
  for(const {tablename} of tables){
   const quoted='"'+tablename.replaceAll('"','""')+'"';
   const result=await client.query('SELECT * FROM public.'+quoted);
   snapshot.tables.push({name:tablename,fields:result.fields.map(({name,dataTypeID})=>({name,dataTypeID})),rows:result.rows});
  }
  await client.query('COMMIT');
  stage='encrypted_backup';const plaintext=Buffer.from(JSON.stringify(snapshot)),digest=crypto.createHash('sha256').update(plaintext).digest('hex');
  const key=crypto.createHash('sha256').update('africore-development-backup-v1:'+keyText).digest(),iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(snapshot.branch));
  const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]);
  const file=path.resolve('.tmp/security/development-backup-'+Date.now()+'.enc');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({version:1,branch:snapshot.branch,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),digest,body:encrypted.toString('base64')}),{flag:'wx',mode:0o600});
  const saved=JSON.parse(fs.readFileSync(file,'utf8')),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(saved.iv,'hex'));
  decipher.setAAD(Buffer.from(saved.branch));decipher.setAuthTag(Buffer.from(saved.tag,'hex'));
  const recovered=Buffer.concat([decipher.update(Buffer.from(saved.body,'base64')),decipher.final()]);
  if(crypto.createHash('sha256').update(recovered).digest('hex')!==digest)throw Error('Backup readback failed');
  const inventory={tables:snapshot.tables.length,rows:snapshot.tables.reduce((n,t)=>n+t.rows.length,0)};
  if(process.argv.includes('--apply')){
   stage='additive_migration';
   // Only canonical reviewed 006 DDL is run, never the full bootstrap.
   const {securityStatements}=require('../dist/platform/security-statements');
   await client.query('BEGIN');
   try{
    for(const statement of securityStatements)await client.query(statement);
    if(marketplace){
     const {migrateMarketplace}=require('../dist/marketplace/schema');
     const query=(sql,params=[])=>{let n=0;return client.query(sql.replace(/\?/g,()=>'$'+(++n)),params);};
     await migrateMarketplace({isPostgres:true,dbTransaction:fn=>fn(),dbGet:async(sql,params)=>(await query(sql,params)).rows[0],dbAll:async(sql,params)=>(await query(sql,params)).rows,dbRun:async(sql,params)=>({changes:(await query(sql,params)).rowCount}),dbExec:sql=>query(sql)});
    }
    for(const table of ['ac_approval_bindings','ac_legacy_deliveries']){
     await client.query('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY');
     await client.query('REVOKE ALL ON '+table+' FROM PUBLIC');
    }
    await client.query('INSERT INTO platform_migrations(version,applied_at) VALUES ($1,$2) ON CONFLICT(version) DO NOTHING',['006-security-hardening',new Date().toISOString()]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}
  }
  const target=marketplace?'007-service-marketplace':'006-security-hardening';
  const after=await client.query('SELECT version FROM public.platform_migrations WHERE version=$1',[target]);
  const summary={branch:snapshot.branch,backup:path.basename(file),encryptedReadbackVerified:true,inventory,migration:target,migrationApplied:after.rows.length===1,fullRestoreTested:false};
  fs.writeFileSync('.tmp/security/development-migration-result.json',JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
 }finally{await client.end();}
}
main().catch(error=>{console.error(JSON.stringify({maintenanceFailed:true,stage,code:/^[A-Z0-9_]{2,50}$/.test(error.code||'')?error.code:'suppressed',timeout:/timeout|timed out/i.test(error.message||''),tls:/certificate|tls|ssl/i.test(error.message||''),privateDetailsSuppressed:true}));process.exitCode=1;});
