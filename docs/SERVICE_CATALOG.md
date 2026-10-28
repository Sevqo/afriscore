# Service catalog and factual inventory

28 October 2026. Registry: `src/marketplace/catalog.ts`; enforcement and persistence: [SERVICE_ARCHITECTURE](SERVICE_ARCHITECTURE.md). All entries have implemented server support and persistent workspace records; availability below distinguishes ordinary record tools, configured external explanations/delivery and test-only financial/trust operations. Basic reporting and exports are foundation, not a duplicate paid product.

| Service | Eligible workspace kinds | Current boundary | Usage unit | Required optional services |
|---|---|---|---|---|
| Customers & clients (customers) | personal, business, developer | Persistent record/computation tool | customer records | None |
| Orders (orders) | business, developer | Persistent record/computation tool | orders created | None |
| Invoicing (invoicing) | personal, business, developer | Persistent record/computation tool | issued invoices | None |
| Income tracking (income) | personal | Persistent record/computation tool | income entries | None |
| Expenses (expenses) | personal, business | Persistent record/computation tool | expense entries | None |
| Cash Flow (cash_flow) | personal, business | Persistent record/computation tool | cash-flow entries | None |
| AfriCore Pay (payments) | personal, business, developer | Test/evaluation workflow; no live financial activation | confirmed test payments | None |
| Reconciliation (reconciliation) | business, developer | Test/evaluation workflow; no live financial activation | resolved reconciliation exceptions | None |
| Financial Intelligence (intelligence) | business | Persistent record/computation tool | analysis requests | None |
| Forecasts (forecasting) | business | Persistent record/computation tool | scenarios calculated | None |
| AI Business Assistant (assistant) | business | Requires server/provider setup | successful explanations | None |
| Automations (automations) | business | Persistent record/computation tool | completed workflow executions | None |
| Connect & data sync (connect) | business, developer | Test/evaluation workflow; no live financial activation | successful sync runs | None |
| Business Passport (passport) | business | Test/evaluation workflow; no live financial activation | Passports created | None |
| Business Verification (verification) | business | Test/evaluation workflow; no live financial activation | eligible completed reviews | passport |
| Verifiable Credentials (credentials) | business | Test/evaluation workflow; no live financial activation | credentials issued | passport |
| Trust Network (trust_network) | business | Test/evaluation workflow; no live financial activation | relationships requested | passport |
| Blockchain Verification (blockchain) | business | Test/evaluation workflow; no live financial activation | proof checks | credentials |
| Fulfillment & delivery (fulfillment) | business | Persistent record/computation tool | shipments created | None |
| Protected Payments (protected_payments) | business | Test/evaluation workflow; no live financial activation | test agreements created | None |
| Developer API access (developer_api) | business, developer | Test/evaluation workflow; no live financial activation | successful API requests | None |
| Webhooks (webhooks) | business, developer | Requires server/provider setup | successful deliveries | None |
| Verification APIs (verification_api) | business, developer | Test/evaluation workflow; no live financial activation | verification requests | None |

## Service education

### Customers & clients
Keep customer details in one place.

Create and correct contact records for people you work with. Invoicing and Orders can use customer records without requiring a separate Customers subscription.

Workflow: Add a contact → Use it on a document → Keep its history.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/business. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Orders
Track agreed work and what needs delivery.

Record items, prices and fulfillment status before invoicing. An order is an agreement record; it does not confirm payment.

Workflow: Choose a customer → Record items → Issue or invoice the order.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/business. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Invoicing
Create invoices and follow the remaining amount owed.

Draft and issue invoices with customer details, currency and due date. Customer entry is included; payment collection and advanced intelligence are optional.

Workflow: Add a customer → Draft line items → Issue the invoice → Review its remaining balance.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/invoicing. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Income tracking
Record money you received from your own work.

Manual income entries remain separate from independently confirmed provider payments. Use category and date filters to review your own records.

Workflow: Describe the income → Enter amount and date → Review your summary.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /docs. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Expenses
Record outgoing costs with dates and categories.

Save merchant-reported expenses and corrections. Recorded net movement is not a bank balance or profit calculation.

Workflow: Enter the cost → Choose its currency and date → Review the expense history.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/cash-flow. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Cash Flow
Understand recorded movement and upcoming commitments.

Compare covered inflows with expenses, then plan dated obligations. Manual records and test payment evidence stay clearly separated.

Workflow: Choose a period → Review incoming and outgoing records → Plan an obligation.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/cash-flow. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### AfriCore Pay
Create payment requests and inspect their outcomes.

The current provider is a test simulation. Requests, confirmation and allocation are separate; no real money is collected.

Workflow: Issue a document → Create its payment request → Test an outcome → Review confirmation.
Setup: Live collection is not configured. Test outcomes move no real funds.
Documentation: /products/pay. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Reconciliation
Match recorded payments to the right documents.

