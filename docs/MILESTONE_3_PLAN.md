# AFRICORE — MILESTONE 3
# INTELLIGENCE, AI ASSISTANT, AUTOMATIONS, AFRICORE CONNECT, BUSINESS PASSPORT, TRUST NETWORK & BLOCKCHAIN INFRASTRUCTURE

## COMPLETE MASTER IMPLEMENTATION PROMPT FOR CODEX

### PROJECT STATUS

Milestone 1: Application Quality and Account Security — completed.

Milestone 2: Payments and Financial Infrastructure — preceding implementation milestone.

We are now beginning **Milestone 3: Intelligence, Automation, Connected Data, Business Identity and Trust Infrastructure**.

Continue development within the existing AfriCore repository.

This is not a new application.

AfriCore already has:

- A public marketing website.
- Personal, Business and Developer workspaces.
- Neon PostgreSQL.
- Existing authentication.
- Cloudflare deployment and backend infrastructure.
- A modular Service Catalog.
- My Services.
- Service entitlements.
- Usage tracking and billing foundations.
- Financial products.
- Existing AI, automation, verification and blockchain components at various levels of maturity.

Inspect what actually exists before implementing changes.

Preserve the improvements delivered in earlier milestones.

### YOUR ROLE

Act as the principal AI systems architect, senior full-stack engineer, workflow orchestration engineer, integration-platform architect, data engineer, identity infrastructure specialist, cryptography engineer, blockchain engineer, security specialist, product designer and QA lead.

### OBJECTIVE

Transform AfriCore's intelligence, automation, integrations, identity, trust and verification capabilities into reliable, interconnected, production-quality software.

The milestone covers:

1. Financial Intelligence.
2. AI Business Assistant.
3. Business Automations.
4. AfriCore Connect.
5. AfriCore Data.
6. Business Verification.
7. Business Passport.
8. Verifiable Credentials.
9. Trust Network.
10. Business Trust Assessments.
11. Blockchain Verification.
12. Developer APIs for supported capabilities.
13. Service Marketplace integration.
14. Complete user-facing functionality and tests.

**Important: Do not repeat Milestone 2's payment-engine implementation or begin AfriCore Capital. Preserve them and integrate through existing well-defined interfaces.**

---

# PART I — DISCOVERY AND ARCHITECTURE

## 1. COMPLETE REPOSITORY AUDIT

Inspect:

- Repository structure.
- `AGENTS.md`.
- Architecture documentation.
- Existing AI Assistant.
- Existing financial intelligence.
- Workflow Studio.
- Automations engine.
- Integration service.
- Provider adapters.
- Data ingestion.
- Business Metrics.
- Business Passport.
- Credential issuance.
- Credential verification.
- Trust Network.
- Blockchain implementation.
- Smart contracts.
- Existing APIs.
- Database migrations.
- Background processing.
- Security controls.
- Service entitlements.
- Usage metering.
- Billing.
- Cloudflare deployment.
- Backend runtime.
- Existing tests.

Determine which components are functional, incomplete, simulated, misconfigured or dependent on external services.

Do not assume every existing service requires rewriting.

### Required audit deliverable

Produce a product capability matrix:

- Product.
- Current implementation.
- Backend functionality.
- Database integration.
- Frontend functionality.
- Security model.
- Existing dependencies.
- Actual readiness.
- Missing functionality.
- Tests.
- Planned changes.

Continue implementation after the audit.

Do not stop at a report.

---

## 2. ESTABLISH THE CONNECTED PLATFORM ARCHITECTURE

AfriCore should support the following logical flow:

**Authorized Sources → Connectors → Ingestion → Validation → Normalization → Canonical Business Data → Intelligence / Automations / Trust / APIs**

Business identity and verifiable credentials should integrate with this foundation without exposing unrelated private financial records.

### Architectural principles

- One canonical source of truth per domain.
- Workspace isolation.
- Clear service boundaries.
- Permission-aware data access.
- Explicit consent and applicable lawful processing basis.
- Reliable asynchronous processing.
- Accurate evidence provenance.
- Auditability.
- Explainable results.
- Reusable APIs.
- Independent service activation.
- No unnecessary microservices.
- No new programming language without an actual technical requirement.

Use the existing Neon database and backend architecture.

Where appropriate, use Cloudflare Workers, Workflows, Queues or compatible existing background infrastructure.

Do not duplicate a working job engine merely to introduce a newer technology.

---

# PART II — FINANCIAL INTELLIGENCE

## 3. COMPLETE THE FINANCIAL INTELLIGENCE PRODUCT

### Product purpose

Turn authorized business financial records into understandable, actionable insights.

A business owner should be able to answer:

- How is the business performing?
- Which customers owe money?
- Are payments arriving on time?
- Are expenses increasing?
- Which bills are due soon?
- What could cash flow look like next month?
- Where are the biggest financial risks?
- Which information is missing?

### Main workspace

Implement or refine:

- Intelligence Overview.
- Financial Trends.
- Receivables Insights.
- Cash Flow Forecast.
- Expense Analysis.
- Customer Analysis.
- Alerts and Opportunities.
- Scenarios.
- Data Quality.
- Reports.

Preserve the compact application design system.

---

## 4. BUILD RELIABLE INTELLIGENCE DATA SOURCES

Use financial domain services created or improved during Milestone 2.

Possible sources:

- Confirmed payment events.
- Invoices.
- Receivables.
- Expenses.
- Recurring obligations.
- Customers.
- Orders.
- Authorized imports.
- Approved integrations.

Maintain provenance.

Distinguish:

- Externally confirmed records.
- Imported records.
- Manually entered records.
- Inferred classifications.
- Forecast values.

Do not treat all imported bank credits as revenue.

Do not confuse payment collection with profitability.

Do not claim a complete financial picture when only partial source coverage exists.

---

## 5. FINANCIAL METRICS

Support defensible metrics where underlying data is adequate.

Examples:

- Recorded inflows.
- Recorded outflows.
- Net recorded movement.
- Outstanding receivables.
- Overdue receivables.
- Average payment delay.
- Customer concentration.
- Expense category distribution.
- Recurring obligations.
- Receivables aging.
- Revenue trends where properly classified.
- Data completeness.

