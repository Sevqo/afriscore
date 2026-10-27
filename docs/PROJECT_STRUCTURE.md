# Project structure

Reviewed 2026-10-27. AfriCore remains a modular TypeScript monolith with one React website and one Express API. Independent services have not been invented for individual products.

| Responsibility | Source ownership |
| --- | --- |
| Runtime configuration / HTTP assembly | src/config.ts, src/index.ts, src/app.ts |
| Database adapters / legacy schema | src/db/adapter.ts, src/db/index.ts |
| Identity, memberships, three workspace types, sessions | src/platform/auth.ts, neon-auth.ts, accounts.ts, accounts.ts and workspace-schema.ts |
| Customers, orders, invoices, payments, reconciliation, developer keys | src/platform/routes.ts, domain.ts, payments.ts |
| Financial intelligence / forecasting | src/operations/intelligence.ts |
| Read-only assistant / consent | src/operations/assistant.ts |
| Automation / notifications / approvals | src/operations/automation.ts, events.ts, worker.ts |
| Connect / imports | src/operations/integrations.ts |
| Fulfillment / protected purchase / disputes | src/operations/commerce.ts |
| Passport / evidence / relationships | src/trust/domain.ts, sharing.ts, routes.ts |
| Credentials / cryptographic proofs / anchoring | src/trust/credentials.ts, proofs.ts, worker.ts; chain/ |
| Original consent / onboarding / Orbit APIs | src/routes/, src/services/, src/orbit/ |
| Public education / navigation | website/src/education/, components/Header.tsx, App.tsx |
| Account entry / security / routing | website/src/accounts/AuthPage.tsx, AccountChooser.tsx, AccountSettings.tsx, WorkspaceSetup.tsx, Accounts.tsx |
| Personal / Developer workspace shell | website/src/accounts/FocusedWorkspace.tsx, DeveloperPanels.tsx |
| Business shell / operational products / Passport | website/src/BusinessApp.tsx, operations/, trust/ |
| Shared authenticated HTTP requests / downloads | website/src/lib/api-client.ts, authenticated-transport.ts |
| Shared controls / media / charts | website/src/components/, charts/, accounts/AccountUI.tsx |
| Design tokens / fonts | dashboard/shared/theme.css and fonts/ |

The former src/stage2 and website/src/stage2 directories are now operations; stage3 directories are now trust. Internal workspace/worker/migration function names use those domain names. Historical documents may retain delivery-stage names. Published /internal/stage2 routes, ac2_/ac3_ tables, migration keys 002-stage2 and 003-stage3, event payloads and Solidity identifiers are compatibility interfaces and have not been renamed.

Database schema remains additive and is owned by the existing domain schema modules. Services use dbGet/dbAll/dbRun/dbTransaction; browsers never connect to PostgreSQL. Keep integer financial amounts, explicit currencies, current membership checks and source assurance separate. Add changes to the owning module, extend its contracts and tests, regenerate the platform contract only for intentional API changes, and run both database suites.

The frontend dependency graph is checked by npm run lint. Logo, Header, authentication, HTTP transport and educational examples no longer depend back on application entry components. The account file was split by responsibility rather than adding more unrelated account features to one file. BusinessApp and platform/routes remain large; further splits should follow real feature changes with integration tests, not cosmetic churn.

Builds clear only the resolved repository dist directory before compiling, preventing renamed test suites from running twice. Private environments, databases, certificates and QA fixtures stay ignored. Open AfriCore.code-workspace in VS Code and use its workspace TypeScript version after npm ci in both packages.
