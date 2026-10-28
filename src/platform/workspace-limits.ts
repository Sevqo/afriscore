import {dbGet,dbRun} from '../db';
/** Call inside the same transaction as creation; no email-based identity keys. */
export async function reserveWorkspaceCreation(userId:string){
  await dbRun('UPDATE ac_users SET id=id WHERE id=?',[userId]);
  const rows=await dbGet("SELECT COUNT(*) AS total FROM ac_memberships WHERE user_id=? AND role='owner'",[userId]);
  const recent=await dbGet("SELECT COUNT(*) AS total FROM ac_memberships m JOIN ac_organizations o ON o.id=m.org_id WHERE m.user_id=? AND m.role='owner' AND o.created_at>=?",[userId,new Date(Date.now()-86400000).toISOString()]);
  const limit=(name:string,fallback:number)=>{const n=Number(process.env[name]??fallback);if(!Number.isInteger(n)||n<1||n>1000)throw Object.assign(new Error('Invalid workspace limit configuration'),{status:503});return n;};
  if(Number(rows.total)>=limit('AFRICORE_WORKSPACE_OWNER_LIMIT',20)||Number(recent.total)>=limit('AFRICORE_WORKSPACE_DAILY_LIMIT',10))throw Object.assign(new Error('Workspace creation limit reached; request an authorized limit review'),{status:429});
}
