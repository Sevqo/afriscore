# Demo login and product walkthrough
Owner: AfriCore engineering. Reviewed 2026-10-26. All demo accounts/data are synthetic and public.

## Browser-only demo — no database or API needed
Open /signin and click Enter demo workspace, or visit /demo. No password is required or accepted by the browser guest transport. No real server session or API credential is created. State is isolated in browser localStorage; Reset demo data restores examples, Sign out exits demo mode. Do not store real information here. For real multi-account persistence use the configured backend, now available in this development setup at http://localhost:4003/get-started, with your own verified identity.

Run npm ci; npm --prefix website ci; npm run demo:web. Default demo URL: http://127.0.0.1:4173/signin . SPA fallback is needed on static hosting; website/public/_redirects supports compatible hosts. Existing source setup can also use npm --prefix website run dev (port5175) without a backend for demo mode.

Explore sample customers, documents, sandbox checkout, recorded expenses/obligations, simplified forecasts, in-app automations/notifications, fulfillment/protected buyer flow, connector/risk samples and Passport/credential screens. Changes persist locally. The sample credential has a real ES256 signature and public key; WebCrypto checks its integrity. Current remote issuer status/authority and chain state are deliberately unavailable. No private signing key lives in the browser. Issuance, separate-recipient authorization, approvals/settlement and internal operator tasks need the connected demo below. Demo computations are simplified; the connected backend implements the full tested domain rules.

## Connected local demo — SQLite created automatically
Run npm run demo:server. It builds the app, listens only on http://127.0.0.1:4001 and creates .tmp/connected-demo.db without touching the normal DB or DATABASE_URL. No external database installation is needed. This is a development-only public-password environment and must never be exposed publicly or pointed at production.

All accounts use password AfriCoreDemo2026!:
- owner@africore.localdemo — Amani Supplies workspace, products/Passport/sharing.
- issuer@africore.localdemo — sandbox issuer, trust operator/engineer and separate business reviewer membership for approvals.
- partner@africore.localdemo — separate commercial counterparty/recipient.

Use the account's actual sign-in fields, not Enter demo workspace, for connected workflows. Log out before switching identities; the same-origin session is shared across tabs. The issuer account may have two workspaces: choose the sandbox issuer workspace for issuance, or Amani Supplies for business approvals. Partner organization ID and issuer ID are visible in the relevant workspace; the seed command prints organization IDs.

Seeded: customer, paid/open invoices, expense, obligation, automation notification, protected sale/order, private Passport, source evidence, approved sandbox issuer, real signed identity credential and pending partner relationship. No live provider, external AI request, customer message or real funds are used. The script explicitly disables OpenAI access. For AI use, configure/fund a normal development workspace separately.

Suggested journeys: owner inspects Credentials/exports; partner confirms relationship; partner requests verification; owner selects exact credentials/purpose and grants access; partner opens the one-time link; issuer reviews new holder-authorized issuance; owner requests protected release only after shipment/buyer acceptance and a separate reviewer approves. Public verification accepts an authorized token/export; issuer status changes invalidate it without removing historical signatures.

Optional genuine local anchoring: npm run chain:node, npm run chain:deploy, then start the connected demo with AFRICORE_DEMO_CHAIN=true. In Trust Operations queue/process eligible batches and export a holder bundle. The local chain is ephemeral, uses public disposable accounts and must never receive real assets. It is not Sepolia.

Stop servers with Ctrl+C. Keep .tmp databases and all keys ignored. A clone does not contain earlier personal accounts; use recovery only against their original connected database. This demo does not reset or alter those accounts.

Physical phones require a reachable HTTPS deployment for WebCrypto; localhost links refer to the device opening them. Viewport QA is recorded separately from physical-device testing.

Connected demo sessions use ac_demo_session, separate from normal ac_session cookies, so testing the demo does not replace a normal app login.

## Current local demo snapshot
These UUIDs identify only this machine's public synthetic demo and will differ on a fresh seed:

| Workspace | Organization ID |
| --- | --- |
| Amani Supplies | 86796f1a-44d7-47a5-b584-fa0fe629e635 |
| Sandbox issuer | 18fc61ce-6b7f-4165-b185-5b36145a93cb |
| Commercial partner | 2e2b387c-cf88-4b8b-ab83-a506261f9043 |

The currently running connected demo has local-chain anchoring enabled and its seeded identity credential anchored. On restart, use the optional chain commands above; no public network or real funds are involved.
