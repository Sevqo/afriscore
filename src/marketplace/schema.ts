import {dbAll,dbGet,dbExec,dbRun,dbTransaction,isPostgres} from '../db/adapter';
import {serviceCatalog} from './catalog';
import {randomUUID} from 'node:crypto';
export const marketplaceStatements=[
 'CREATE TABLE IF NOT EXISTS ac_services (id TEXT PRIMARY KEY,version INTEGER NOT NULL,definition TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS ac_service_prices (id TEXT PRIMARY KEY,service_id TEXT NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(service_id,version))',
 'CREATE TABLE IF NOT EXISTS ac_service_entitlements (org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,status TEXT NOT NULL,price_id TEXT NOT NULL,configuration TEXT NOT NULL DEFAULT \'{}\',favorite INTEGER NOT NULL DEFAULT 0,position INTEGER NOT NULL DEFAULT 0,activated_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(org_id,environment,service_id))',
 'CREATE TABLE IF NOT EXISTS ac_service_history (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS ac_usage_events (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,meter_id TEXT NOT NULL,actor TEXT NOT NULL,occurred_at TEXT NOT NULL,period TEXT NOT NULL,quantity INTEGER NOT NULL,unit TEXT NOT NULL,source TEXT NOT NULL,idempotency_key TEXT NOT NULL,price_id TEXT NOT NULL,related_event_id TEXT,metadata TEXT NOT NULL,UNIQUE(org_id,environment,service_id,idempotency_key))',
 'CREATE TABLE IF NOT EXISTS ac_usage_reservations (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,actor TEXT NOT NULL,quantity INTEGER NOT NULL,price_id TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS ac_service_limits (org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,monthly_budget_minor INTEGER,quantity_limit INTEGER,hard_stop INTEGER NOT NULL DEFAULT 1,thresholds TEXT NOT NULL,PRIMARY KEY(org_id,environment,service_id))',
 'CREATE TABLE IF NOT EXISTS ac_usage_alerts (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,service_id TEXT NOT NULL,period TEXT NOT NULL,threshold INTEGER NOT NULL,kind TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(org_id,environment,service_id,period,threshold,kind))',
 'CREATE TABLE IF NOT EXISTS ac_billing_statements (id TEXT PRIMARY KEY,org_id TEXT NOT NULL,environment TEXT NOT NULL,period TEXT NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(org_id,environment,period,currency))',
 'CREATE INDEX IF NOT EXISTS ac_usage_scope ON ac_usage_events(org_id,environment,period,service_id)',
 'CREATE INDEX IF NOT EXISTS ac_usage_reservations_scope ON ac_usage_reservations(org_id,environment,status,service_id)',
 'CREATE INDEX IF NOT EXISTS ac_service_history_scope ON ac_service_history(org_id,environment,created_at)',
];
export const evaluationPrice=(id:string)=>({service_id:id,version:'evaluation-v1',currency:'KES',model:'free',unit:serviceCatalog.find(s=>s.id===id)!.unit,included:0,unit_minor:0,fixed_minor:0,tiers:[],minimum_minor:0,cap_minor:null,period:'monthly',effective_at:'2026-10-28T00:00:00.000Z',expires_at:null,tax_treatment:'No collection or tax invoice; evaluation estimate only.',description:'Free evaluation. No customer charging is enabled.'});
export async function migrateMarketplace(database={dbAll,dbGet,dbExec,dbRun,dbTransaction,isPostgres}){
 const {dbAll,dbGet,dbExec,dbRun,dbTransaction,isPostgres}=database;
 await dbTransaction(async()=>{
 if(await dbGet('SELECT version FROM platform_migrations WHERE version=?',['007-service-marketplace']))return;
 for(const statement of marketplaceStatements)await dbExec(statement);
 const at=new Date().toISOString();
 for(const s of serviceCatalog){await dbRun('INSERT INTO ac_services(id,version,definition,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING',[s.id,s.version,JSON.stringify(s),at]);await dbRun('INSERT INTO ac_service_prices(id,service_id,version,data,created_at) VALUES (?,?,?,?,?) ON CONFLICT(service_id,version) DO NOTHING',[s.id+':evaluation-v1',s.id,'evaluation-v1',JSON.stringify(evaluationPrice(s.id)),at]);}
 // Preserve only already-existing workspaces. New workspaces choose services.
 const existing=await dbAll('SELECT o.id,COALESCE(w.kind,\'business\') AS kind FROM ac_organizations o LEFT JOIN ac_workspaces w ON w.id=o.id');
 for(const w of existing)for(const s of serviceCatalog.filter(s=>s.kinds.includes(w.kind))){
  for(const environment of ['sandbox','production']){
   if(w.kind==='developer'&&environment==='production')continue;
   const status=s.availability==='requires_configuration'?'requires_setup':'active';
   await dbRun('INSERT INTO ac_service_entitlements(org_id,environment,service_id,status,price_id,activated_at,updated_at) VALUES (?,?,?,?,?,?,?)',[w.id,environment,s.id,status,s.id+':evaluation-v1',at,at]);
   await dbRun('INSERT INTO ac_service_history(id,org_id,environment,service_id,actor,action,data,created_at) VALUES (?,?,?,?,?,?,?,?)',[randomUUID(),w.id,environment,s.id,'migration:007','legacy_access.preserved',JSON.stringify({status,price_version:'evaluation-v1',charging_enabled:false}),at]);
  }
 }
 if(isPostgres)for(const table of ['ac_services','ac_service_prices','ac_service_entitlements','ac_service_history','ac_usage_events','ac_usage_reservations','ac_service_limits','ac_usage_alerts','ac_billing_statements'])await dbExec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC;`);
 await dbRun('INSERT INTO platform_migrations(version,applied_at) VALUES (?,?)',['007-service-marketplace',at]);
});}
