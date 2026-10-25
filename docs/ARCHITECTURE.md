# Architecture
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Retained: Express/TypeScript, SQLite/PostgreSQL adapter, legacy consent services, hash-chained ledger, statement importers, reconciliation, Orbit and React/Vite. No unrelated framework was introduced.

Boundaries: /v1 preserves legacy operator/consent APIs. /api/auth owns user identity. /api/v1 owns workspaces. New users never implicitly own legacy data. src/platform/schema.ts adds versioned 001-workspaces migration. domain.ts validates money/documents/permissions. auth.ts resolves sessions and scoped credentials. payments.ts handles provider results, allocations, journal/outbox. routes.ts exposes validated workflows. Production Express serves website/dist; Vite proxies /api during development.

Every protected query derives membership or credential scope server-side and includes organization/environment predicates. API keys cannot request admin scope. Financial writes lock organization/request/document, deduplicate events, validate open balances and commit records/journal/outbox atomically.

New operations use typed validated JSON records to extend existing infrastructure without destructive changes. Financial events/allocations/journal are normalized. Legacy and new amounts are not silently converted or merged. Workspace journal is observational, not custody.

Tradeoffs: default single API instance. Durable webhook retries survive restart, but process exclusion does not coordinate multiple instances. Add distributed leases/shared rate limits before scaling. Existing Orbit/Redis remains available for extension. Live provider, reversal/refund settlement and AI integrations remain gated.
