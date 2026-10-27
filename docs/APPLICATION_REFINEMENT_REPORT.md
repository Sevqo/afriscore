# Authenticated application release report — 2026-10-27

## Implemented
Compact shared operational density across Business, Personal and Developer; bounded responsive native date fields; honest empty states; active historical chart controls; Personal recorded activity; matching report/CSV filters; scoped memory caching/deduplication, cancellation and invalidation; shared account bootstrap; parallel independent reads; expanded member directory and serialized invitation/role/removal APIs; editable obligation lifecycle. Public marketing, sidebar, Continua and existing Neon identities/data remain intact. No schema migration is required.

## Defects found during verification
The credential rate limiter counted ordinary authenticated navigation, causing workspace-unavailable failures after repeated account reads. It now limits credential operations only; 45 consecutive account reads and continued brute-force protection are regression tested. Browser testing found report dates clearing on Apply; submission now reads native form values and synchronizes applied dates. Rapid Intelligence date requests now participate in scope/version guards. A local chain rerun encountered old SQLite rows encrypted under a prior random test key; the chain check now owns a clean disposable fixture and explicitly excludes external test databases.

## Validation
Backend: SQLite 213 discovered, 212 passed, one PostgreSQL-only skip; isolated PostgreSQL17 213/213. Final frontend build/prerender and23tests passed, including cache cancellation. Startup configuration 3/3, lint/static cycle check, legacy 59-operation and workspace 151-operation contracts passed. Local EVM contract, trust suite and independent onchain proof verifier passed after fixture repair.

Forty layout observations cover five views at 320/360/375/390/430/768/1024/1440 requested widths. No document or native-date overflow; initially invalid desktop observations caused by the limiter were retested successfully. Local browser checked chart period selection, member search and date entry. Original user images are baseline visual evidence; new captures are local ignored QA artifacts. Metrics: empty Overview 2825→1818px at390px, cards135.8→103px. Cache benchmark is local query-layer evidence only (20.55ms cold;0.0283ms memory average), not hosted route speed.

## Boundaries and remaining qualification
No physical iPhone/Safari or comprehensive assistive-technology certification, real invitation mailbox delivery, founder password entry, paid upgrade, live payment, mainnet or production-branch change. Invitation delivery is manual. Member join/activity timestamps are unrecorded. Some grouped widget loads and form draft persistence remain improvement areas. Free Render can cold-start. Distributed limits/leases remain required before multi-instance scaling. Production partners and regulatory permissions are not supplied by this refinement.

## Deployment
Target remains the existing Cloudflare Worker at https://africore-web.cypriankiprop41.workers.dev and its existing Render backend. Final commit, CI and verified deployment outcome are recorded in DEPLOYMENT_TEST_RESULTS.md; preparation and local tests alone do not constitute deployment.

Release verified: application commit3451fda; Cloudflare versioneca89b18-a110-459a-9b7f-48448e55103d; Render live3451fda; all5CIjobs green in run40574152381. Approved synthetic managed account read all3workspace kinds200 and new Personal/team payloads. Homepage/login/config/readiness200, anonymous401, direct backend403. See DEPLOYMENT_TEST_RESULTS for exact scope.
