import {dbAll,dbGet,dbExec,dbRun,dbTransaction,isPostgres} from '../db/adapter';
import {serviceCatalog} from '../marketplace/catalog';
import {evaluationPrice} from '../marketplace/schema';
export const appTables=['ac_app_installations','ac_app_history','ac_service_activation_sources'];
export const appStatements=[
 'CREATE TABLE IF NOT EXISTS ac_app_installations (org_id TEXT NOT NULL,environment TEXT NOT NULL,app_id TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL,origin TEXT NOT NULL,configuration TEXT NOT NULL,preferences TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,favorite INTEGER NOT NULL DEFAULT 0,installed_by TEXT NOT NULL,installed_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(org_id,environment,app_id))',
 'CREATE TABLE IF NOT EXISTS ac_app_history (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,app_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS ac_service_activation_sources (org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL REFERENCES ac_services(id),source_type TEXT NOT NULL,source_id TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(org_id,environment,service_id,source_type,source_id))',
 'CREATE INDEX IF NOT EXISTS ac_app_history_scope ON ac_app_history(org_id,environment,app_id,created_at)',
 'CREATE INDEX IF NOT EXISTS ac_app_service_sources ON ac_service_activation_sources(org_id,environment,source_type,source_id)',
];
export async function migrateApps(database={dbAll,dbGet,dbExec,dbRun,dbTransaction,isPostgres}){
 await database.dbTransaction(async()=>{
  if(await database.dbGet('SELECT version FROM platform_migrations WHERE version=?',['010-business-apps']))return;
  for(const statement of appStatements)await database.dbExec(statement);
  if(database.isPostgres)for(const table of appTables){await database.dbExec('ALTER TABLE '+table+' ENABLE ROW LEVEL SECURITY');await database.dbExec('REVOKE ALL ON '+table+' FROM PUBLIC');}
  const at=new Date().toISOString();
  // Preserve historical direct access conservatively; do not infer that an app owned it.
  await database.dbRun("INSERT INTO ac_service_activation_sources(org_id,environment,service_id,source_type,source_id,actor,created_at) SELECT org_id,environment,service_id,'direct','direct','migration:010',? FROM ac_service_entitlements WHERE status IN ('active','requires_setup','suspended') ON CONFLICT(org_id,environment,service_id,source_type,source_id) DO NOTHING",[at]);
  for(const id of ['crm','products','inventory','sales']){const service=serviceCatalog.find(s=>s.id===id)!;await database.dbRun('INSERT INTO ac_services(id,version,definition,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING',[id,service.version,JSON.stringify(service),at]);await database.dbRun('INSERT INTO ac_service_prices(id,service_id,version,data,created_at) VALUES (?,?,?,?,?) ON CONFLICT(service_id,version) DO NOTHING',[id+':evaluation-v1',id,'evaluation-v1',JSON.stringify(evaluationPrice(id)),at]);}
  await database.dbRun('INSERT INTO platform_migrations(version,applied_at) VALUES (?,?)',['010-business-apps',at]);
 });
}