Each metric should provide:

- Definition.
- Date range.
- Currency.
- Source.
- Calculation method.
- Data completeness.
- Refresh timestamp.
- Relevant limitations.

Do not display meaningless precision.

Use deterministic code for financial arithmetic, not an LLM.

---

## 6. CASH FLOW FORECASTING

Build an explainable forecasting framework.

### Inputs

Where authorized and available:

- Historical payment behavior.
- Invoice due dates.
- Expected receivables.
- Recurring bills.
- Recorded expenses.
- Payment patterns.
- Seasonal patterns where supported by sufficient history.

### Outputs

- Forecast period.
- Expected inflows.
- Expected outflows.
- Net projected movement.
- Scenario assumptions.
- Confidence or uncertainty range when statistically justified.

### Scenarios

Support:

- Base case.
- Faster customer payments.
- Delayed customer payments.
- Increased expenses.
- Reduced sales where actual sales data supports the assumption.
- Custom assumptions.

### Important

Distinguish forecasts from actual balances.

Do not automatically provide a mathematically meaningless confidence score.

When insufficient records exist, explain why the forecast cannot be reliable.

Avoid generating imaginary transaction history.

### Testing

Use deterministic sample datasets to verify forecast arithmetic and scenario behavior.

Compare forecasts with historical held-out data where adequate history exists.

Document model limitations.

---

## 7. FINANCIAL ALERTS

Implement useful, configurable alerts.

Examples:

- Invoice overdue.
- Unexpected increase in recorded expenses.
- Upcoming large obligation.
- Concentration of receivables among a few customers.
- Missing payment confirmation.
- Reconciliation exceptions.
- Data connection failure.
- Significant reduction in observed collections.

### Requirements

- Configurable thresholds.
- Clear evidence.
- Severity.
- Notification preferences.
- Acknowledge or dismiss.
- Avoid duplicate alerts.
- Avoid excessive notifications.
- Provide a direct route to the relevant record.

Do not generate alarming claims without sufficient evidence.

---

# PART III — AI BUSINESS ASSISTANT

## 8. AI ASSISTANT PRODUCT VISION

The AI Business Assistant should help users understand and operate AfriCore.

It must be:

- Helpful.
- Context-aware.
- Permission-aware.
- Data-grounded.
- Cost-controlled.
- Explainable.
- Safe.
- Responsive.

The assistant should work differently depending on the user's account and activated services.

### Personal

Help explain income, expenses, invoices and relevant records.

### Business

Help analyze the user's authorized business data and explain operating workflows.

### Developer

Help understand API documentation, integration errors, webhooks and developer products.

Do not allow a Developer user to access another business's confidential information.

---

## 9. AI ARCHITECTURE

Use a provider abstraction.

Inspect the existing implementation before choosing models or adding libraries.

Support appropriate model configuration, such as:

- Provider.
- Model.
- Token limits.
- Timeout.
- Retry policy.
- Budget.
- Allowed capabilities.
- Data-sharing controls.

Avoid unnecessary model lock-in.

### Core architecture

User Request → Authentication → Workspace Authorization → Intent Classification → Approved Data Tools → Deterministic Business Services → LLM Explanation → Verified Response.

Do not let an LLM invent invoices, payment confirmations or financial totals.

Use deterministic application services for authoritative data.

### Context

Retrieve only the relevant authorized information.

Avoid passing the entire business database into every AI request.

Use structured summaries where possible.

---

## 10. SOURCE-BACKED ANSWERS

The AI should explain where answers come from.

Example:

User asks:

"Why has my cash flow decreased?"

The assistant should inspect authorized data and explain actual observed changes, referencing relevant reporting periods or transaction groups.

Where feasible, link to:

- Invoice.
- Payment.
- Expense.
- Report.
- Financial metric.
- Source record.

### Required behavior

- Distinguish fact from inference.
- Indicate incomplete information.
- Avoid inventing nonexistent records.
- Avoid claiming integrations exist when they are disabled.
- Provide correct currency and dates.
- Handle empty datasets.
- Link to relevant user-accessible information.

Do not leak hidden sources in citations.

---

## 11. AI TOOL PERMISSIONS

Implement explicit tool authorization.

Possible read-only tools:

- Get Financial Summary.
- List Outstanding Invoices.
- Get Expense Trends.
- Get Cash Flow Forecast.
- Explain Reconciliation Exception.
- Retrieve Product Documentation.

Higher-risk tools may include:

- Create Invoice.
- Modify Customer.
- Schedule Reminder.
- Create Automation.
- Send Message.

### Rule

Do not allow the model to perform write actions merely by generating text that looks like a command.

Implement a server-side action policy.

Require:

- User permission.
- Service entitlement.
- Validated parameters.
- Explicit confirmation where necessary.
- Audit records.
- Idempotency.
- Rate limiting.

For financial or irreversible actions, require appropriately strong human approval.

Never let the assistant initiate a live payment or transfer funds without a separately authorized operation.

---

## 12. AI SECURITY

Review the current OWASP GenAI security guidance.

Protect against:

- Prompt injection.
- Tool misuse.
- Cross-tenant data disclosure.
- Sensitive information leakage.
- Malicious imported documents.
- Untrusted external content.
- Exfiltration.
- Unbounded tool execution.
- Cost abuse.
- Retrieval poisoning.
- Incorrect financial advice.
- False confidence.

Treat imported documents, web content and tool results as untrusted data.

Do not allow untrusted text to override security policies.

### Testing

Include malicious-document tests attempting to make the assistant reveal secrets, access another organization or execute unauthorized actions.

Verify the assistant refuses or safely handles these instructions.

---

## 13. AI COST AND USAGE MANAGEMENT

Reuse the Service Marketplace and usage-metering system.

Support:

- Per-user limits.
- Per-workspace limits.
- Model-specific budgets.
- Daily usage caps.
- Monthly usage caps.
- Request concurrency limits.
- Token accounting.
- Provider cost estimates.
- Global spending limits.
- Abuse detection.

