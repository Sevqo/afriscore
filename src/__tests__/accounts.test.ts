import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { configureTestEnv } from "./helpers";
configureTestEnv("accounts");
import { migrate, dbRun, dbGet, closeDb } from "../db";
import { migrateAccounts } from "../platform/accounts-schema";
import { resolveWorkspace, selectWorkspace } from "../platform/accounts";
import { createApp } from "../app";

before(migrate);
after(closeDb);
test("account backfill preserves IDs, preferences and current membership authorization", async () => {
  const owner = randomUUID(),
    stranger = randomUUID(),
    org = randomUUID(),
    stamp = new Date().toISOString();
  for (const id of [owner, stranger])
    await dbRun(
      "INSERT INTO ac_users(id,email,password_hash,created_at) VALUES (?,?,?,?)",
      [id, `${id}@example.test`, "unusable-test-fixture", stamp],
    );
  await dbRun(
    "INSERT INTO ac_organizations(id,name,profile,created_at) VALUES (?,?,?,?)",
    [org, "Existing business", "{}", stamp],
  );
  await dbRun(
    "INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,?)",
    [org, owner, "owner"],
  );
  await migrateAccounts();
  assert.equal((await resolveWorkspace(owner)).workspace?.id, org);
  assert.equal((await resolveWorkspace(owner)).workspace?.kind, "business");
  assert.equal(await selectWorkspace(stranger, org), false);
  assert.equal(await selectWorkspace(owner, org), true);
  await dbRun(
    "UPDATE ac_profiles SET display_name=?,primary_experience=? WHERE user_id=?",
    ["Preserved", "developer", owner],
  );
  await migrateAccounts();
  const profile = await dbGet("SELECT * FROM ac_profiles WHERE user_id=?", [
    owner,
  ]);
  assert.equal(profile.display_name, "Preserved");
  assert.equal(profile.last_workspace_id, org);
  await dbRun("DELETE FROM ac_memberships WHERE org_id=? AND user_id=?", [
    org,
    owner,
  ]);
  assert.equal((await resolveWorkspace(owner)).workspace, null);
  assert.equal(await selectWorkspace(owner, org), false);
  assert.equal((await resolveWorkspace(stranger)).workspaces.length, 0);
});

test("authenticated account API creates a profile and rejects spoofed workspace selection", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/auth`;
  try {
    const anonymous = await fetch(base + "/account");
    assert.equal(anonymous.status, 401);
    const signup = await fetch(base + "/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${randomUUID()}@example.test`,
        password: "Synthetic-account-test-829!Zone",
      }),
    });
    assert.equal(signup.status, 201);
    const identity = (await signup.json()) as any;
    const cookie = signup.headers.get("set-cookie")!.split(";")[0];
    const account = await fetch(base + "/account", {
      headers: { Cookie: cookie },
    });
    assert.equal(account.status, 200);
    assert.equal(account.headers.get("cache-control"), "no-store");
    const body = (await account.json()) as any;
    assert.equal(body.profile.user_id, identity.id);
    assert.equal(body.workspace, null);
    const sessions = await fetch(base + "/sessions", {
      headers: { Cookie: cookie },
    });
    assert.equal(sessions.status, 200);
    const sessionBody = (await sessions.json()) as any;
    assert.ok(sessionBody.data.length >= 1);
    assert.ok(!JSON.stringify(sessionBody).includes("token_hash"));
    const spoof = await fetch(base + "/account/workspace", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: randomUUID() }),
    });
    assert.equal(spoof.status, 403);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
