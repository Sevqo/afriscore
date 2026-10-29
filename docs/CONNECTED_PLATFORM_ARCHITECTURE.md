# Connected intelligence and trust architecture

Milestone 3 extends release f0dccb2. The owner approved starting this milestone and reusing the existing OpenAI key. The complete request is retained in MILESTONE_3_PLAN.md; CONNECTED_PLATFORM_AUDIT.md records the pre-change matrix. Milestone 4 and Capital remain deferred.

## Canonical domain boundaries

The Express/TypeScript application, Neon/PostgreSQL adapter, existing durable operations worker, service catalog and Cloudflare gateway remain the architecture. Financial calculations use the Milestone 2 services and integer currency units. No competing payment engine, general ledger, identity provider, workflow engine or production blockchain was introduced.

Authorized sources enter the existing canonical records through validation and normalization. ac_data_lineage maps scoped source identities to those records; it is provenance, not a second financial ledger. Intelligence consumes canonical records. The assistant receives minimized results of fixed deterministic tools, never database credentials or arbitrary SQL. Automations consume trusted domain events or configured schedules. Private Passport/credential evidence remains a separate disclosure boundary; trust assessments never expose underlying financial documents.

## Additive migration 009

The migration adds actor-private encrypted conversations/messages, immutable workflow configurations and queued-run version bindings, source lineage, configurable intelligence policies and evidence-backed alerts. It adds indexes for scoped conversation retrieval, expiry cleanup, due runs and notification caps. PostgreSQL enables default-deny RLS and revokes PUBLIC. Existing trusted backend-owner authorization remains mandatory.

It registers optional AfriCore Data with a free evaluation price and updates the Assistant definition to support all workspace kinds and computed evidence without an external provider. It does not activate either product in existing workspaces, change historical prices, merge identities, rewrite receipts/allocations or change encryption keys. Existing requires-setup selections can be explicitly reactivated by their owner. Hosted startup continues to verify an already migrated schema.

## Intelligence and forecasting

The shared snapshot now includes metric period/currency/source/calculation/completeness/refresh metadata, expense category totals and separately labeled merchant-imported inflows. Imported credits do not become verified collections or revenue. Receivables retain Milestone 2 credits/returns. Forecast baselines use exact integer ratio rounding and exclude linked returned collections. Data sufficiency labels replace an unvalidated confidence label; statistical intervals remain null.

Forecast generation saves a prospective snapshot. Evaluation waits until that snapshot's horizon ends, compares it with covered actual records and reports absolute error. It does not fabricate historical forecasts or claim a statistically validated model. Later source corrections may change observed actuals. Empty or immature observation windows explicitly report that accuracy is unavailable.

Intelligence alerts have configurable amount, due-window and concentration thresholds, optional in-app notifications, evidence, severity and acknowledge/dismiss states. Concentration requires at least three observed customers and is labeled invoice-face-value concentration. Missing data produces no adverse inference. The existing worker evaluates configured policies at most once per hour using a durable deduplication event, and honors service/workspace status. Explicit evaluation is also available. Notifications honor member preferences and caps. This is not fraud detection or a lending/procurement decision.

## Assistant tools, privacy and costs

The existing OpenAI Responses provider and fixed tool boundary are preserved. Server-side intent matching selects only financial summary, receivables, recorded expenses, obligations, forecast, reconciliation or curated API documentation. Personal summaries include their own manually recorded income. Developer documentation answers do not retrieve another business's data. No model-selected tenant, SQL, filesystem, browsing, arbitrary integration, message sending or financial write tool exists.

Questions that resemble API credentials, private keys or database URLs are rejected before message persistence/provider use. Imported identifiers, document text, customer names/contacts and freeform evidence do not enter model evidence. The question itself remains untrusted input. Model text renders as plain React text, with no executable commands, HTML, fetched images or trusted model-authored links. Internal citations are constructed from authorized service results. Generated prose remains an explanation to verify, not an authoritative financial calculation.

Conversations are encrypted with context binding to actor, workspace, environment and message ID. Another member, including an owner, cannot read a member's private conversation through these routes. Messages use durable idempotency and conflict checks. In-flight or ambiguous requests are not automatically charged again. History is bounded to 100 conversations per identity and 100 messages per conversation, becomes inaccessible on archive/expiry, and is purged by the worker after 30 days. Offline/sleeping workers defer physical cleanup; backups have separate retention. Prior messages are not automatically transmitted to the model. Feedback stores only a bounded rating. Stop waiting stops the UI wait, not a guaranteed provider cancellation; the interface explains that a request may still complete/use its reservation.

Existing global PostgreSQL advisory-lock reservations remain authoritative: per-identity/day, workspace/day, global day/month and concurrency controls, plus new per-model daily and identity/workspace monthly caps. Attempts retain a conservative USD 1 budget reservation after failure/timeout. This is a ceiling reservation, not a customer charge or measured provider cost. Token/model/status/duration metadata is recorded without plaintext prompts/replies in usage tables. Only a successful explanation consumes the assistant service unit. Collection remains disabled.

The reused key was loaded only into memory for one synthetic provider probe. It returned provider_credit_exhausted; no real model answer or adversarial model resistance is claimed. No new key, persistent key copy, hosted secret upload, billing upgrade or automatic external-provider activation was performed. Provider explanation deployment requires available credits and approved server configuration; computed evidence/history work independently.

## Workflows and approvals