Avoid the previously identified vulnerability where creating many workspaces permits effectively unbounded AI spending.

Meter authoritative server-side usage.

Do not let frontend controls determine billable consumption.

---

## 14. AI USER EXPERIENCE

Build a professional chat interface.

Include:

- Conversation history.
- Clear message bubbles.
- Suggested questions.
- Relevant source references.
- Loading/progress feedback.
- Retry.
- Stop generation where supported.
- Copy.
- Useful error messages.
- Privacy information.
- Feedback on responses.

On mobile, use an actual messaging-style layout rather than a long form.

Do not display raw JSON by default.

### Suggested prompts

- "Which customers have overdue invoices?"
- "What were my recorded expenses this month?"
- "Explain my cash flow."
- "What bills are coming up?"
- "Why did reconciliation fail for this payment?"

All responses must respect the user's permissions.

---

# PART IV — BUSINESS AUTOMATIONS

## 15. AUTOMATION PRODUCT VISION

AfriCore Automations should help businesses eliminate repetitive manual work.

A user should be able to create reliable workflows without programming.

### Basic model

Trigger → Conditions → Actions.

### Example

When an invoice becomes overdue:

1. Detect overdue status.
2. Check whether the invoice remains unpaid.
3. Confirm reminder policy.
4. Send an authorized reminder.
5. Record the result.

Another example:

When a payment is confirmed:

1. Receive a trusted event.
2. Reconcile the payment.
3. Update the invoice.
4. Notify the merchant.

Do not duplicate Milestone 2's existing event processing unnecessarily.

---

## 16. WORKFLOW BUILDER

Build or improve the existing Workflow Studio.

### Requirements

- Workflow list.
- Create workflow.
- Edit workflow.
- Trigger selection.
- Conditions.
- Actions.
- Delays.
- Scheduling.
- Review.
- Activate.
- Pause.
- Version history.
- Execution history.
- Error handling.

### UI

Use a visual flow representation.

Preserve usability on mobile.

For narrow screens, use a sequential configuration layout rather than forcing a giant desktop canvas.

### Workflow templates

Provide tested templates for:

- Overdue Invoice Reminder.
- Payment Confirmation Notification.
- Upcoming Expense Reminder.
- Reconciliation Exception Alert.
- Customer Follow-up.
- Business Credential Expiry Reminder.
- Failed Integration Notification.

Do not list a template as ready if its required action adapter is unavailable.

---

## 17. AUTOMATION TRIGGER SYSTEM

Create typed triggers.

Examples:

- Invoice Issued.
- Invoice Overdue.
- Payment Confirmed.
- Expense Recorded.
- Obligation Due.
- Reconciliation Exception.
- Credential Expiring.
- Data Sync Completed.
- Integration Failed.
- Scheduled Time.

Each trigger needs:

- Stable type identifier.
- Schema.
- Source event.
- Workspace scope.
- Permission requirements.
- Payload version.
- Idempotency identity.

Do not allow client-generated fake payment confirmation events to trigger real financial operations.

---

## 18. CONDITION ENGINE

Implement explicit, validated conditions.

Examples:

- Invoice amount exceeds a threshold.
- Invoice is still unpaid.
- Payment provider is verified.
- Business verification is expiring.
- Customer category matches.
- Date is within a specified window.

Do not evaluate arbitrary user-provided JavaScript or untrusted code.

Use typed operators and validated values.

Avoid SQL injection, code execution and unrestricted expression evaluation.

---

## 19. ACTION ENGINE

Create a registry of authorized actions.

Examples:

- Create notification.
- Send configured email.
- Create task.
- Update supported record.
- Request approval.
- Invoke approved integration.
- Create follow-up.
- Generate report.

### Safety

Check permissions at execution time, not only when the workflow is created.

Support revocation of previously granted access.

Prevent workflows from using an inactive service.

Do not silently perform irreversible actions.

---

## 20. DURABLE EXECUTION

Automations must continue running when the user closes their browser.

Evaluate existing infrastructure.

Where appropriate, use:

- Cloudflare Workflows.
- Cloudflare Queues.
- Existing Render background workers.
- Existing Orbit infrastructure.

Choose based on actual project compatibility.

### Requirements

- Durable state.
- Retries.
- Exponential backoff.
- Execution timeouts.
- Scheduled execution.
- Idempotency.
- Dead-letter handling.
- Cancellation.
- Execution history.
- Failure recovery.
- Observability.

Do not assume a queue provides exactly-once processing.

Implement idempotent consumers.

Avoid workflows that retry indefinitely.

---

## 21. HUMAN APPROVALS

Implement a reusable approval mechanism for sensitive workflow actions.

Support:

- Approval request.
- Approver identity.
- Authorization.
- Exact action details.
- Expiration.
- Approve.
- Reject.
- Cancellation.
- Audit event.

Approvals must be bound to the exact action and parameters being authorized.

Changing the amount, recipient, target record or other critical details must invalidate the original approval.

Do not permit approval replay.

---

## 22. AUTOMATION OPERATIONS DASHBOARD

Create:

- Active Workflows.
- Recent Runs.
- Successful Runs.
- Failed Runs.
- Retry Queue.
- Pending Approvals.
- Execution Details.
- Error Diagnostics.
- Usage.

Use appropriate service entitlement and metering.

Only show runs belonging to the current authorized workspace.

---

# PART V — AFRICORE CONNECT

## 23. CONNECT PRODUCT PURPOSE

AfriCore Connect should provide a secure way to connect external systems to AfriCore.

Examples include:

- Approved payment providers.
- Accounting software.
- E-commerce platforms.
- Business management tools.
- Authorized document sources.
- Communication services.

### Core workflow

Discover Integration → Connect → Authorize → Configure → Sync → Monitor → Disconnect.

Do not show unsupported integrations as live.

---

## 24. CONNECTOR REGISTRY

Build a typed connector system.

Each connector should define:

