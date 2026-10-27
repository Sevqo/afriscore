import { dbAll, dbGet, dbRun, dbTransaction } from '../db/adapter';

/** Preferences are hints only; every resolution rechecks live membership. */
export async function resolveWorkspace(userId: string) {
  const memberships = await dbAll(`SELECT w.id,w.kind,o.name,m.role
 FROM ac_workspaces w JOIN ac_organizations o ON o.id=w.id
 JOIN ac_memberships m ON m.org_id=w.id
 WHERE m.user_id=? AND w.status='active' ORDER BY w.created_at,w.id`, [userId]);
  const profile = await dbGet('SELECT * FROM ac_profiles WHERE user_id=?', [userId]);
  const workspace = memberships.find(w => w.id === profile?.last_workspace_id)
    || memberships.find(w => w.kind === profile?.primary_experience)
    || memberships[0];
  return { profile: profile || null, workspaces: memberships, workspace: workspace || null };
}

export async function selectWorkspace(userId: string, workspaceId: string): Promise<boolean> {
  return dbTransaction(async () => {
    const allowed = await dbGet(`SELECT w.id FROM ac_workspaces w
 JOIN ac_memberships m ON m.org_id=w.id
 WHERE m.user_id=? AND w.id=? AND w.status='active'`, [userId, workspaceId]);
    if (!allowed) return false;
    await dbRun(`INSERT INTO ac_profiles(user_id,last_workspace_id,updated_at) VALUES (?,?,?)
 ON CONFLICT(user_id) DO UPDATE SET last_workspace_id=excluded.last_workspace_id,updated_at=excluded.updated_at`,
      [userId, workspaceId, new Date().toISOString()]);
    return true;
  });
}
