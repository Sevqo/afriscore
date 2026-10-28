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

Local release gates passed as recorded above. The final connection-pinning/security/gateway subset passed 17/17. Hosted application rollout and CI run identifiers will be appended after the source push; they are not yet claimed here. Never infer live protection from a source push, nor password/MFA enforcement on the vendor-managed server from a frontend package update.