- Stable connector ID.
- Display name.
- Supported capabilities.
- Authentication type.
- Required credentials.
- Scope requirements.
- Supported objects.
- Data direction.
- Sync strategy.
- Rate limits.
- Webhook support.
- Error handling.
- Availability.
- Documentation.

Use reusable adapters.

Avoid implementing a separate incompatible integration framework for every provider.

---

## 25. AUTHENTICATION AND CONSENT

Support appropriate integration authentication mechanisms.

Examples:

- OAuth.
- API keys.
- Provider-specific signed tokens.
- Other documented supported methods.

Use least-privilege scopes.

Store secrets securely.

Implement:

- Connection approval.
- Consent records where applicable.
- Token refresh.
- Token rotation.
- Revocation.
- Disconnect.
- Access logs.

Do not scrape private accounts or request credentials for unsupported integrations.

Do not claim a provider grants API access without confirming its actual program requirements.

---

## 26. DATA SYNCHRONIZATION

Implement:

- Initial import.
- Incremental sync where supported.
- Webhook-triggered sync.
- Scheduled sync.
- Deduplication.
- Checkpointing.
- Schema validation.
- Conflict handling.
- Retry.
- Error history.
- Source provenance.
- Controlled resync.

Do not import the same transaction twice after retries.

Provide clear reconciliation of imported data where appropriate.

---

## 27. CONNECT DASHBOARD

Provide:

- Connected Services.
- Available Connectors.
- Connection Health.
- Last Successful Sync.
- Records Imported.
- Errors.
- Permissions.
- Reconnect.
- Disconnect.

Keep the interface compact and understandable.

Use human-readable errors.

Do not expose raw provider credentials.

---

# PART VI — AFRICORE DATA

## 28. DATA PLATFORM PURPOSE

AfriCore Data is the normalized and permission-controlled data foundation for eligible AfriCore services and developers.

It must not become an unrestricted database-sharing product.

### Architecture

Authorized Sources → Ingestion → Validation → Normalization → Canonical Business Model → Authorized Consumers.

### Consumers

- Financial Intelligence.
- AI Assistant.
- Cash Flow.
- Reconciliation.
- Automations.
- Business Passport, only where relevant.
- Developer APIs, with explicit authorization.

---

## 29. CANONICAL BUSINESS OBJECTS

Review and reuse existing domain models.

Possible objects:

- Business.
- Customer.
- Supplier.
- Financial Account.
- Transaction.
- Invoice.
- Payment.
- Expense.
- Revenue Classification.
- Obligation.
- Credential.
- Verification Evidence.
- Data Connection.
- Data Quality Record.

Avoid duplicating records from Milestone 2.

Use versioned schemas and source mappings.

---

## 30. DATA PROVENANCE AND QUALITY

Each imported or derived data record should retain appropriate metadata:

- Source system.
- Source record identifier.
- Workspace.
- Import timestamp.
- Transaction/event timestamp.
- Verification status.
- Data quality.
- Transformation version.
- Last synchronization.
- Conflict status.

Do not classify imported records as independently verified merely because they were successfully imported.

### Data quality checks

- Missing values.
- Invalid dates.
- Duplicates.
- Currency inconsistencies.
- Stale connections.
- Failed normalization.
- Conflicting records.

---

## 31. DATA ACCESS AND PRIVACY

Use server-side authorization.

Enforce:

- Workspace isolation.
- User permissions.
- Service entitlements.
- Data minimization.
- Permitted purpose.
- Retention policies.
- Consent where appropriate.
- Applicable data protection obligations.
- Export and deletion rights where applicable.

Do not make private business financial data available to other companies through the Trust Network by default.

Implement a documented access and disclosure model.

---

# PART VII — BUSINESS VERIFICATION

## 32. BUSINESS VERIFICATION PRODUCT PURPOSE

Enable businesses to submit claims and evidence for review.

Do not confuse:

- Self-reported business details.
- Submitted evidence.
- Reviewed evidence.
- Verified claim.
- Cryptographically signed credential.

These represent different levels of assurance.

---

## 33. VERIFICATION WORKFLOW

Implement:

1. Business profile completion.
2. Verification request.
3. Required evidence selection.
4. Secure document upload.
5. Submission.
6. Reviewer assignment.
7. Evidence review.
8. Approval, rejection or request for more information.
9. Result communication.
10. Audit history.
11. Renewal or re-verification.

### Security

- Private document storage.
- Malware/type checks.
- File size limits.
- Authorized access.
- Auditable retrieval.
- Appropriate retention.
- Secure encryption where needed.
- Protection from cross-tenant access.

Do not automatically approve uploaded certificates based only on their filename or appearance.

---

## 34. VERIFICATION LEVELS

Define meaningful, accurate verification levels.

Examples:

- Self-Reported.
- Evidence Submitted.
- Under Review.
- Verified by AfriCore against documented evidence.
- Verified by an external authorized issuer where a genuine integration exists.
- Expired.
- Revoked.

Use an explicit verification policy.

Do not use "Government Verified" unless a genuine government-authorized verification source supports that claim.

---

# PART VIII — BUSINESS PASSPORT

## 35. BUSINESS PASSPORT PRODUCT VISION

A Business Passport should be a reusable identity and trust profile for a business.

It helps a company prove selected attributes to customers, suppliers, financiers and partners.

### Example

A supplier applies to work with a larger company.

Instead of repeatedly uploading the same registration documents, the supplier shares selected verified credentials from its Business Passport.

The receiving company checks the issuer and validity of those credentials.

---

## 36. BUSINESS PASSPORT DASHBOARD

Include:

- Business Profile.
- Verified Attributes.
- Credentials.
- Issuers.
- Verification Status.
- Sharing Permissions.
- Share History.
- Expiring Credentials.
- Revoked Credentials.
- Verification Requests.
- Privacy Controls.

Allow organizations to manage which details are public and which require explicit sharing.

Do not assume all records are public.

---

## 37. CREDENTIAL SHARING

Implement controlled credential presentations.

Support:

- Select credential.
- Select eligible claims.
- Choose recipient.
- Describe purpose.
- Review disclosure.
- Approve sharing.
- Generate secure presentation or access capability.
- Verify recipient access.
- Record sharing event.
- Revoke future access where technically supported.