The existing durable engine now records immutable configurations, timezone/delay settings and exact configuration versions on queued runs. Edits use optimistic version checks; changed configurations, revoked creators, paused workflows and settled/credited invoice sources cancel stale work. Old configuration history before this release is not reconstructed. Event scanning excludes already-consumed keys with tenant predicates, so the first 100 events cannot starve later work.

Thirteen supported templates use typed triggers, currency/amount/due-date conditions and a single supported action: in-app notification to the workflow owner. No arbitrary code or expression evaluator is exposed. The sequential trigger → condition → delay → action UI remains usable on mobile. Execution history includes bounded retry/dead-letter/cancel controls and a required reason. Manual retry retains the prior attempt count in an audit event and refuses a changed configuration. Suppressed notifications do not consume workflow usage.

Existing approvals remain exact-resource/action/parameter bound, assigned to a different current owner/admin, expiring and single-use. This release adds requester/current-admin cancellation. Approval decisions do not execute actions. Existing commerce operations consume applicable approvals; unsupported financial/integration/AI write actions have not been added or falsely advertised as universally approval-gated.

Durability is PostgreSQL-backed and independent of an open browser. Render Free sleep still pauses workers; it is not an always-on scheduling SLA. The deployment remains single-instance. Distributed leases, multi-instance fault qualification and external email/SMS/WhatsApp adapters remain launch gates.

## Connect, Data and canonical ingestion

Connect retains its typed sandbox accounting/store/courier adapters, durable retries, explicit import and disconnect/revocation checks. The registry points to the existing Daraja sandbox boundary rather than duplicating its adapter. Live banking, accounting OAuth, government and tax integrations are unavailable without their actual provider programs/approval. No unsupported provider login is collected.

The genuine file workflow reviews an authorized CSV, processing purpose, stable source name and positive exact currency amounts with timezone-qualified dates. It requires a current human finance member. At most 1,000 rows are accepted; source IDs are unique within the batch. Set lookups and portable bounded multi-row statements avoid a network query per row. The canonical transaction and lineage commit together with the import event, audit and usage. Identical source retries skip; changed content for an existing source identity returns a conflict instead of replacing history. Timestamps normalize to UTC before fingerprinting. Successful new normalized records meter Data; when only Connect is active the completed import meters one sync unit. Duplicates, conflicts and internal retries do not charge another unit.

Data quality exposes source freshness, record counts, transformation version and paginated lineage under current membership/scoped-key/service authorization. Imported provenance is always merchant_imported/provider_verified:false. It never establishes revenue, bank verification or payment confirmation. Deactivation retains authorized read/export history and blocks new writes. Financial retention/deletion and cross-source corrections need documented operational/legal policy; source conflicts are explicit, not automatically merged.

## Identity, credentials, trust and proofs

Existing private verification submission, encrypted bounded document custody, separate operator review, renewal/corrections and source invalidation remain. File validation checks type signatures/size; malware scanning is unconfigured and now explicitly disclosed. No government registry verification is asserted. Uploads alone do not produce verified claims.

The Passport UI adds independent private dimensions for identity review, credential lifecycle evidence, bilateral relationships, evidence availability and correction requests. It has no composite trustworthiness or eligibility score and discloses no underlying financial records. Missing evidence is not an adverse finding. Existing relationship requests/acceptance/revocation, disputes, correction history and controlled sharing are retained.

VC2 JOSE ES256 issuance, authorized sandbox issuers, holder grants, source hashes, fresh signed Bitstring Status Lists, key rotation/compromise and recipient/audience/nonce/expiry/one-time presentation checks remain authoritative. A valid signature is separate from issuer recognition and claim truth. The managed presentation profile is not certified OpenID4VCI/VP interoperability. Production issuance, institutional issuer authority, KMS/HSM/dual control and independent security/privacy review remain gated.

Existing randomized commitments, OpenZeppelin Merkle batches, root-only no-funds contract and independent verifier are preserved. Exact signed credential bytes remain the commitment input; salts/private evidence stay off-chain. Local-chain tests verify actual transactions, inclusion, tampering and permission controls. No new contract deployment, public testnet/mainnet spend, token, custody or production RPC activation is included.

## API, release and rollback

Connected routes have exact workspace-kind/service policies. New financial/data/workflow commands use shared Zod contracts and explicit idempotency where appropriate; conversation mutations require human sessions. Generated OpenAPI documents these routes. Developer API scope, current membership and tenant/environment checks remain separate from product entitlements. Foundation reports/security and independent Invoicing/Expenses remain intact.

Validate SQLite, fresh disposable local PostgreSQL, frontend/content, type/lint, both API inventories, gateway/startup and isolated chain checks. Never test against Neon. Use the guarded existing maintenance helper with --connected to create a consistent encrypted backup, verify readback, execute canonical migration 009 atomically, and verify its version on the approved development branch only. No auth schema/production branch is authorized. Deploy backend before frontend, verify managed identity/workspaces, then compare published assets and record actual outcomes. Preserve additive tables on rollback. Pause new workflow writes/runs before reverting to older code that ignores version bindings; prefer a forward fix.

## Primary references reviewed

[OpenAI text generation](https://developers.openai.com/api/docs/guides/text), [OWASP prompt injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/), [W3C VC2](https://www.w3.org/TR/vc-data-model-2.0/), [Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/), [OpenID4VCI final](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-final.html), [OpenID4VP final](https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html). These references guide implementation boundaries; they do not certify this product.
