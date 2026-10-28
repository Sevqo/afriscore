# Authentication and workspace bootstrap performance

## Findings and changes

Login previously performed a full-page transition into `/app`, then `location.replace` during account render into the workspace, reconstructing the SDK and repeating bootstrap. Personal/Developer loaded every product endpoint together on each refresh; one unavailable product blocked the complete page. Successful managed sign-in also rendered an unnecessary verification action. Ordinary 403 product/role denial cleared the whole account as if its session had expired.

Local navigation now keeps the application and provider modules mounted, redirects in an effect, bounds API requests and distinguishes identity failure (401) from a scoped denial. Identity header restoration deduplicates only concurrent calls and guards against an old result restoring a logged-out identity. Private data stays memory-only and scoped; no token/capability is persisted for speed.

Account bootstrap includes the currently resolved workspace's catalog, with explicit workspace/environment scope, so the matching service hook can use it once without another initial fetch. Workspace membership and profile reads run together. Catalog reads run together. Managed identity restoration combines fresh provider/link/app-state/revocation reads into a joined query; a changed identity still follows the locked synchronization path. No identity or membership result is cached across backend requests. `Server-Timing` exposes identity/workspace/catalog durations without identifiers or credentials.

Personal and Developer fetch only relevant view data; optional product failures no longer disable foundation pages. Passport support reads run in parallel and credential-only support data is not fetched for a Passport-only subscriber. Intelligence similarly excludes unactivated optional expense/obligation reads.

## Measured baseline

28 October 2026, existing Cloudflare/Render evaluation, approved synthetic identity, server responses fully consumed:

| Measurement | Before |
|---|---:|
| Provider session/JWT restoration | 1,842 ms |
| First account request | 14,220 ms |
| Three warm account requests | 1,229 / 905 / 915 ms |
| Business report | 1,354 ms |

This measures HTTP/session stages, not a fresh verified mailbox login or physical iPhone rendering. The first request includes host wake-up/network effects; it is not a steady-state database query benchmark.

## Verified post-release sample

Deployed backend `a3510ff`, same synthetic session and Cloudflare/Render path: provider restoration 1,017 ms; first account request 863 ms; three warm account requests 656 / 656 / 672 ms; report 1,353 ms. Median warm account latency changed from 915 to 656 ms (about 28% lower) while adding a scoped catalog to bootstrap. `Server-Timing` showed roughly 53 ms identity, 57–58 ms membership/profile and 102–104 ms catalog work. The independent report endpoint was essentially unchanged.

These are three observational warm samples per release, not a controlled p95 benchmark. The 14.2-second baseline first request and the warmed post-deploy first request are not comparable cold-start trials. Provider/network/cache conditions also differ, so do not attribute the entire observed change to application code. No guarantee is made that a sleeping free instance signs in within one second.

Render's free service may sleep. Removing redundant requests cannot eliminate a sleeping backend's cold start. No paid hosting upgrade, fabricated latency target or authentication bypass was introduced.
