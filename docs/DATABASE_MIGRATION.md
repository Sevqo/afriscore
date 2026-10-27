# Account migration

Migrations 004/005 are additive and transactional per migration, with a version ledger, FKs and repeatable INSERT ON CONFLICT backfills. Existing users, organizations and memberships are retained; never assign legacy consent subjects to a new identity. No destructive down migration is supplied. Roll back application binaries without deleting financial history.

Before work, the normal SQLite database was backed up consistently under ignored .tmp/neon. It contained no application users or organizations. No demo dataset was imported. Development was created schema-only, then application migrations were applied using DIRECT_URL and verified TLS. Production was not migrated.

Managed provider links preserve stable application IDs. An email collision is rejected for explicit reviewed migration; never auto-link an unverified address or replace a password hash. Existing nonempty installations need a user-authenticated identity-link/recovery migration before selecting managed mode. No automatic bulk credential import is claimed.

Run scripts/neon-migrate.cjs only with the private development env-file; it checks development markers, a reviewed direct endpoint and verified TLS. Verify branch identity in Console when rotating endpoints. Test ordinary suites only on disposable local PostgreSQL/SQLite, never production. Back up encryption keys separately and restore-test before production rollout.

## Account identities and branches

Identity links remain bound to the exact configured managed-auth origin plus subject. An optional automatic cross-branch namespace remapping was rejected by automatic review and was not applied. New schema-only staging environments can use their own identities. A branch copy containing identities, or a changed auth endpoint origin, needs a separately reviewed provider-link migration that preserves IDs and checks collisions. Never silently merge by email or reuse production sessions in a preview.
