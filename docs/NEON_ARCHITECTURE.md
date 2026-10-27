# Neon and multi-workspace implementation plan

Started 2026-10-27 from 4d55241. This document records work in progress; it is not a release acceptance report.

## Audited baseline

Express/TypeScript serves React/Vite. The existing pg adapter already persists Stage 1–3 through DATABASE_URL; SQLite is the local fallback. Authentication has one server identity table, scrypt credentials, hashed random sessions, verified/expiring one-time tokens, same-origin writes and membership checks. Browser-local data is an explicitly isolated guest transport, not the persistence layer for ordinary authenticated accounts. Financial events, allocations, journals, evidence and signed credentials are already database-backed. Private attachments currently use bounded encrypted database custody; large-file object storage remains separate work.

Existing limitations: one Business shell, no durable primary experience/onboarding/last-workspace profile, merchant-shaped developer onboarding, no dedicated Personal workspace, public demo-password promotion and production email delivery gate. No hosted Supabase/external identity provider is present. Preserve all existing user/resource IDs, roles, signed history and legacy consent boundaries.

## Neon foundation observed

The user-created AfriCore project is autumn-water-21744826 (AWS US East 2). Its production branch is br-square-meadow-b42xcnk2. Created development br-jolly-lake-b4ff04st as a schema-only branch, no parent rows copied, no expiry. Existing Free plan shows ten included branches; no plan/billing upgrade was made. Pooled and direct credentials are stored only in ignored .env.neon.development.

Both endpoints connect to PostgreSQL 18.6 with a certificate-verified TLSv1.3 client socket. Backend pg_stat_ssl is false behind Neon's terminating proxy; the client socket verification is the relevant observation. The new development branch has no application tables yet. No migration has been applied to production. The local database is backed up independently; browser demo records will not be imported as authenticated financial evidence.

## Execution sequence

1. Retain pg and the existing migration infrastructure. Add direct-connection migration/check commands, branch/environment guards and placeholder-only documentation. Test only on development or disposable databases.
2. Add application-owned profiles/workspace types/preferences/onboarding/last-active state, preserving existing organization IDs and memberships. Existing Business tenants map additively. Personal and Developer resource containers are not merchant profiles and need no incorporation fields.
3. Build a server resolver that validates current memberships and maps to allowlisted Personal, Business or Developer destinations. Primary preference never grants permissions. Add transactional, retry-safe onboarding and workspace creation.
4. Build focused Personal and Developer shells; reuse the full Business product. Preserve separate manually recorded income versus provider evidence. Keep developer sandbox keys scoped to their own resources and deny unreviewed production capability.
5. Evaluate Managed Better Auth using current official documentation. Preserve existing identities with an explicit supported transition; never silently replace hashes, merge by unverified email, or enable a second disconnected identity store. Managed service activation/configuration must be concrete and reviewed before it is enabled. Keep production email/auth limitations explicit until verified.
6. Move guest access to /demo, remove published shared-password promotion from login, and preserve guest isolation. Add settings/security flows, authorization and multi-account journey tests, then run existing Stage 1–3 checks on isolated PostgreSQL/Neon and inspect responsive UI.

Production migration, billing upgrades, customer-data import and external integrations are not implicitly authorized by successful development setup. Final provider choice, schema, migrations and acceptance evidence will be recorded as implementation proceeds.

## Development foundation implemented

The earlier empty-schema observation is historical. Migration 004-account-foundation has now been applied on the isolated development branch together with existing migrations. New profiles reference existing users; typed workspaces reference existing organizations. Existing organizations backfill as Business without changing IDs or memberships. New Business creation registers workspace metadata transactionally. Personal/Developer creation is not enabled yet.

GET /api/auth/account resolves only active workspaces joined to current memberships. POST /api/auth/account/workspace validates membership before saving selection. Preferences never authorize access. The Business selector saves/restores selection; guest transport remains separate. New signup creates a profile with the existing identity transaction. Revocation tests cover stale saved preferences. Login no longer publishes shared demo credentials.

Both private URLs now specify sslmode=verify-full. The development migration entry point requires a direct endpoint, explicit development environment/branch ID, a private matching endpoint allowlist and verified TLS. A synthetic profile committed through the pooled connection was read through a separate direct connection and removed. This proves database persistence, not completion of managed authentication or every user journey.

Still pending: managed auth activation/provider transition, real email delivery, account-type chooser, Personal/Developer shells and provisioning, settings/security journeys, broader account-type permission tests and production deployment. Existing server authentication remains operational with its production registration/recovery gate. Do not represent this foundation as the completed specification.

## Managed authentication and workspace experiences

The earlier pending-provider notes above are historical. Development now uses Neon Managed Better Auth; migration 005 adds owned Personal/Developer containers, stable external identity links, account details, hashed revoked access tokens, scoped API request metadata and normalized manual income. Personal/Developer creation is enabled with server-side capability allowlists. Business resource IDs and original membership roles are preserved.

The exact persistent development database CREATE grant to neon_service was explicitly approved by the user after automatic review blocked the initial proposal. It allowed Neon to create its auth schemas. No existing application-table grants or production changes were made. This permission and managed-auth activation must be reviewed independently when setting up another environment.

The API verifies provider JWT signatures/issuer/audience/lifetime plus current provider identity state. Workspace authorization still belongs to AfriCore. Legacy identities are preserved and collisions require explicit migration. See AUTHENTICATION for revocation boundaries and real-mailbox/device limitations. No production-readiness, live-finance or institutional-issuer claims are made.
