import { dbAll, dbGet, dbRun, dbTransaction } from "../db/adapter";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { currencySchema } from "./domain";
import {reserveWorkspaceCreation} from './workspace-limits';
import {activate} from '../marketplace/engine';

export const workspaceInput = z
  .object({
    kind: z.enum(["personal", "business", "developer"]),
    name: z.string().trim().min(2).max(100),
    display_name: z.string().trim().min(1).max(100),
    currency: currencySchema.default("KES"),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .default("KE"),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Invalid timezone")
      .default("Africa/Nairobi"),
    business_type: z.string().max(100).default("sole_proprietor"),
    industry: z.string().max(100).default(""),
    location: z.string().max(200).default(""),
    phone: z.string().max(50).default(""),
    use_case: z.string().max(500).default(""),
    language: z.string().max(80).default(""),
    services:z.array(z.string().regex(/^[a-z][a-z0-9_]{1,60}$/)).max(30).default([]),
  })
  .strict();
export const destination = (
  w: { id: string; kind: string } | null | undefined,
) =>
  !w
    ? "/app/workspaces"
    : w.kind === "business"
      ? "/app/business/" + encodeURIComponent(w.id)
      : "/app/" + w.kind;

export async function createWorkspace(userId: string, input: unknown) {
  const d = workspaceInput.parse(input);
  return dbTransaction(async () => {
    // A harmless update locks this identity on PostgreSQL; SQLite serializes the transaction.
    await dbRun("UPDATE ac_users SET id=id WHERE id=?", [userId]);
    const u = await dbGet("SELECT email FROM ac_users WHERE id=?", [userId]);
    if (!u)
      throw Object.assign(new Error("Identity not found"), { status: 401 });
    if (d.kind !== "business") {
      const existing = await dbGet(
        "SELECT workspace_id FROM ac_owned_workspaces WHERE user_id=? AND kind=?",
        [userId, d.kind],
      );
      if (existing) {
        const allowed=await dbGet("SELECT w.id FROM ac_workspaces w JOIN ac_memberships m ON m.org_id=w.id WHERE w.id=? AND w.status='active' AND m.user_id=? AND m.role='owner'",[existing.workspace_id,userId]);
        if(!allowed)throw Object.assign(new Error('Owned workspace access is unavailable; request an access review'),{status:403});
        return { id: existing.workspace_id, kind: d.kind, existing: true };
      }
    }
    const id = randomUUID(),
      stamp = new Date().toISOString();
    await reserveWorkspaceCreation(userId);
    const profile =
      d.kind === "business"
        ? {
            name: d.name,
            business_type: d.business_type,
            industry: d.industry,
            location: d.location,
            country: d.country,
            currency: d.currency,
            timezone:d.timezone,
            email: u.email,
            phone: d.phone,
            features: [],
          }
        : {
            name: d.name,
            currency: d.currency,
            timezone:d.timezone,
            country: d.country,
            resource_container: true,
            workspace_kind: d.kind,
          };
    await dbRun(
      "INSERT INTO ac_organizations(id,name,profile,created_at) VALUES (?,?,?,?)",
      [id, d.name, JSON.stringify(profile), stamp],
    );
    await dbRun(
      "INSERT INTO ac_workspaces(id,kind,status,created_at) VALUES (?,?,?,?)",
      [id, d.kind, "active", stamp],
    );
    await dbRun(
      "INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'owner')",
      [id, userId],
    );
    if (d.kind !== "business")
      await dbRun(
        "INSERT INTO ac_owned_workspaces(user_id,kind,workspace_id) VALUES (?,?,?)",
        [userId, d.kind, id],
      );
    await dbRun(
      `INSERT INTO ac_profiles(user_id,display_name,primary_experience,last_workspace_id,timezone,currency,onboarding_status,updated_at) VALUES (?,?,?,?,?,?,'complete',?)
 ON CONFLICT(user_id) DO UPDATE SET display_name=CASE WHEN ac_profiles.onboarding_status='complete' THEN ac_profiles.display_name ELSE excluded.display_name END,primary_experience=COALESCE(ac_profiles.primary_experience,excluded.primary_experience),last_workspace_id=excluded.last_workspace_id,timezone=CASE WHEN ac_profiles.onboarding_status='complete' THEN ac_profiles.timezone ELSE excluded.timezone END,currency=CASE WHEN ac_profiles.onboarding_status='complete' THEN ac_profiles.currency ELSE excluded.currency END,onboarding_status='complete',updated_at=excluded.updated_at`,
      [userId, d.display_name, d.kind, id, d.timezone, d.currency, stamp],
    );
    await dbRun(
      `INSERT INTO ac_account_details(user_id,country,use_case,language) VALUES (?,?,?,?) ON CONFLICT(user_id) DO NOTHING`,
      [userId, d.country, d.use_case, d.language],
    );
    for(const service of d.services)await activate({org:id,actor:userId,environment:'sandbox',role:'owner',api:false},service);
    return { id, kind: d.kind, existing: false };
  });
}

/** Preferences are hints only; every resolution rechecks live membership. */
export async function resolveWorkspace(userId: string) {
  const [rows,profile] = await Promise.all([dbAll(
    `SELECT w.id,w.kind,o.name,m.role,o.profile AS workspace_settings
 FROM ac_workspaces w JOIN ac_organizations o ON o.id=w.id
 JOIN ac_memberships m ON m.org_id=w.id
 WHERE m.user_id=? AND w.status='active' ORDER BY w.created_at,w.id`,
    [userId],
  ),dbGet("SELECT * FROM ac_profiles WHERE user_id=?", [
    userId,
  ])]);
  const memberships=rows.map(({workspace_settings,...w})=>{
    let settings:any={};try{settings=JSON.parse(workspace_settings);}catch{/* Old metadata has safe defaults. */}
    return {...w,currency:settings.currency||profile?.currency||'KES',timezone:settings.timezone||profile?.timezone||'Africa/Nairobi'};
  });
  const workspace =
    memberships.find((w) => w.id === profile?.last_workspace_id) ||
    memberships.find((w) => w.kind === profile?.primary_experience) ||
    memberships[0];
  return {
    profile: profile || null,
    workspaces: memberships,
    workspace: workspace || null,
    destination: destination(workspace),
  };
}

export async function selectWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  return dbTransaction(async () => {
    const allowed = await dbGet(
      `SELECT w.id FROM ac_workspaces w
 JOIN ac_memberships m ON m.org_id=w.id
 WHERE m.user_id=? AND w.id=? AND w.status='active'`,
      [userId, workspaceId],
    );
    if (!allowed) return false;
    await dbRun(
      `INSERT INTO ac_profiles(user_id,last_workspace_id,updated_at) VALUES (?,?,?)
 ON CONFLICT(user_id) DO UPDATE SET last_workspace_id=excluded.last_workspace_id,updated_at=excluded.updated_at`,
      [userId, workspaceId, new Date().toISOString()],
    );
    return true;
  });
}