### Important limitation

Revoking access does not necessarily erase data that a recipient already received.

Explain this accurately in the interface.

---

# PART IX — VERIFIABLE CREDENTIALS

## 38. USE OPEN STANDARDS

Use appropriate current standards.

Primary references:

W3C Verifiable Credentials Data Model 2.0:

https://www.w3.org/TR/vc-data-model-2.0/

W3C Bitstring Status List v1.0:

https://www.w3.org/TR/vc-bitstring-status-list/

OpenID for Verifiable Credential Issuance 1.0:

https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-final.html

OpenID for Verifiable Presentations 1.0:

https://openid.net/specs/openid-4-verifiable-presentations-1_0-final.html

Inspect the existing implementation and determine the formats and interoperability requirements.

Do not claim compliance merely because JSON contains fields named `issuer` and `credentialSubject`.

Choose supported proof and signature formats based on actual interoperability requirements.

Use maintained, standards-conformant libraries.

---

## 39. ISSUER, HOLDER AND VERIFIER

Define distinct roles.

### Issuer

The authorized entity making a claim.

### Holder

The business controlling a credential.

### Verifier

The party validating a presented credential.

A verifier must independently decide whether the issuer is trusted for the specific claim.

An AfriCore signature must not automatically imply government or external institutional accreditation.

---

## 40. CREDENTIAL ISSUANCE

Implement:

- Credential type registry.
- Issuer registration.
- Issuer authorization.
- Credential schema.
- Claim validation.
- Evidence references.
- Expiration policy.
- Signing.
- Issuance audit.
- Holder delivery.
- Revocation/status handling.

### Important

Only authorized issuers can issue credentials.

Do not allow ordinary businesses to create a credential falsely claiming it was issued by a government agency, bank or unrelated third party.

Self-attestations must clearly identify their actual issuer.

---

## 41. CREDENTIAL VERIFICATION

Verification should inspect:

- Credential structure.
- Signature/proof validity.
- Issuer identity.
- Issuer authorization.
- Credential expiration.
- Status/revocation.
- Expected subject.
- Applicable schema.
- Presentation binding where applicable.
- Requested claims.
- Audience/nonce protections where applicable.

### Result

Return structured verification outcomes.

Examples:

- Cryptographically Valid.
- Invalid Signature.
- Expired.
- Revoked.
- Untrusted Issuer.
- Unsupported Format.
- Insufficient Evidence.
- Presentation Challenge Invalid.

Never summarize every valid signature as "Business Verified."

Signature validity and claim truth are separate.

---

## 42. CREDENTIAL STATUS AND REVOCATION

Implement a privacy-conscious credential status mechanism.

Where suitable, use W3C Bitstring Status List v1.0 or an appropriate standards-compatible existing approach.

Support:

- Active.
- Suspended.
- Revoked.
- Expired.

Avoid a publicly searchable record of which specific company checked another company's credentials.

Consider privacy implications of status checks.

---

## 43. CREDENTIAL KEY MANAGEMENT

Implement:

- Key generation using a secure mechanism.
- Private key protection.
- Key IDs.
- Key versions.
- Rotation.
- Revocation.
- Compromise response.
- Issuer authorization.
- Signature audit.
- Appropriate backup and recovery.

Do not store raw signing keys in browser localStorage.

Do not expose private keys through API responses.

Do not invent cryptographic algorithms.

---

# PART X — TRUST NETWORK

## 44. TRUST NETWORK PRODUCT VISION

AfriCore Trust Network should become a system for establishing and verifying selected business relationships.

It should make business-to-business interactions more transparent without treating every relationship as automatically trustworthy.

### Relationship examples

- Supplier ↔ Customer.
- Merchant ↔ Fulfillment Partner.
- Contractor ↔ Client.
- Business ↔ Credential Issuer.
- Business ↔ Authorized Verifier.

Relationships should be evidence-backed and permission-controlled.

---

## 45. TRUST NETWORK CAPABILITIES

Implement:

- Business discovery where permitted.
- Relationship requests.
- Acceptance/rejection.
- Verified relationship status.
- Evidence references.
- Credential sharing.
- Permission controls.
- Relationship history.
- Revocation.
- Disputes.
- Corrections.
- Verification API integration.

Do not automatically publish private customer or supplier relationships.

Do not create relationships simply because an invoice exists between two organizations.

Use explicit authorization and suitable privacy rules.

---

## 46. BUSINESS TRUST ASSESSMENT

The founder wants meaningful business trust information.

Develop a transparent, evidence-based assessment framework.

### Possible dimensions

- Identity verification.
- Credential validity.
- Business record completeness.
- Evidence freshness.
- Verified relationship history.
- Documented fulfillment evidence.
- Resolved disputes.
- Verified payment behavior, only where lawful, relevant and consented to.
- Source reliability.

### Crucial distinctions

A company can have strong verified identity evidence but insufficient payment history.

Another company may have extensive transactions but unverified legal identity.

Do not collapse these into one misleading "trustworthy/untrustworthy" label.

### Proposed presentation

Prefer a trust profile with independent dimensions:

- Identity Assurance.
- Evidence Quality.
- Relationship Verification.
- Operational History.
- Data Coverage.

If a composite score is implemented, its methodology must be explainable, justified and validated.

Do not invent percentages simply to fill a dashboard.

---

## 47. DATA PROTECTION AND FAIRNESS

Kenyan data protection obligations are relevant.

Implement safeguards for:

- Lawful processing.
- Transparency.
- Data minimization.
- Appropriate consent where relied upon.
- Access restrictions.
- Data accuracy.
- Correction.
- Disputes.
- Appropriate retention.
- Human review for consequential decisions where required.

Do not automatically decide lending eligibility, procurement access or other significant outcomes solely from an unvalidated trust score.

If assessment results are used for consequential decisions, require appropriate human oversight and legal/compliance review.

AfriCore Capital remains deferred.

---

# PART XI — BLOCKCHAIN VERIFICATION

## 48. BLOCKCHAIN PRODUCT PURPOSE

