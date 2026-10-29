/* Guarded HTTPS maintenance for the approved development branch. No ordinary tests. */
const fs=require('node:fs'),crypto=require('node:crypto'),{parseEnv}=require('node:util');
const {neon}=require('../.tmp/security/neon-runtime/node_modules/@neondatabase/serverless');
let stage='configuration';const deadline=setTimeout(()=>{console.error(JSON.stringify({maintenanceFailed:true,stage,timeout:true,privateDetailsSuppressed:true}));process.exit(1)},90000);
(async()=>{
 const e=parseEnv(fs.readFileSync('.env.neon.development','utf8')),url=new URL(e.DIRECT_URL);
 if(e.NEON_PROJECT_ID!=='autumn-water-21744826'||e.NEON_BRANCH_ID!=='br-jolly-lake-b4ff04st'||url.hostname!=='ep-square-mountain-b4ht9gb5.c-6.us-east-2.aws.neon.tech'||url.pathname!=='/neondb'||!e.AFRICORE_ENCRYPTION_KEY)throw Error('Guard');
 const sql=neon(url.href);stage='read_only_snapshot';
 const tables=await sql.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
 const rows=await sql.transaction(tables.map(t=>sql.query('SELECT * FROM public."'+t.tablename.replaceAll('"','""')+'"')),{isolationLevel:'RepeatableRead',readOnly:true});
 const snapshot={branch:e.NEON_BRANCH_ID,at:new Date().toISOString(),tables:tables.map((t,i)=>({name:t.tablename,rows:rows[i]}))};
 stage='encrypted_backup';const plain=Buffer.from(JSON.stringify(snapshot)),digest=crypto.createHash('sha256').update(plain).digest('hex'),key=crypto.createHash('sha256').update('africore-development-backup-v1:'+e.AFRICORE_ENCRYPTION_KEY).digest(),iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(snapshot.branch));const body=Buffer.concat([c.update(plain),c.final()]);
 fs.mkdirSync('.tmp/security',{recursive:true});const file='.tmp/security/development-https-backup-'+Date.now()+'.enc';fs.writeFileSync(file,JSON.stringify({version:1,branch:snapshot.branch,iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),digest,body:body.toString('base64')}),{flag:'wx',mode:0o600});
 const saved=JSON.parse(fs.readFileSync(file,'utf8')),d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(saved.iv,'hex'));d.setAAD(Buffer.from(saved.branch));d.setAuthTag(Buffer.from(saved.tag,'hex'));const recovered=Buffer.concat([d.update(Buffer.from(saved.body,'base64')),d.final()]);if(crypto.createHash('sha256').update(recovered).digest('hex')!==digest)throw Error('Backup readback');
 const migration='008-financial-operations';const versions=await sql.query('SELECT version FROM platform_migrations');if(!versions.some(v=>v.version==='007-service-marketplace'))throw Error('Foundation missing');
 if(process.argv.includes('--apply')&&!versions.some(v=>v.version===migration)){
  stage='additive_migration';const {financeStatements,financeTables}=require('../dist/finance/schema');const statements=financeStatements.map(s=>s.replace('CREATE VIEW IF NOT EXISTS','CREATE OR REPLACE VIEW'));
  for(const t of financeTables)statements.push('ALTER TABLE '+t+' ENABLE ROW LEVEL SECURITY','REVOKE ALL ON '+t+' FROM PUBLIC');for(const v of ['ac_effective_allocations','ac_financial_events'])statements.push('REVOKE ALL ON '+v+' FROM PUBLIC');
  await sql.transaction([...statements.map(s=>sql.query(s)),sql.query('INSERT INTO platform_migrations(version,applied_at) VALUES ($1,$2)',[migration,new Date().toISOString()])]);
 }
 stage='verification';const applied=(await sql.query('SELECT version FROM platform_migrations WHERE version=$1',[migration])).length===1;
 const result={branch:e.NEON_BRANCH_ID,backup:file.split('/').pop(),encryptedReadbackVerified:true,inventory:{tables:tables.length,rows:rows.reduce((n,r)=>n+r.length,0)},migration,migrationApplied:applied,fullRestoreTested:false};fs.writeFileSync('.tmp/security/financial-migration-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(()=>{console.error(JSON.stringify({maintenanceFailed:true,stage,privateDetailsSuppressed:true}));process.exitCode=1}).finally(()=>clearTimeout(deadline));
