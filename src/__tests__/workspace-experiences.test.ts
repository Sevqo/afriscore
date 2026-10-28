import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { configureTestEnv,productFixtureBody } from "./helpers";
configureTestEnv("workspace-experiences");
import { migrate, closeDb, dbGet, dbRun } from "../db";
import { createApp } from "../app";
import { migrateWorkspaceExperiences } from "../platform/workspace-schema";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>, base: string;
before(async () => {
  await migrate();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + (server.address() as any).port;
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await closeDb();
});
async function req(
  path: string,
  method = "GET",
  body?: any,
  cookie = "",
  headers: Record<string, string> = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...headers },
    body: body === undefined ? undefined : JSON.stringify(productFixtureBody(path,method,body)),
  });
  return {
    status: response.status,
    data: (await response.json()) as any,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
async function identity() {
  const email = randomUUID() + "@example.test",
    password = "Safe-synthetic-identity-2026!";
  const r = await req("/api/auth/signup", "POST", { email, password });
  assert.equal(r.status, 201);
  return { ...r, email, password };
}
const setup = (kind: string) => ({
  kind,
  name: kind + " workspace",
  display_name: "Synthetic owner",
  country: "KE",
  currency: "KES",
  timezone: "Africa/Nairobi",
});
test("Personal onboarding, invoice/expense/income persistence, relogin and cross-type tenant permissions", async () => {
  const u = await identity(),
    other = await identity();
  const personal = await req(
    "/api/auth/workspaces",
    "POST",
    setup("personal"),
    u.cookie,
  );
  assert.equal(personal.status, 201);
  const id = personal.data.id,
    b = "/api/v1/organizations/" + id;
  const retry = await req(
    "/api/auth/workspaces",
    "POST",
    setup("personal"),
    u.cookie,
  );
  assert.equal(retry.data.id, id);
  const row = await dbGet("SELECT profile FROM ac_organizations WHERE id=?", [
    id,
  ]);
  assert.equal(JSON.parse(row.profile).resource_container, true);
  assert.equal(JSON.parse(row.profile).business_type, undefined);
  const client = await req(
    b + "/records/customers",
    "POST",
    { name: "A freelance client" },
    u.cookie,
  );
  assert.equal(client.status, 201);
  const invoice = await req(
    b + "/records/invoices",
    "POST",
    {
      customer_id: client.data.id,
      currency: "KES",
      issue_date: "2026-10-01",
      due_date: "2026-10-30",
      items: [
        { description: "Consulting", quantity: 1, unit_price_minor: 12300 },
      ],
    },
    u.cookie,
  );
  assert.equal(invoice.status, 201);
  assert.equal(
    (
      await req(
        b + "/records/invoices/" + invoice.data.id,
        "PATCH",
        { status: "issued" },
        u.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await req(
        b + "/personal-income",
        "POST",
        {
          description: "Recorded client income",
          amount_minor: 10000,
          currency: "KES",
          occurred_on: "2026-10-02",
        },
        u.cookie,
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await req(
        b + "/expenses",
        "POST",
        {
          description: "Travel",
          amount_minor: 2500,
          currency: "KES",
          occurred_on: "2026-10-03",
          category: "other",
        },
        u.cookie,
      )
    ).status,
    201,
  );
  const totals = await req(
    b + "/personal-summary?currency=KES&from=2026-10-01&to=2026-10-31",
    "GET",
    undefined,
    u.cookie,
  );
  assert.equal(totals.data.manual_income_minor, 10000);
  assert.equal(totals.data.recorded_expenses_minor, 2500);
  assert.equal(totals.data.recorded_net_minor, 7500);
  assert.equal(totals.data.outstanding_invoices_minor, 12300);
  assert.equal(
    (
      await req(
        b + "/personal-summary?currency=USD",
        "GET",
        undefined,
        u.cookie,
      )
    ).data.manual_income_minor,
    0,
  );
  assert.equal(
    (
      await req(
        b + "/personal-summary?from=2026-11-01",
        "GET",
        undefined,
        u.cookie,
      )
    ).data.recorded_net_minor,
    0,
  );
  assert.equal(
    (await req(b + "/team", "GET", undefined, u.cookie)).status,
    403,
  );
  assert.equal(
    (await req(b + "/credentials", "GET", undefined, u.cookie)).status,
    403,
  );
  assert.equal(
    (await req(b + "/records/invoices", "GET", undefined, other.cookie)).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/api/auth/account/workspace",
        "POST",
        { workspace_id: id },
        other.cookie,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/api/auth/account",
        "PATCH",
        {
          display_name: "Other",
          currency: "KES",
          timezone: "Africa/Nairobi",
          primary_experience: "business",
        },
        other.cookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (await req(b + "/records/invoices", "GET", undefined, other.cookie)).status,
    403,
  );
  assert.equal(
    (
      await req(
        b + "/personal-income",
        "POST",
        {
          description: "Forged",
          amount_minor: 1,
          currency: "KES",
          occurred_on: "2026-10-03",
          provider_verified: true,
        },
        u.cookie,
      )
    ).status,
    400,
  );
  const business = await req(
    "/api/auth/workspaces",
    "POST",
    {...setup("business"),currency:'USD',timezone:'Europe/London'},
    u.cookie,
  );
  assert.equal(business.status, 201);
  const preferences=(await req('/api/auth/account','GET',undefined,u.cookie)).data;
  assert.equal(preferences.profile.currency,'KES');
  assert.equal(preferences.profile.timezone,'Africa/Nairobi');
  assert.equal(preferences.workspaces.find((w:any)=>w.id===business.data.id).currency,'USD');
  assert.equal(preferences.workspaces.find((w:any)=>w.id===id).currency,'KES');
  assert.equal(
    (await req("/api/auth/account", "GET", undefined, u.cookie)).data.workspaces
      .length,
    2,
  );
  assert.equal(
    (await req(b + "/records/invoices", "GET", undefined, u.cookie)).data.data
      .length,
    1,
  );
  await req(
    "/api/auth/account/workspace",
    "POST",
    { workspace_id: id },
    u.cookie,
  );
  await req("/api/auth/signout", "POST", {}, u.cookie);
  const login = await req("/api/auth/signin", "POST", {
    email: u.email,
    password: u.password,
  });
  assert.equal(login.status, 200);
  const resolved = await req(
    "/api/auth/account",
    "GET",
    undefined,
    login.cookie,
  );
  assert.equal(resolved.data.destination, "/app/personal");
  assert.equal(resolved.data.workspace.id, id);
  await dbRun("DELETE FROM ac_memberships WHERE org_id=? AND user_id=?", [
    id,
    u.data.id,
  ]);
  assert.equal((await req('/api/auth/workspaces','POST',setup('personal'),login.cookie)).status,403);
  assert.equal(
    (await req(b + "/personal-income", "GET", undefined, login.cookie)).status,
    403,
  );
  assert.equal(
    (await req("/api/auth/account", "GET", undefined, login.cookie)).data
      .workspace.id,
    business.data.id,
  );
  await migrateWorkspaceExperiences();
});
test("Developer onboarding needs no company, scoped keys work only in their sandbox and ordinary developers are not staff", async () => {
  const u = await identity(),
    other = await identity();
  const dev = await req(
    "/api/auth/workspaces",
    "POST",
    setup("developer"),
    u.cookie,
  );
  assert.equal(dev.status, 201);
  const b = "/api/v1/organizations/" + dev.data.id;
  assert.equal(
    (await req("/api/auth/account", "GET", undefined, u.cookie)).data
      .destination,
    "/app/developer",
  );
  const application = await req(
    b + "/records/applications",
    "POST",
    { name: "Synthetic application" },
    u.cookie,
  );
  assert.equal(application.status, 201);
  const key = await req(
    b + "/credentials",
    "POST",
    { application_id: application.data.id, scopes: ["read"] },
    u.cookie,
  );
  assert.equal(key.status, 201);
  assert.equal(
    (
      await req(b + "/records/customers", "GET", undefined, "", {
        Authorization: "Bearer " + key.data.key,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req(b + "/records/customers", "POST", { name: "Denied" }, "", {
        Authorization: "Bearer " + key.data.key,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(b + "/credentials", "GET", undefined, u.cookie, {
        "X-Environment": "production",
      })
    ).status,
    403,
  );
  assert.equal(
    (await req(b + "/team", "GET", undefined, u.cookie)).status,
    403,
  );
  assert.equal(
    (await req("/api/v1/internal", "GET", undefined, u.cookie)).status,
    403,
  );
  const business = await req(
    "/api/auth/workspaces",
    "POST",
    setup("business"),
    other.cookie,
  );
  assert.equal(business.status, 201);
  await dbRun("INSERT INTO ac_memberships(org_id,user_id,role) VALUES (?,?,'viewer')",[business.data.id,u.data.id]);
  const employer='/api/v1/organizations/'+business.data.id;
  assert.equal((await req(employer+'/records/customers','GET',undefined,u.cookie)).status,200);
  assert.equal((await req(employer+'/records/customers','POST',{name:'Viewer cannot create'},u.cookie)).status,403);
  assert.equal((await req('/api/auth/account','GET',undefined,u.cookie)).data.workspaces.length,2);

  assert.equal(
    (
      await req(
        "/api/v1/organizations/" + business.data.id + "/records/customers",
        "GET",
        undefined,
        "",
        { Authorization: "Bearer " + key.data.key },
      )
    ).status,
    403,
  );
  assert.equal(
    (await req(b + "/records/applications", "GET", undefined, other.cookie))
      .status,
    403,
  );
  assert.equal(
    (await req(b + "/credentials/" + key.data.id, "DELETE", {}, u.cookie))
      .status,
    200,
  );
  assert.equal(
    (
      await req(b + "/records/customers", "GET", undefined, "", {
        Authorization: "Bearer " + key.data.key,
      })
    ).status,
    403,
  );
  const stored = await dbGet("SELECT key_hash FROM ac_credentials WHERE id=?", [
    key.data.id,
  ]);
  assert.notEqual(stored.key_hash, key.data.key);
  let requestLogs:any;
  for(let attempt=0;attempt<10;attempt++) {
    requestLogs=await req(b+'/request-logs','GET',undefined,u.cookie);
    if(requestLogs.data.data?.some((r:any)=>r.status_code===403))break;
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  assert.equal(requestLogs.status,200);
  assert.ok(requestLogs.data.data.some((r:any)=>r.status_code===403));
  assert.ok(!JSON.stringify(requestLogs.data).includes(key.data.key));
  assert.equal((await req(b+'/request-logs','GET',undefined,other.cookie)).status,403);
  const invalid = await req(
    "/api/auth/workspaces",
    "POST",
    { ...setup("developer"), timezone: "Not/A-Timezone" },
    u.cookie,
  );
  assert.equal(invalid.status, 400);
});