Blockchain should be used selectively to strengthen integrity and independent verification.

It is not required for every AfriCore financial transaction or ordinary business record.

### Suitable uses

- Proof anchoring.
- Credential integrity checkpoints.
- Timestamped commitments.
- Audit-chain checkpoints.
- Public verification of selected proofs.
- Independent verification references.

### Avoid

- Putting sensitive customer data on public chains.
- Storing identity documents on-chain.
- Publishing raw invoice amounts unnecessarily.
- Using blockchain as a substitute for proper database security.
- Treating on-chain presence as proof of business legitimacy.

---

## 49. REVIEW EXISTING BLOCKCHAIN IMPLEMENTATION

Inspect:

- Existing Solidity contracts.
- Proof creation.
- Hashing.
- Merkle tree implementation.
- Chain configuration.
- RPC connections.
- Wallet/key handling.
- Verification APIs.
- Testnet support.
- Audit logs.
- Existing deployed contracts.

Preserve working components.

Do not deploy duplicate contracts unnecessarily.

Do not deploy to mainnet without explicit authorization.

---

## 50. PROOF GENERATION

Create a secure proof-generation flow.

Conceptually:

Authorized Evidence → Canonical Representation → Cryptographic Digest → Proof Record → Optional Anchoring.

### Requirements

- Deterministic canonicalization.
- Domain separation.
- Stable proof identifiers.
- Hash algorithm versioning.
- Evidence references.
- Issuer or creator identity.
- Timestamp provenance.
- Verification method.
- Audit log.

### Privacy

Recognize that plain hashes of predictable personal identifiers may still enable guessing attacks.

Use appropriate keyed commitments, randomness or other privacy-preserving techniques where the threat model requires them.

Do not expose private records through public metadata.

---

## 51. MERKLE PROOFS AND BATCH ANCHORING

Where appropriate, support batching many proofs into a single cryptographic root.

### Features

- Batch creation.
- Leaf commitments.
- Merkle root calculation.
- Proof path generation.
- Root storage.
- Anchoring status.
- Independent verification.
- Retry handling.
- Audit log.

### Why

Batch anchoring can reduce transaction costs and avoid creating a blockchain transaction for every ordinary business event.

### Requirement

A verifier must be able to validate that a submitted proof belongs to the anchored root.

Do not claim ledger integrity from a root that can be silently replaced by the same administrator without independent verification.

---

## 52. BLOCKCHAIN ANCHORING

Use supported, authorized blockchain infrastructure.

Separate:

- Local development chain.
- Testnet.
- Production chain.

Track:

- Chain ID.
- Contract address.
- Transaction hash.
- Block number.
- Confirmation/finality status.
- Root commitment.
- Version.
- Error/retry status.

### Important

Do not make production chain selection based purely on marketing popularity.

Evaluate:

- Security.
- Stability.
- Fees.
- Data availability.
- Tooling.
- Ecosystem support.
- Verification requirements.

Do not spend real funds or deploy production contracts without authorization.

---

## 53. PUBLIC PROOF VERIFICATION

Build a clear verification page and API.

A verifier should be able to submit an appropriate proof or credential.

Display:

- Proof validity.
- Issuer/creator identity where known.
- Supported claim type.
- Credential expiration/status.
- Anchoring state.
- Blockchain network.
- Transaction reference where appropriate.
- Verification timestamp.
- Limitations.

Use plain language.

Example:

"This credential matches the recorded cryptographic proof and has not been revoked according to the available status information."

Do not claim:

"This proves the company is financially reliable."

Those are different claims.

---

## 54. SMART CONTRACT SECURITY

If smart contracts are used:

- Use appropriate access controls.
- Restrict anchor submission where required.
- Validate inputs.
- Prevent unintended upgrades.
- Protect ownership transitions.
- Emit suitable events.
- Handle key compromise.
- Audit signature verification.
- Review storage and gas constraints.

Use established security testing tools where compatible.

Do not invent contracts when a non-contract anchoring approach would better serve the requirement.

Run static analysis, unit tests and appropriate integration tests.

Document residual risks.

---

# PART XII — MODULAR SERVICE MARKETPLACE

## 55. INDEPENDENT ACTIVATION

The Milestone 3 services must integrate with AfriCore's Service Catalog.

Users can activate eligible services individually.

Examples:

### Business A

Uses Invoicing + Financial Intelligence.

Does not need blockchain verification.

### Business B

Uses Business Passport + Verifiable Credentials.

Does not need AfriCore Pay.

### Business C

Uses Automations + Connect.

Does not need AI.

### Developer

Uses Verification APIs and authorized data services.

Does not need a standard Business dashboard.

### Requirements

- Service entitlements.
- Activation.
- Setup.
- Dependency validation.
- Usage reporting.
- Deactivation.
- Appropriate navigation.
- Access enforcement.

Do not silently activate paid services.

---

## 56. USAGE METERING

Integrate with the existing metering system.

Potential units:

- AI credits or provider usage.
- Successful workflow executions.
- Successful connector synchronization operations.
- Data records processed where commercially appropriate.
- Credential issuance.
- Credential verification requests.
- API requests.
- Blockchain anchoring operations.

Define each billable unit precisely.

Avoid charging multiple times for internal retries.

Do not count failed provider calls as successful billable operations unless a transparent published pricing policy requires it.

Keep live customer billing disabled until configured and authorized.

---

# PART XIII — DEVELOPER PLATFORM

## 57. APIs FOR MILESTONE 3 SERVICES

Expose secure, versioned developer APIs where applicable.

Possible categories:

- Financial Intelligence.
- Automation.
- Connectors.
- Data Objects.
- Business Verification.
- Business Passport.
- Credential Issuance, authorized issuers only.
- Credential Verification.
- Trust Network.
- Blockchain Proof Verification.

### Requirements

- OpenAPI documentation.
- Authentication.
- Scoped API keys.
- Tenant authorization.
- Service entitlements.
- Rate limits.
- Idempotency.
- Pagination.
- Versioning.
- Webhooks.
- Usage tracking.
- Consistent errors.

