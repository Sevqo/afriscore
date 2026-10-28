# Security test and release record

28 October 2026. Tests exercise synthetic local fixtures; ordinary test commands never target Neon. Detailed logs and encrypted backup are ignored under `.tmp/security`.

| Check | Recorded result |
|---|---|
| Full SQLite regression | Final run: 231 discovered, 230 passed, one PostgreSQL-only skip, zero failures |
| Full PostgreSQL regression | Final run: 231/231 passed against dedicated local PostgreSQL 17 |
| Targeted financial/security | 33/33 passed, including receipt race, final receipt timestamp, currency/window, key rotation and local password policy |
| Frontend production build/content | 50 prerendered routes; final patched-SDK build and all 24 tests passed |
| Worker gateway tests | Final rerun 4/4 passed |
| Type/lint/architecture | Final root type/lint and 58-module frontend graph passed |
| Development startup checks | 3/3 passed |
| Legacy contract | Exactly 59 mounted operations documented |
| Workspace contract | Exactly 151 mounted workspace operations documented |
| Local EVM/independent verifier | Passed; own local chain and disposable fixture database |
| Approved development migration | 006 applied after encrypted public application snapshot (59 tables / 161 rows), encrypted readback verified |

The direct database TCP endpoints timed out. The approved maintenance succeeded through the official Neon driver's TLS WebSocket channel to the same direct endpoint. No certificate validation was disabled. Application/auth records were not reset; the backup does not include Neon auth schema or establish a full restore drill.

The first dependency audit discovered newly reported qs and transitive Better Auth issues. Final patched versions are qs 6.17.0 and compatible Better Auth/plugin 1.7.7. Root production audit: zero advisories. Website production audit: seven low-severity transitive advisories, zero moderate/high/critical. The underlying deepmerge advisory has no upstream patched version and belongs to the unused transitive email-rendering/UI dependency path. Do not call the dependency tree wholly advisory-free while it remains. A trial override to 1.7.14 broke the SDK's plugin type inference; the earliest patched 1.7.7 release and aligned plugins preserve SDK compatibility and passed the build/session checks.

A repeated PostgreSQL run initially hit retained fixture reservations under the new platform-wide AI quota. Tests now reset only synthetic usage at serial suite setup; actual production caps remain unchanged. Test helpers also refuse nonlocal database targets. The final rerun passed 231/231. Sandbox-denied HTTP fixture attempts are excluded from successful runs and were rerun with loopback permission.

The patched SDK successfully obtained the existing approved synthetic managed session and read account plus Personal, Business and Developer hosted endpoints (all HTTP 200) before release. A first attempt timed out while the free backend was asleep; its public readiness probe warmed it and the retry passed. This validates compatibility with the existing host, not deployment of the new backend yet.

Before this release, deployed application commit was `3451fda`, with main documentation commit `1d6c657`, Render deployment `dep-dbgg62g473hc73dunctg` and Worker version `eca89b18-a110-459a-9b7f-48448e55103d`. The current source is on `codex/security-second-pass` until the commit/push step. No claim that these new controls are deployed is made by that baseline record.

## Final gates and hosted release

Local release gates passed as recorded above. The final connection-pinning/security/gateway subset passed 17/17. The hosted verification below records the actual deployed source and evidence. Never infer password/MFA enforcement on the vendor-managed server from a frontend package update.

## Verified hosted release — 28 October 2026

Application source `e8f63b16b66c418ae19121142af138ff107f295f` is pushed to both `main` and `codex/security-second-pass`. All five main CI jobs passed in [run 40676189785](https://github.com/Sevqo/afriscore/actions/runs/40676189785): SQLite, PostgreSQL, website, type/lint/startup/edge, local EVM/independent verifier.

The existing Render service deployed that exact application source successfully as `dep-dbgtamrbc2fs73bjke3g`. Compatible encryption readers were checked before `AFRICORE_ENCRYPTION_WRITE_VERSION=2` was saved and activated by environment deployment `dep-dbgtd5ek1f9s7394mkug` (21 seconds, live). No keys were changed. Do not roll back to the old `3451fda` reader after this activation.

Cloudflare Worker `africore-web` is published as version `34e13b31-a2dc-462d-9722-a40681d48c87`, serving the new compact interface, all 23 guide diagrams and hardened gateway policy. The existing gateway secret was retained. The deployed backend's successful startup also exercised verify-only migration 006 checks.

Hosted HTTP checks:

| Probe | Result |
|---|---|
| Direct protected Render auth configuration | 403 |
| Direct and edge readiness | 200, only `status` in response |
| Anonymous edge account access | 401 |
| Edge `/api/v1/internal/trust/operations` | 404, JSON, no-store |
| Edge `/v1/clients` | 404, JSON, no-store |
| Edge auth configuration | 200, no-store |
| New Trust Network diagram | 200, SVG |
| Approved synthetic managed account / Personal / Business / Developer | All 200 |

With explicit additional approval, the QA Business workspace created one private, clearly synthetic Passport (no documents or verification claims). Its hosted encrypted row starts with `v2.`, decrypts with the correct tenant/environment/type/ID context and rejects a substituted ID. API readback succeeded. Aggregate checks confirmed the original seven application users and nine workspaces remain, and the legitimate Continua organization is present. No real customer's Passport or identity was modified. This verifies new hosted writes, not bulk migration of historical ciphertext.

Private local evidence: `hosted-release-result.json`, `development-migration-result.json`, encrypted backup and `render-security-live.png` under ignored `.tmp/security`. The disposable local PostgreSQL test cluster was stopped after the passing gates; its data files were retained. The ordinary HTTP localhost preview remains available.

The final documentation/configuration commit records this verified state; Render remains on the tested application source above because automatic deployment is disabled. MFA, breach-screening consent, historical re-encryption, KYC lifecycle, external checkpoint custody and low-severity upstream advisories remain explicitly listed in RESIDUAL_RISKS.
