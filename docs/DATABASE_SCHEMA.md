# Account schema

Retain the existing pg driver and SQLite adapter. No ORM migration or replacement data store was introduced. Neon is the chosen primary hosted application database.

004 adds ac_workspaces (organization ID FK, authoritative kind/status) and ac_profiles (user FK, display name, experience preference, last workspace FK, currency/timezone/onboarding). Existing organizations backfill as Business without ID changes.

005 adds ac_owned_workspaces with unique user/kind and workspace references; ac_identity_links with unique provider/subject and application user; ac_account_details with country/use case/language, revocation cutoff and deletion-request timestamp; ac_revoked_access_tokens with hashes/expiry; and ac_personal_income with resource/user FKs, environment, explicit currency and integer minor units. Scope indexes support membership and financial access. PostgreSQL tables enable default-deny RLS/revoke PUBLIC, retaining trusted backend authorization.

Managed identities/sessions/verification remain provider-owned in neon_auth. ac_users is the application projection, not a parallel managed password store. Projection creates an unusable random local credential and managed mode disables local credential endpoints. Financial/evidence/credential schema from Stages 1–3 remains unchanged. Private file custody remains bounded encrypted storage; large-file object storage, malware scans and physical retention/purge remain separate launch work.

Scoped API request outcomes are also persisted in ac_api_request_logs with workspace/credential foreign keys and an environment/time index. Metadata contains method, redacted route pattern, status and time; it excludes keys, bodies and query strings. Post-response observability is best effort and is not a billing-grade immutable event ledger.
