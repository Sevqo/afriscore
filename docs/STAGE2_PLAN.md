# Stage 2 execution plan
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Audit baseline: main 7786e7c includes Stage 1 plus newer concurrent-development/phone-testing setup. Existing 156 tests pass. Express/TypeScript, SQLite/PostgreSQL, React/Vite, existing tenant authorization and signed webhook outbox remain in place. No destructive migrations or legacy business ownership changes.

1. Add migration 002-stage2: provenance events, typed domain objects, evidence, automation runs, notifications, approvals and AI usage. Keep existing financial records authoritative.
2. Deterministic intelligence: currency/date/provenance-aware aggregates; customer delays; data quality; 7/30/60/90-day scenario forecasts; expenses and recurring obligations. No manufactured bank balance/profit or LLM arithmetic.
3. Controlled assistant tools plus provider abstraction, minimized numeric evidence, explicit model configuration, usage bounds and read-only permissions. OpenAI key setup approved separately; credentials stay ignored/server-side.
4. Durable automation templates, conditions/scheduling, dedupe, limits/retries, notifications/preferences and assigned non-self approval decisions. No automation performs fund movements or external messages without a configured authorized transport.
5. Item fulfillment, shipments and evidence with assurance labels; protected-sale buyer links, explicit partner sandbox state machine, disputes, two-person resolution and idempotent partner settlement.
6. Sandbox connector registry/sync retries and explainable risk review; extend versioned APIs, existing signed webhooks and private internal documentation/operations views.
7. Original editable SVG editorial library (10 scenes), existing media composition, selective educational motion and public product additions without replacing the premium hero/layout.
8. Unit/integration/journey tests, tenant/role/environment controls, UI desktop/mobile QA, docs/runbooks and truthful compliance/activation gates. Preserve Blockchain and Capital exclusions.

Deliver in coherent checkpoints. Production custody/settlement remains disabled: no authorized financial partner has been configured. No blockchain, lending, financing approvals or token systems are implemented. Initial single-instance constraints remain explicit unless worker claims are verified.