Review unmatched entries and explain allocations. An unknown reference or conflicting currency needs review; matching does not establish the truth of an imported statement.

Workflow: Inspect an incoming record → Find its document → Confirm the allocation.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/reconciliation. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Financial Intelligence
Understand covered financial patterns and their sources.

Inspect receivables, data coverage and descriptive signals. These results do not approve credit or fill gaps with invented revenue.

Workflow: Choose currency and dates → Inspect the result → Review source coverage.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/intelligence. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Forecasts
Explore future collection and expense scenarios.

Set explicit collection, delay and outflow assumptions. A scenario is a projection, not a promised balance or payment.

Workflow: Choose a horizon → Set assumptions → Calculate and compare.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /learn/forecasts. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### AI Business Assistant
Ask for an explanation of selected business metrics.

A configured model can explain minimized evidence only after per-request consent. It cannot send payments or approve credit. Global AI cost safeguards remain independent of your workspace limits.

Workflow: Choose a supported question → Review the evidence → Consent to an explanation.
Setup: A supported server-side AI provider and model must be configured.
Documentation: /products/intelligence. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Automations
Run supported reminders and review workflows.

Choose a trigger, condition and supported action, then inspect run history. Account security notifications remain part of the foundation.

Workflow: Choose a template → Review its rule → Enable and follow its runs.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/automations. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Connect & data sync
Import and organize authorized external records.

Current connectors are simulated. Their source classification is retained; choosing one does not connect a real bank or government system.

Workflow: Choose a source → Review authorization → Run and inspect the result.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/connect. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Business Passport
Organize a business profile and controlled evidence.

Build a private profile, collect supporting evidence and choose what to share. A profile is not independent business verification.

Workflow: Create a profile → Organize evidence → Share only what is needed.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/business-passport. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Business Verification
Submit business evidence for a recorded review.

Email verification proves mailbox control; this service concerns business evidence. Review remains manual and does not claim government recognition.

Workflow: Prepare evidence → Submit for review → Inspect the recorded outcome.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/business-verification. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Verifiable Credentials
Issue and manage narrowly defined signed claims.

Inspect issuer, evidence, expiry and revocation separately. A valid signature protects integrity; it does not make every claim true.

Workflow: Review evidence → Request a supported credential → Check its status.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/verifiable-credentials. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Trust Network
Ask a counterparty to confirm a specific relationship.

One business cannot manufacture the other party’s confirmation. A connection is contextual evidence, not an endorsement or payment guarantee.

Workflow: Name a relationship → Ask for confirmation → Review its source and status.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/trust-network. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Blockchain Verification
Inspect a credential’s batch inclusion proof.

Private evidence stays off-chain. A proof checks inclusion of a commitment; it cannot establish the truth of the underlying business claim.

Workflow: Choose a credential → Inspect its commitment → Verify proof and status.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/blockchain-verification. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Fulfillment & delivery
Follow order delivery through recorded milestones.

Record shipment transitions and supporting evidence. A delivery status is not the same as confirmed customer acceptance or payment.

Workflow: Choose an order → Record dispatch → Follow delivery evidence.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/business. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Protected Payments
Test an agreement, delivery and reviewed outcome.

This is a sandbox agreement workflow. It performs no live escrow, release, refund or custody operation.

Workflow: Record an agreement → Collect buyer acceptance → Review delivery or dispute.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/protected-payments. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Developer API access
Connect your software through scoped APIs.

Create an application and scoped test credentials. Each optional product also needs its workspace entitlement; a key never grants internal operator access.

Workflow: Create an application → Generate a scoped test key → Call an enabled product.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /developers. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Webhooks
Receive signed notifications from enabled services.

Register a qualified HTTPS receiver and verify its signatures. Retry delivery is at least once; your receiver must deduplicate.

Workflow: Configure an approved receiver → Choose events → Verify signatures and delivery history.
Setup: An exact approved HTTPS receiver hostname is required. Hosted delivery is currently disabled.
Documentation: /developers. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

### Verification APIs
Check a supplied credential’s integrity and status.

Use a workspace-scoped verification endpoint and inspect signature, expiry and issuer context. Public bounded verification remains available without purchasing a service.

Workflow: Submit a credential → Inspect checks separately → Evaluate issuer authority.
Setup: Use an authorized workspace and applicable role; review any evidence required by the operation.
Documentation: /products/verification-api. Deactivation stops new operations. Existing records and audit history remain available for authorized review and export.

## Supporting capabilities

Customer entry is included with Invoicing/Orders. Public verification is bounded separately from workspace verification APIs. Human account and key revocation, ownership, audit, security notices and exports remain foundation. Existing product-specific vector diagrams and interactive walkthroughs are retained alongside the registry-backed purpose, workflow, dependencies and activation/pricing explanations. Capital is deferred. Service activation cannot grant issuer recognition, government verification, financing approval, custody or a live payment integration.