Do not expose internal issuer-signing keys or administrative APIs to ordinary developers.

---

# PART XIV — FRONTEND AND USER EXPERIENCE

## 58. PRESERVE THE EXISTING DESIGN SYSTEM

Use the compact, responsive design developed in Milestone 1.

Keep:

- Consistent typography.
- Professional buttons.
- Rounded controls.
- Compact cards.
- Clear page hierarchy.
- Responsive tables.
- Fast navigation.
- Useful empty states.
- Correct loading behavior.

Do not reintroduce oversized cards and giant page headings.

---

## 59. PRODUCT-SPECIFIC EXPERIENCES

Do not make every product a generic dashboard.

### Financial Intelligence

Interactive charts and explanatory insights.

### AI Assistant

Messaging-style conversation.

### Automations

Workflow builder and run history.

### Connect

Integration cards and connection-health views.

### Data

Source coverage, mappings and quality.

### Business Verification

Step-by-step evidence submission and review.

### Business Passport

Identity profile and credential wallet.

### Verifiable Credentials

Issuance, presentation and verification.

### Trust Network

Business relationships and evidence.

### Blockchain Verification

Proof submission and clear verification results.

Every tool should feel suited to its actual purpose.

---

# PART XV — TESTING

## 60. FINANCIAL INTELLIGENCE TEST

1. Create isolated authorized financial records.
2. Generate actual summary metrics.
3. Verify arithmetic.
4. Test date filters.
5. Test different currencies.
6. Test incomplete datasets.
7. Produce forecast.
8. Change scenario assumptions.
9. Confirm assumptions affect the forecast.
10. Ensure no fabricated transaction history is inserted.

---

## 61. AI ASSISTANT TEST

1. Sign in as Business user.
2. Ask about overdue invoices.
3. Retrieve only authorized records.
4. Return the correct result.
5. Link to actual permitted records.
6. Attempt cross-workspace access.
7. Confirm denial.
8. Test prompt injection.
9. Test unauthorized tool execution.
10. Test spending limits.
11. Test incomplete data.
12. Test provider failure.

---

## 62. AUTOMATION TEST

1. Create an overdue-invoice reminder.
2. Activate workflow.
3. Trigger a qualifying event.
4. Verify conditions.
5. Execute the correct authorized action.
6. Record run.
7. Repeat the same event.
8. Confirm idempotency.
9. Simulate failure.
10. Verify retries.
11. Verify dead-letter behavior.
12. Pause workflow.
13. Confirm execution stops.
14. Test approval gating.

Use isolated test data.

---

## 63. CONNECTOR TEST

1. Create a test connection.
2. Authenticate to an authorized test provider.
3. Import records.
4. Verify validation.
5. Verify normalization.
6. Verify duplicate detection.
7. Trigger incremental sync.
8. Simulate provider failure.
9. Verify error reporting.
10. Revoke connection.
11. Confirm unauthorized further access is blocked.

Do not use real customer credentials in automated tests.

---

## 64. BUSINESS PASSPORT TEST

1. Create a Business profile.
2. Submit verification evidence.
3. Review through an authorized issuer/reviewer.
4. Issue a valid test credential.
5. Store it securely.
6. Present selected information.
7. Verify the credential.
8. Revoke credential.
9. Confirm status changes.
10. Test expired credential.
11. Test forged issuer.
12. Confirm unrelated documents remain private.

---

## 65. TRUST NETWORK TEST

1. Create two authorized test organizations.
2. Request relationship.
3. Accept relationship.
4. Attach permitted evidence.
5. Verify relationship status.
6. Share a selected credential.
7. Verify it as the recipient.
8. Revoke a relationship.
9. Confirm future access restrictions.
10. Attempt unauthorized disclosure.
11. Verify rejection.
12. Test a disputed or corrected claim.

---

## 66. BLOCKCHAIN PROOF TEST

1. Create authorized test evidence.
2. Generate canonical commitment.
3. Create proof.
4. Anchor on local chain or supported testnet.
5. Retrieve anchoring record.
6. Verify proof.
7. Modify evidence.
8. Confirm verification fails.
9. Test malformed proof.
10. Test wrong chain.
11. Test incorrect root.
12. Test revoked credential.
13. Verify confidential data has not been published on-chain.

---

## 67. CROSS-SERVICE TEST

Create an isolated Business workspace.

Activate:

- Invoicing.
- Financial Intelligence.
- AI Assistant.
- Automations.
- Business Passport.

Test the following:

1. Create customer.
2. Issue invoice.
3. Record authorized test payment evidence.
4. Reconcile payment.
5. Update financial analysis.
6. Ask AI about outstanding balances.
7. Verify accurate explanation.
8. Trigger a legitimate reminder automation.
9. Complete Business verification.
10. Issue an authorized test credential.
11. Share selected credential.
12. Verify cryptographic proof.
13. Confirm no unauthorized data disclosure.
14. Confirm correct usage metering.
15. Deactivate AI.
16. Verify AI entitlement is enforced without breaking Invoicing.

---

# PART XVI — SECURITY, PERFORMANCE AND DEPLOYMENT

## 68. SECURITY REQUIREMENTS

Preserve previous security remediations.

Specifically verify:

- Tenant isolation.
- JWT/session authorization.
- API scopes.
- Entitlements.
- Rate limiting.
- AI cost controls.
- Prompt-injection protection.
- Tool execution permissions.
- Secret management.
- Secure integration credentials.
- Webhook SSRF protections.
- Approval binding.
- File privacy.
- Credential issuer restrictions.
- Signing-key protection.
- Blockchain privacy.
- Audit logging.
- Appropriate data retention.

Do not claim security based solely on tests that never execute against an actual backend.

---

## 69. PERFORMANCE

Measure and improve:

- Intelligence query latency.
- AI response initiation.
- Automation execution latency.
- Connector synchronization.
- Data normalization.
- Credential verification.
- Passport loading.
- Trust Network queries.
- Blockchain verification latency.

Keep asynchronous tasks off blocking request paths where appropriate.

Use caching carefully without leaking private data.

