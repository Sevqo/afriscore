import {dbExec,dbRun,dbTransaction,isPostgres} from '../db/adapter';
import {securityStatements} from './security-statements';
/** Additive only. Apply separately with a verified backup before hosted rollout. */
export async function migrateSecurity(){await dbTransaction(async()=>{
 for(const statement of securityStatements)await dbExec(statement);
 if(isPostgres)for(const table of ['ac_approval_bindings','ac_legacy_deliveries'])await dbExec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC;`);
 await dbRun('INSERT INTO platform_migrations(version,applied_at) VALUES (?,?) ON CONFLICT(version) DO NOTHING',['006-security-hardening',new Date().toISOString()]);
});}
