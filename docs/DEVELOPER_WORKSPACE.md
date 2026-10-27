# Developer workspace

/app/developer needs no company or merchant registration. Setup collects a display/workspace name, country/timezone/currency and optional use case/language. It creates a developer-owned resource container with an explicit owner membership.

The console includes Overview, My Applications, API Keys, API Explorer, Sandbox, Webhooks, Request Logs, Usage & Limits, API Documentation, SDKs & Examples, Verification APIs, Settings and Support. Applications and credentials reuse existing backend services. Raw API keys are shown once; only hashes are stored. Create a replacement and revoke the prior key to rotate. The API explorer sends an entered key only to a fixed read-only route in the same developer scope; it never accepts arbitrary URLs.

Sandbox creates synthetic clients without copying business customer data. The existing API contract supports synthetic invoice/payment/reconciliation workflows. Webhooks enforce destination validation, signed delivery, persisted attempts and retry controls. Endpoint secrets are shown only on creation/rotation. A reachable approved test receiver is needed to demonstrate actual outbound delivery; local/private destinations remain blocked.

Logs show at most 100 recent audit metadata entries, excluding request bodies and raw credentials. Usage counts are explicitly bounded observations, not billing totals or promised quotas. Public verification tools preserve technical-validity versus issuer-authority distinctions. Production access is denied for Developer containers until a separate reviewed capability exists.

Request Logs now includes persisted scoped API status metadata (successful and denied requests) plus the existing audit history. Both are bounded to the latest 100 entries and never expose raw keys, request bodies or query strings. Post-response log writes are best effort; a database outage can leave gaps, so usage observations are not billing totals.