Avoid expensive repeated queries.

---

## 70. SAFE DEPLOYMENT

Use the existing repository and infrastructure.

Preserve:

- Cloudflare deployment.
- Existing backend host.
- Neon database.
- Authentication.
- Business and Personal accounts.
- Developer accounts.
- Existing finance services.
- Prior security fixes.
- Historical financial records.

### Release sequence

1. Audit.
2. Create safe implementation branch.
3. Establish baseline tests.
4. Implement intelligence.
5. Implement AI Assistant.
6. Implement automation engine.
7. Implement Connect and Data.
8. Implement Business Verification.
9. Implement Passport and Credentials.
10. Implement Trust Network.
11. Integrate blockchain verification.
12. Integrate service entitlements and APIs.
13. Run complete tests.
14. Validate migrations.
15. Deploy to staging or preview.
16. Verify actual functionality.
17. Deploy approved changes.
18. Verify existing accounts and services.
19. Produce implementation report.

Do not deploy new production smart contracts or activate billable external services without authorization.

---

# 71. DOCUMENTATION

Create or update documentation for:

- Milestone 3 Architecture.
- Financial Intelligence.
- Forecasting.
- AI Assistant.
- AI Security.
- AI Usage and Cost Controls.
- Automations.
- Workflow Engine.
- Workflow Approvals.
- AfriCore Connect.
- Connector Framework.
- AfriCore Data.
- Data Quality.
- Data Provenance.
- Business Verification.
- Business Passport.
- Verifiable Credentials.
- Credential Issuance.
- Credential Verification.
- Trust Network.
- Trust Assessment Methodology.
- Blockchain Proofs.
- Smart Contracts.
- Security.
- API Contracts.
- Service Entitlements.
- Tests.
- Deployment.
- Implementation Status.

Update `AGENTS.md`.

Use meaningful folder and documentation names.

Do not create folders named only after milestones or stages.

Avoid duplicating existing documentation.

---

# 72. COMPLETION CRITERIA

Milestone 3 is complete when:

### Intelligence

- Reliable financial metrics.
- Meaningful trends.
- Explainable forecasting.
- Scenario analysis.
- Useful alerts.
- Correct source provenance.

### AI

- Permission-aware conversations.
- Source-backed answers.
- Correct financial calculations.
- Tool restrictions.
- Safe confirmation for actions.
- Working cost limits.
- Prompt-injection regression tests.

### Automations

- Workflow builder works.
- Triggers work.
- Conditions work.
- Actions work.
- Scheduling works.
- Durable execution.
- Retry handling.
- Human approvals.
- Execution logs.

### Connect and Data

- Connector framework works.
- Authorized connections.
- Data synchronization.
- Deduplication.
- Normalization.
- Data quality.
- Secure access.
- Revocation.

### Business Identity

- Verification workflows work.
- Passport works.
- Credential issuance is issuer-authorized.
- Credential sharing is permission-controlled.
- Credential verification works.
- Expiration and revocation work.

### Trust

- Business relationship requests work.
- Relationships use evidence.
- Trust assessments are explainable.
- Disputes/corrections are supported.
- Private information remains protected.

### Blockchain

- Proof generation works.
- Verification works.
- Tampering is detected.
- Test anchoring works where configured.
- Chain status is correctly represented.
- Private records are not published on-chain.
- Smart-contract tests are executed.

### Platform

- Independent service activation works.
- Entitlements are enforced.
- Usage is measured correctly.
- Mobile interfaces work.
- Existing accounts remain intact.
- Neon persistence works.
- Cloudflare and backend remain operational.
- Milestone 2 financial features are not broken.
- Security tests pass.
- Actual deployment results are documented.

---

# 73. FINAL IMPLEMENTATION REPORT

Provide a complete, evidence-backed report.

## A. Architecture

Explain the final module relationships.

## B. Financial Intelligence

Describe metrics, forecasting and data quality.

## C. AI Assistant

Describe provider integration, authorized tools, citations, security and costs.

## D. Automations

Describe execution engine, templates, approvals, retries and operational monitoring.

## E. Connect and Data

Describe actual connectors, source mappings, synchronization and data normalization.

## F. Business Identity

Describe verification, Business Passport, issuers, credential wallet and sharing.

## G. Trust Network

Describe verified relationships, trust assessments, evidence and privacy.

## H. Blockchain

Describe proof format, contracts, network, anchoring, verification and limitations.

## I. Service Marketplace

Confirm activation, access control and metering for each product.

## J. Testing

Provide actual commands, results, failed tests and remaining gaps.

## K. Deployment

Provide real deployment status, applied migrations, verified endpoints and any outstanding configuration.

## L. External Dependencies

Clearly list:

- Missing AI provider credentials.
- Connector provider approvals.
- External business registry integrations.
- Authorized credential issuers.
- Blockchain RPC credentials.
- Testnet or mainnet configuration.
- Any unresolved security issues.
- Any required legal/compliance review.

Do not claim external capabilities are live when they are not.

---

# FINAL DIRECTIVE

Milestone 1 established the quality and security foundation.

Milestone 2 established the connected financial operating system.

**Milestone 3 must build the intelligence, automation, data connectivity and business trust infrastructure on top of that foundation.**

AfriCore should help businesses understand their records, automate routine operations, connect authorized systems, prove selected business attributes and establish trustworthy business relationships.

Every product must function as an independent, optional service while remaining compatible with the rest of the platform.

Use real backend services and persistent data.

Make financial insights explainable.

Make AI permission-aware.

Make automations durable and secure.

Make connectors reliable.

Make credentials standards-based.

Make trust assessments evidence-based.

Make blockchain verification privacy-conscious and cryptographically meaningful.

Preserve existing identities, financial records, Neon, Cloudflare, application security, service entitlements and previous milestones.

Do not enable live lending, unauthorized data sharing or unapproved production blockchain operations.

**Inspect the repository, implement the missing functionality, improve existing implementations, run comprehensive cross-service tests, safely deploy validated changes, and produce a complete engineering report.**

Do not begin Milestone 4 until this milestone has been verified and reviewed.