# Business automations and approvals
Implementation: src/operations/automation.ts, worker.ts. Ten structured templates cover invoice/receivable reminders, payment and reconciliation review, summaries, delivery/protected-payment review and integration failures. The API exposes the authoritative template catalogue. Conditions include currency and minimum amount; schedules are daily/weekly with an hour. Arbitrary code, SQL and model-generated actions are not accepted.

The API process polls every 15 seconds. Runs persist with workflow+trigger deduplication, up to 50 candidates/executions per tick, three attempts and exponential backoff followed by dead letter. Pausing prevents future execution. Membership finance authority is rechecked; a revoked creator disables the workflow. Notification creation is transactional with run state. Review runs in the Automations workspace and repair the workflow before resuming; no blind financial retry is provided.

All delivered actions are in-app notifications. No email, SMS, WhatsApp, customer payment demand or fund movement is sent. Daily/weekly summaries use deterministic reporting data and include coverage limits. Preferences support pause/muted categories and read state, scoped to user+organization+environment. Deduplication and a 100/day recipient cap bound noise. External channels need delivery consent, provider credentials, opt-out semantics and transport tests before activation.

Approvals require a human requester, a different assigned owner/admin, a reason, matching organization/environment/resource/action and 24-hour expiry. Decisions do not execute actions. Protected release and dispute resolution revalidate approver membership when consumed. Expired/rejected/revoked approval cannot authorize execution. Other approval categories are recorded review workflows; existing invoice/reconciliation/connector operations are not all wired to mandatory approval consumption. Do not claim universal two-person controls.

Single API instance remains the deployment boundary. Database locking/dedupe reduces duplicates, but distributed worker leases and shared rate limiting must be verified before horizontal scaling. Notification retention/purge and external alerting remain operator work.


## Connected platform continuation
See [CONNECTED_PLATFORM_ARCHITECTURE.md](CONNECTED_PLATFORM_ARCHITECTURE.md) and [CONNECTED_PLATFORM_REPORT.md](CONNECTED_PLATFORM_REPORT.md) for the owner-approved Milestone 3 extensions and current verification/operational boundaries. Historical readiness statements above describe their original release; retain the documented financial, consent, issuer and privacy invariants.
