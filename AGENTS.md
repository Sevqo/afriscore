# AfriCore agent guide
Read README.md and docs/IMPLEMENTATION_STATUS.md first, then ARCHITECTURE.md, DATABASE.md, SECURITY.md and the relevant domain document before architecture changes.

Preserve legacy /v1 consent APIs, migrations and data. New workspace APIs use /api/v1 and /api/auth. Do not auto-assign legacy businesses to new users. Financial amounts use integer minor units and explicit currencies. Never trust frontend success assertions or merchant imports as provider proof. Keep events/journal append-only through services and environments isolated.

Run npm test, npm run typecheck, npm run validate:openapi, npm run validate:platform and the website build. TEST_DATABASE_URL must never point at production. Record unexecuted checks honestly. Preserve typed media configuration and Stage 2 boundaries.

No live M-Pesa, financing, protected payments, eTIMS or regulatory approvals may be represented as operational. Production signup/recovery is gated pending email delivery. Initial deployment is single-instance; distributed rate limits and worker leases are required before scaling. Update implementation status and runbooks as limitations change.

## Stage 2 continuation
Read docs/STAGE2_PLAN.md and the relevant intelligence/forecast/automation/commerce runbook. Migration 002-stage2 is additive. Keep raw evidence and financial provenance immutable through services; merchant statements never become partner proof. Preserve explicit sandbox states and buyer capability redaction. Assistant is fixed-tool/read-only with per-request external-provider consent. No credentials, private setup state or synthetic preview databases belong in commits. Run the full quality gates after backend/frontend changes. Do not interpret completed local checks as production partner authorization.
