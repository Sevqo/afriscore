# Private query caching

query-cache.ts holds a bounded 100-entry, 15-second memory cache. Keys include current identity, environment and full organization/resource/query path. Cacheable reads deduplicate concurrent requests. Cached values are cloned; credentials, authentication, capability URLs and CSV are excluded. Nothing is persisted to browser storage. Sign-out and permission failures clear the cache. Workspace mutations invalidate that workspace; account mutations clear all. Pending old-workspace reads can be cancelled, and reference/generation checks prevent late responses repopulating invalidated entries.

At most 45 seconds beyond TTL may be shown while an actual revalidation runs. Server authorization is mandatory on every network read/write. A cache is not an authorization source. Role revocation is enforced immediately by the backend; already rendered content remains visible until the next check.
