# Online deployment verification

Status: implementation and deployment verification in progress. No URL or live acceptance is claimed by this document until appended with actual observations.

Implemented checks cover the edge API/body/auth forwarding, spoofed forwarding header removal, no-store responses, redirect/loading-page rejection, malformed upstream origin fail-closed behavior, HTTPS redirect, static SPA fallback and backend origin lock. Existing product regression/build/typecheck/contract gates remain mandatory. Docker build must be verified on a working container builder; the local Docker daemon is unavailable.

Separate results are required for actual HTTPS assets/direct routes, trusted Neon origin, existing managed identity/workspaces, database reads, signup/recovery mailbox delivery, user-entered founder sign-in and physical mobile browser. Browser viewport emulation is not a real iPhone test.

## Local checks — 2026-10-27
Backend:209 discovered,208 passed,1PostgreSQL-only skip; disposable SQLite with hosted URLs explicitly disabled. Website:17/17 tests and production build/prerender passed. Typecheck, lint, startup3/3, legacy59/workspace148 contract checks and edge gateway3/3 passed. Read-only approved Neon development probe: verified TLS,3managed users,1matching verified owner,7workspaces,7memberships and1identity link. No rows or passwords changed. Docker daemon is unavailable locally; hosted builder must verify the repaired Dockerfile. Initial Cloudflare upload was rejected for legacy wildcard _redirects; replaced it with comments and native Worker SPA routing.

## Hosted initialization correction
Cloudflare URL was issued and static pages rendered. Render built the Docker image successfully, but startup migration replay timed out and its deploy was marked failed, despite a brief successful readiness interval. Added fail-closed read-only hosted schema verification; no database reset or identity repair was attempted. Backend stability must be rechecked after this correction. The new schema-mode unit test/build/lint passed. GitHub CI for4452a29 passed all five existing checks, including PostgreSQL and local chain.

## Deployed evaluation and session repair
Actual frontend: https://africore-web.cypriankiprop41.workers.dev ; backend: https://africore-api.onrender.com ; Render service srv-dbgcrl6c6qcc73f1hi50. Render schema-verification deploy ea93f45 succeeded and is Live. Cloudflare version4b18a1a3-ece1-4f30-a053-5f06a44e6e0a contains the session fix. Exact frontend origin is registered in Neon development; localhost retained. Existing provider/subjects, keys, production branch and passwords unchanged.

Stable HTTPS checks: auth/config200(providerneon), unauthenticated account401, direct backend auth/config403(gateway_required), database readiness200throughCloudflare. Synthetic session restored using explicit owner approval: account200, Personal summary200, Business intelligence200, Developer applications200; automation, Passport and CSV endpoints also200. Installed official SDK reproduced cached /token failure; repaired shared sessionIdentity accepted its session JWT against all three actual hosted workspaces. Website build/prerender and20/20frontend tests passed, including three new session regressions; lint/cycle check passed54modules.

Public homepage/login/app/personal/product direct routes returned200HTML/no-store. Hosted homepage and login inspected at390px: no horizontal overflow or broken completed images. CSS, logo, font and product composition visibly loaded. Frontend artifact scan100files found no configured private secrets. Initial broad network smoke probes hit initialization timeouts and are not counted as complete asset inventory qualification. Physical mobile/Safari, user-entered founder password, actual mailbox OTP/reset completion and real outbound webhook receiver remain unverified. Shared Neon email is development-only. Optional AI/payment/storage/publisher credentials were not uploaded or activated.

No paid resources activated. Render Free sleeps while idle; scheduled/background execution pauses and in-memory legacy Orbit work is not restart durable. One verified local AfriCore API process was stopped to prevent competing polling. Existing unrelated services unchanged. GitHub deployment workflow is prepared as a manual main-only evaluation pipeline; scoped Cloudflare token/account variable and Render deploy-hook secrets are not configured, so automatic deployment is not claimed. Existing CI for4452a29passed all five checks; later commit CI must be checked separately.


## Authenticated refinement deployment — 2026-10-27

Application commit3451fdac6c5b42200458c2675b83a158b175d450 was pushed to main with the configured cypriankiprop41@gmail.com Git identity. GitHub Actions run40574152381 succeeded: PostgreSQL, SQLite, Type check/lint/startup/gateway, Website build and local EVM/independent verification (all five jobs).

Existing Cloudflare Worker africore-web published version eca89b18-a110-459a-9b7f-48448e55103d at https://africore-web.cypriankiprop41.workers.dev. Existing free Render service srv-dbgcrl6c6qcc73f1hi50 deployed the same3451fda revision; deployment dep-dbgg62g473hc73dunctg visibly reported Deploy succeeded | Live. No new secret, domain, paid instance or schema migration was required.

Post-deployment probes: homepage/login/auth-config/readiness200; anonymous account401; direct backend account403. The approved synthetic managed Neon session resolved account200 and Personal/Business/Developer resources200. Additional assertions confirmed Personal series and member/invitation arrays from the new backend. No hosted financial or founder records were changed by these read-only checks. Deployed explicit browser demo displayed the compact dashboard and truthful synthetic/test labels.

Frontend final23/23 checks, backend213cases(212SQLitepass+1PG-only skip;213PostgreSQLpass), all required local gates passed. Local disposable PostgreSQL stopped. Free Render sleep/cold-start, manual invitation delivery, physical iPhone/mailbox qualification and production authorization limits remain as documented. Automatic deployment secrets were not added; this release used existing manual deployment paths.
