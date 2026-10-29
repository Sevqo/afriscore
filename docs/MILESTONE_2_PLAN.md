# AFRICORE — MILESTONE 2
# COMPLETE PAYMENTS, INVOICING, RECONCILIATION & FINANCIAL OPERATIONS ENGINEERING

## MASTER IMPLEMENTATION PROMPT FOR CODEX

### PROJECT STATUS

Milestone 1 — Application Quality and Account Security — has been completed.

We are now beginning **Milestone 2: Payments and Financial Infrastructure**.

The AfriCore platform already has an established codebase, cloud deployment, authentication, Neon PostgreSQL, service marketplace, account workspaces, and existing product implementations.

Do not rebuild the application from scratch.

Continue directly from the current repository and preserve all completed Milestone 1 improvements.

### YOUR ROLE

Act as a principal payments architect, senior fintech backend engineer, full-stack engineer, database architect, financial systems engineer, DevSecOps specialist, API designer, technical product designer, and QA lead.

Your goal is to transform AfriCore's existing financial modules into a cohesive, secure, accurate, production-quality software foundation.

This milestone covers:

1. Shared Customers and Orders foundation.
2. Invoicing and Receivables.
3. AfriCore Pay.
4. Payment Reconciliation.
5. Expenses and Recurring Obligations.
6. Cash Flow and Financial Reporting.
7. Integration with the existing modular Service Marketplace.
8. Associated backend APIs, user interfaces, documentation and comprehensive testing.

**Do not start the full Milestone 3 AI, automation, blockchain, or trust-infrastructure expansion yet.**

Existing modules from those areas must remain functional.

---

# 1. NON-NEGOTIABLE ENGINEERING PRINCIPLES

Follow these principles throughout implementation:

- Preserve the existing codebase and production records.
- Preserve Cloudflare and existing backend hosting.
- Preserve Neon PostgreSQL and authentication.
- Preserve the user's registered workspaces, including Continua.
- Preserve the compact application design implemented in Milestone 1.
- Preserve security fixes from the previous audits.
- Keep every product independently activatable where appropriate.
- Share underlying financial and customer records rather than duplicating them.
- Enforce authorization on the backend.
- Use authoritative provider evidence for payment confirmation.
- Never fabricate financial records.
- Never describe synthetic payments as real transactions.
- Never activate unauthorized real-money processing.
- Never make destructive database changes without approved safeguards.
- Avoid unnecessary new services, languages or infrastructure.
- Do not claim external integrations are operational without actual verification.

Develop real working software, not demonstration pages that only look functional.

---

# 2. AUDIT THE EXISTING FINANCIAL PLATFORM

Before making changes, thoroughly inspect the repository.

Read:

- `AGENTS.md`.
- Existing architecture documents.
- Financial product documentation.
- Payment service code.
- Invoice service code.
- Reconciliation logic.
- Cash Flow implementation.
- Expenses.
- Orders and Customers.
- Usage and service entitlements.
- Backend routing.
- Database schema.
- Authentication and authorization.
- Provider adapters.
- Background workers.
- Deployment configuration.
- Existing tests.

Determine exactly which functions already work.

Create a capability matrix with:

- Product.
- User interface.
- Backend implementation.
- Database model.
- API routes.
- Authentication.
- Authorization.
- External dependencies.
- Known defects.
- Current readiness.
- Required improvements.

Reuse the existing architecture wherever technically appropriate.

Do not duplicate completed functionality.

---

# 3. DESIGN ONE CONNECTED FINANCIAL DOMAIN

AfriCore must have a consistent financial data model.

The key requirement is that products operate independently but share authoritative records.

Suggested relationship:

Customer → Order → Invoice → Payment Request → Provider Event → Reconciliation → Financial Reporting.

Expenses and Obligations feed the financial reporting system separately.

### Core entities

Inspect and reuse existing equivalents for:

- Customer.
- Order.
- Order Line.
- Invoice.
- Invoice Line.
- Credit Note.
- Payment Request.
- Payment Attempt.
- Provider Payment Event.
- Payment Allocation.
- Refund.
- Reversal.
- Settlement Record.
- Expense.
- Recurring Obligation.
- Financial Activity Entry.
- Reconciliation Exception.
- Audit Event.
- Provider Connection.

Use stable identifiers and appropriate foreign keys.

### Avoid duplicated financial facts

An order, invoice, payment, allocation and financial summary are not interchangeable.

Financial reporting must derive from the correct authoritative records.

Do not create separate unrelated "payment histories" in each product.

### Database

Use Neon PostgreSQL.

Apply versioned, reversible or safely forward-compatible migrations.

Use appropriate constraints, indexes and transactional consistency.

Preserve tenant isolation.

---

# 4. MONEY, CURRENCY AND FINANCIAL PRECISION

Establish shared financial arithmetic utilities.

Use either exact PostgreSQL decimal/numeric arithmetic or validated integer minor-unit representations as appropriate.

Never use ordinary floating-point calculations for authoritative money totals.

Support:

- Currency codes.
- Currency-specific precision.
- Rounding rules.
- Fees.
- Discounts.
- Taxes where configured.
- Partial payments.
- Credit notes.
- Refunds.
- Reversals.
- Outstanding balances.

Use KES as the primary initial currency where the workspace is configured for it.

Do not hardcode KES into every financial calculation.

Do not perform silent currency conversion.

Use properly sourced exchange rates only when actual conversion functionality is available.

---

# 5. CUSTOMERS — SHARED FOUNDATION

Improve the existing Customer Management service.

### Required functionality

- Create customer.
- Edit customer.
- Archive customer.
- Search and filter.
- Store contact information.
- Display customer activity.
- Associate orders.
- Associate invoices.
- Associate payments.
- Display outstanding receivables.
- Import and export authorized records.
- Identify likely duplicates.
- View a useful customer timeline.

### Business rules

Do not duplicate customer records unnecessarily.

Customer ownership must be workspace-scoped.

Archived customers must not cause historical invoices to lose their customer relationship.

### UI

Use the compact Milestone 1 design system.

Provide:

- Customer list.
- Customer details.
- Related orders.
- Related invoices.
- Outstanding balances.
- Activity history.

### Tests

Verify creation, modification, isolation, archiving, pagination and customer-to-invoice relationships.

---

# 6. ORDERS — COMPLETE ORDER LIFECYCLE

Create or improve the Order Management service.

### Required functionality

- Create order.
- Select customer.
- Add products or services.
- Quantity.
- Unit price.
- Currency.
- Discount.
- Tax configuration.
- Order totals.
- Order status.
- Payment status.
- Fulfillment status.
- Related invoices.
- Order timeline.
- Cancellation where permitted.

### Important

Order fulfillment and payment status must remain separate.

A paid order may still be awaiting delivery.

A fulfilled order may still have an outstanding payment depending on business terms.

### Integration

Users must be able to generate an invoice from an order.

Do not create duplicate charges or double-count revenue because both an order and its invoice exist.

### Tests

Test draft, confirmation, invoicing, partial payment, cancellation and related status transitions.

---

# 7. INVOICING — COMPLETE PRODUCT IMPLEMENTATION

This is one of AfriCore's most important products.

A business should be able to use Invoicing without activating AfriCore Pay.

### Create invoices

Support:

- Customer.
- Invoice number.
- Invoice date.
- Due date.
- Currency.
- Line items.
- Quantity.
- Unit price.
- Discount.
- Tax.
- Notes.
- Payment instructions.
- Terms.
- Attachments where supported.

### Invoice lifecycle

Implement a valid state model.

Suggested states:

- Draft.
- Issued.
- Partially Paid.
- Paid.
- Voided.
- Credited.

Overdue may be a calculated condition based on due date and outstanding balance.

Avoid incompatible overlapping states.

### Payment accounting

Support:

- Unpaid amount.
- Partial payments.
- Multiple payment allocations.
- Payment reversals.
- Credit notes.
- Accurate outstanding balances.

### PDF and sharing

Generate professional invoice PDFs.

Support secure download and appropriate sharing options.

Do not publicly expose private invoice data.

### Reminders

Support manual reminders.

Where scheduled reminders already exist, verify their delivery logic and permissions.

Do not send real customer emails until delivery infrastructure is configured.

### Example test

Create an invoice for KSh 50,000.

Allocate a verified payment of KSh 30,000.

The invoice must show:

Total: KSh 50,000.

Paid: KSh 30,000.

Outstanding: KSh 20,000.

After another verified KSh 20,000 payment, it must become fully paid.

### UI

Build a professional invoice workspace:

- Overview.
- All Invoices.
- Drafts.
- Outstanding.
- Overdue.
- Paid.
- Create Invoice.
- Invoice Details.

Preserve compact styling.

---

# 8. RECEIVABLES — ACCURATE AMOUNTS OWED

Implement or improve the receivables service.

### Required features

- Outstanding balances.
- Partial-payment visibility.
- Due-date tracking.
- Overdue balances.
- Aging buckets.
- Customer concentration.
- Payment history.
- Collections activity.
- Receivable reports.

### Aging

Use appropriate categories:

- Not yet due.
- 1–30 days overdue.
- 31–60 days.
- 61–90 days.
- Over 90 days.

Calculate from the correct invoice and payment dates.

### DSO

If Days Sales Outstanding is implemented, use a clearly documented accounting methodology and appropriate source data.

Do not calculate DSO using reconciliation timestamps instead of transaction occurrence dates.

Do not represent incomplete records as fully verified financial statements.

---

# 9. AFRICORE PAY — PAYMENT SOFTWARE INFRASTRUCTURE

## PRODUCT VISION

AfriCore Pay should operate as a modular payment orchestration and merchant integration platform.

It should connect:

- Business merchants.
- Customers.
- Orders.
- Invoices.
- Checkout.
- Payment links.
- Authorized payment providers.
- Payment events.
- Reconciliation.
- Financial reporting.
- Developer APIs.

Use Stripe's payment architecture as an engineering reference.

Reference documentation:

https://docs.stripe.com/payments/payment-intents

https://docs.stripe.com/payments/checkout

https://docs.stripe.com/webhooks

https://docs.stripe.com/api/idempotent_requests

Do not copy Stripe's branding, proprietary code or UI assets.

## 9.1 Merchant configuration

Allow a business to configure its eligible payment methods.

Include:

- Business profile.
- Available providers.
- Provider connection status.
- Supported currencies.
- Payment method status.
- Merchant readiness.
- Required verification.
- Provider-specific configuration.
- Webhook configuration where relevant.

Do not imply that account registration alone creates an approved live merchant account.

## 9.2 Payment requests

Allow authorized merchants to:

- Create a payment request.
- Associate it with an order or invoice.
- Specify amount and currency.
- Set an expiry.
- View request status.
- Cancel an eligible request.
- Generate a secure payment link.

Enforce proper amount and ownership validation.

## 9.3 Payment links

Create secure shareable checkout links.

Use high-entropy opaque identifiers.

Avoid exposing administrative API credentials or reusable authentication secrets in URLs.

Support expiration and revocation.

## 9.4 Hosted checkout

Create a clean, mobile-first AfriCore checkout.

Display:

- Merchant name.
- Order or invoice summary.
- Amount and currency.
- Supported payment method.
- Relevant customer details.
- Payment progress.
- Verified result.
- Failure/retry guidance.

Do not display "Payment Successful" merely because the customer submitted a form.

Only authoritative confirmed payment status can establish success.

## 9.5 Payment lifecycle

Implement a validated state machine supporting provider-appropriate states such as:

- Created.
- Pending.
- Customer Action Required.
- Processing.
- Succeeded.
- Failed.
- Cancelled.
- Expired.
- Refunded.
- Reversed.

Keep payment initiation, confirmation, allocation and settlement separate.

## 9.6 Provider abstraction

Build a provider-independent adapter interface.

Possible operations:

- Initiate payment.
- Retrieve status.
- Handle callback.
- Verify provider evidence.
- Request reversal where supported.
- Request refund where supported.
- Inspect provider capabilities.

Do not assume every provider supports every operation.

Record supported operations explicitly.

## 9.7 Payment service dashboard

Provide:

- Payment requests.
- Payment attempts.
- Confirmed payments.
- Failed payments.
- Pending payments.
- Refunds and reversals.
- Provider connections.
- Transaction details.
- Relevant reports.

Use genuine records.

---

# 10. SAFARICOM M-PESA / DARAJA INTEGRATION

Official API reference:

https://daraja.safaricom.co.ke/apis

Inspect currently documented APIs and applicable merchant prerequisites.

Implement a reliable Daraja adapter for the provider capabilities actually available to the project.

### Initial priority

Support properly configured test flows for:

- M-Pesa Express/STK Push.
- Asynchronous payment-result processing.
- Supported transaction-status lookup.
- Applicable C2B confirmations.

Add reversals and other operations only when supported and authorized.

### Essential rules

- Keep API credentials server-side.
- Do not expose consumer secrets in browser code.
- Handle OAuth/token lifecycle properly.
- Validate merchant configuration.
- Validate phone number formatting.
- Validate permitted amounts.
- Handle timeouts.
- Handle customer cancellation.
- Handle duplicate callbacks.
- Handle callbacks arriving out of order.
- Store provider transaction references.
- Reconcile ambiguous results against authoritative provider information.
- Record errors safely.
- Never infer payment success from the initial STK Push acknowledgment.

### Provider callback security

Use the strongest authenticity controls actually supported by the documented provider integration.

Do not invent a cryptographic signature field that the provider does not supply.

Where applicable, use authenticated status confirmation and strict transaction-reference, merchant, amount and currency matching.

### Test and live modes

Isolate test credentials from live credentials.

Ordinary Business users must not see unnecessary developer-style Sandbox banners.

However, test payments must always be accurately identified as simulated.

### Live activation

Keep real payment processing disabled until actual provider credentials, merchant approval, operational readiness and required legal/compliance checks are satisfied.

---

# 11. PAYMENT WEBHOOKS AND EVENT PROCESSING

Implement a robust payment-event pipeline.

### Required stages

1. Receive provider callback.
2. Validate request.
3. Authenticate or corroborate provider evidence using supported methods.
4. Identify provider account.
5. Identify related payment request.
6. Validate amount/currency/reference.
7. Persist event idempotently.
8. Apply allowed state transition.
9. Generate domain event.
10. Update reconciliation where appropriate.
11. Dispatch downstream notifications asynchronously.

### Reliability

Support:

- At-least-once event delivery where appropriate.
- Duplicate protection.
- Idempotency.
- Concurrency safety.
- Retries.
- Timeouts.
- Dead-letter handling.
- Durable outbox.
- Observability.
- Proper recovery after worker failure.

Do not block payment reconciliation waiting for slow third-party webhook receivers.

---

# 12. PAYMENT IDEMPOTENCY

Payment operations must be safe under retries.

Use an appropriate idempotency model.

Protect:

- Payment request creation.
- Provider initiation.
- Callback processing.
- Financial allocation.
- Reversal.
- Refund.
- Merchant notifications.

Key uniqueness must reflect actual provider and merchant reference semantics.

Avoid cross-tenant collisions and duplicate processing.

Use database constraints and transactions where appropriate.

### Mandatory tests

- Duplicate callback.
- Concurrent callback.
- Retry after timeout.
- Duplicate client submission.
- Same provider reference in different legitimate scopes.
- Out-of-order events.
- Reversal after payment confirmation.

A duplicated provider event must not create duplicate recorded inflows.

---

# 13. PAYMENT RECONCILIATION

## PRODUCT PURPOSE

Help merchants match actual payment evidence to invoices and orders.

### Automatic matching

Use reliable evidence such as:

- Provider transaction reference.
- Merchant reference.
- Invoice reference.
- Order reference.
- Amount.
- Currency.
- Provider identity.
- Applicable timestamps.

### Matching outcomes

- Matched.
- Partially Matched.
- Unmatched.
- Ambiguous.
- Duplicate.
- Reversed.
- Requires Review.

Do not automatically force an ambiguous match.

### Manual reconciliation

Allow authorized staff to review unresolved payments.

Display:

- Payment evidence.
- Candidate invoices.
- Amounts.
- Customer details where authorized.
- Reason for suggested match.
- Confidence/evidence where justified.

### Financial correctness

Support:

- One payment allocated to an invoice.
- Multiple payments allocated to one invoice.
- One payment allocated across multiple invoices where permitted.
- Partial payments.
- Overpayments.
- Credits.
- Reversals.
- Reallocation with audit history.

### Performance

Avoid unbounded combinatorial searches.

Use bounded and explainable matching algorithms.

Move expensive matching jobs to a suitable background execution mechanism if necessary.

### User interface

Create:

- Reconciliation Overview.
- Automatically Matched.
- Unmatched.
- Exceptions.
- Manual Review.
- History.

---

# 14. EXPENSE MANAGEMENT

## PRODUCT PURPOSE

Allow businesses and eligible Personal accounts to record and categorize expenses.

### Required functionality

- Record expense.
- Edit expense.
- Archive or reverse according to policy.
- Category.
- Amount.
- Currency.
- Payment date.
- Supplier.
- Notes.
- Supporting attachment.
- Related order or obligation.
- Search.
- Filters.
- Export.
- Reports.

### Source distinctions

Clearly distinguish:

- Manually recorded expense.
- Imported expense.
- Provider-confirmed outgoing transaction.

Do not automatically treat self-reported expenses as externally verified payments.

### Data integrity

Prevent duplicate expense submission.

Apply appropriate authorization and audit logging.

---

# 15. RECURRING OBLIGATIONS

## PRODUCT PURPOSE

Track bills and other future payment commitments.

Examples:

- Rent.
- Supplier payments.
- Subscriptions.
- Insurance.
- Equipment costs.
- Regular service expenses.

### Functionality

- Create obligation.
- Amount.
- Frequency.
- Next due date.
- Category.
- Supplier.
- Reminder preferences.
- Status.
- Edit.
- Pause.
- Cancel.
- Mark fulfilled.
- View upcoming obligations.

### Scheduling

Support appropriate recurrence patterns.

Handle:

- Month-end dates.
- Leap years.
- Timezones.
- Missed schedules.
- Duplicate job prevention.

Do not treat a planned obligation as an expense already paid.

Keep forecasts and actual spending separate.

---

# 16. CASH FLOW & FINANCIAL REPORTING

## PRODUCT PURPOSE

Give business owners accurate visibility into recorded money movements and future financial commitments.

### Core metrics

- Confirmed inflows.
- Recorded outflows.
- Net recorded movement.
- Outstanding invoices.
- Overdue invoices.
- Upcoming obligations.
- Payment trends.
- Expense trends.

### Required functionality

- Financial Activity.
- Interactive charts.
- Date-range filters.
- Currency filters.
- Category analysis.
- Customer concentration.
- Expense breakdown.
- Receivables aging.
- Export CSV.
- Financial summaries.
- Data quality.

### Reporting correctness

Distinguish:

**Confirmed collections**

Payments supported by authoritative evidence.

**Recorded expenses**

Expenses entered or imported with their stated evidence level.

**Net recorded movement**

A calculation over covered records, not necessarily actual bank-account balance.

**Outstanding receivables**

Amounts customers still owe.

**Forecast**

An estimate based on available records, not a guaranteed future balance.

### Charts

Preserve and improve the existing Robinhood-inspired interactive chart system.

Support:

- 7D.
- 30D.
- 90D.
- YTD.
- 1Y.
- All.

Ensure all selectors work.

Do not draw fake data.

### Data quality

Provide meaningful notices for:

- Insufficient history.
- Unverified imported records.
- Missing data sources.
- Incomplete reconciliation.
- Mixed currencies.
- Duplicate or conflicting records.

---

# 17. SHARED FINANCIAL EVENTS AND AUDITABILITY

Implement appropriate domain events, such as:

- Customer Created.
- Order Confirmed.
- Invoice Issued.
- Invoice Voided.
- Payment Requested.
- Payment Confirmed.
- Payment Failed.
- Payment Allocated.
- Payment Reversed.
- Expense Recorded.
- Obligation Due.
- Reconciliation Exception Created.

Events must be attributed correctly to workspaces.

Use stable event identifiers.

Preserve audit history.

### Important

Do not implement an inaccurate fake bank ledger.

If a formal general ledger is not within the existing product scope, use clearly defined immutable transaction/event records with correct financial semantics.

If double-entry accounting is introduced, it must be implemented consistently rather than as decorative debit/credit fields.

---

# 18. SERVICE MARKETPLACE INTEGRATION

Milestone 1 introduced a modular service system.

This milestone must respect it fully.

### Invoicing

Can be activated independently.

### AfriCore Pay

Requires appropriate payment configuration before live processing.

### Reconciliation

Can use supported provider evidence or authorized imported data.

Should not require AfriCore Pay when an alternative legitimate source exists.

### Expenses

Can operate independently.

### Cash Flow

Can operate over the user's authorized existing financial records.

### Dependencies

Make shared technical dependencies invisible where appropriate.

Do not require customers to activate unrelated paid products.

### Backend enforcement

Check active entitlements before protected product operations.

Do not rely only on sidebar visibility.

### Usage metering

Reuse the existing usage-metering architecture.

Count only the defined billable operations.

Prevent duplicate billable events during retries.

Do not activate real customer charges during this milestone.

---

# 19. BUSINESS AND PERSONAL WORKSPACES

All applicable modules must work correctly in both account types.

### Business

Full supported financial capabilities.

### Personal

Simplified relevant capabilities such as:

- Clients.
- Invoices.
- Income.
- Expenses.
- Cash Flow.
- Financial Reports.

Do not force a Personal account into business-only merchant onboarding.

Preserve appropriate financial privacy.

### Developer

Expose eligible financial APIs and test operations through the Developer Console.

Do not force a developer to create an unrelated Business workspace unless the specific merchant operation genuinely requires a merchant organization.

---

# 20. USER EXPERIENCE REQUIREMENTS

Preserve the compact visual system completed in Milestone 1.

### Design principles

- Consistent button styling.
- Slightly rounded controls.
- Clear page hierarchy.
- Fast internal navigation.
- Compact forms.
- Appropriate loading states.
- Responsive tables.
- Clean empty states.
- Useful confirmations.
- No repeated generic text.
- No giant technical banners.

### Financial workflows

Use clear step-by-step interactions for complex processes.

Example:

Create Invoice → Review → Issue → Share → Track Payments.

Do not make users manually move between six unrelated pages to finish one ordinary task.

Use contextual actions and appropriate deep links.

### Mobile

Test on iPhone-sized viewports.

Ensure all financial tables have usable compact presentations.

---

# 21. PUBLIC PRODUCT EXPLANATIONS

Update the corresponding public product pages to describe the verified features accurately.

Focus on:

- AfriCore Pay.
- Invoicing.
- Reconciliation.
- Expenses.
- Cash Flow.
- Orders and Customer Management.

Every product page must answer:

1. What does it do?
2. Who needs it?
3. How does it work?
4. How do I start?
5. What information is required?
6. What happens after using it?
7. What can it connect to?
8. Which capabilities are currently available?
9. What requires an external payment provider?
10. How is usage measured?

Use different, relatable examples for different products.

Do not claim that a test adapter is a live payment integration.

Do not redesign the entire public website.

Preserve AfriCore's existing visual language.

---

# 22. API DESIGN

Inspect and improve the existing financial APIs.

Support documented versioned APIs for applicable operations:

- Customers.
- Orders.
- Invoices.
- Payment requests.
- Payment status.
- Reconciliation.
- Expenses.
- Obligations.
- Cash Flow.
- Reports.

### Requirements

- Clear request validation.
- Consistent errors.
- Pagination.
- Filters.
- Proper HTTP semantics.
- Idempotency where necessary.
- Authentication.
- Authorization.
- Workspace scoping.
- Rate limiting.
- Request identifiers.
- Audit records.

Use OpenAPI or compatible existing API documentation.

Do not make unnecessary breaking API changes.

---

# 23. SECURITY REQUIREMENTS

Preserve all security remediations from the prior review.

Specifically enforce:

- JWT/session validation.
- Backend authorization.
- Tenant isolation.
- Capability permissions.
- Service entitlements.
- Payment idempotency.
- Authenticated payment-event processing.
- Secure provider credentials.
- Audit logging.
- Sensitive-data redaction.
- Appropriate webhook egress restrictions.
- Encryption where necessary.
- Safe file storage.
- Approval controls for consequential operations.

Do not expose internal administrative payment APIs to normal developer accounts.

Do not place provider credentials or payment tokens in client-side code.

---

# 24. REAL-MONEY AND REGULATORY BOUNDARY

AfriCore Pay must be built as a capable payment-software system, but live fund movement has additional requirements.

Current relevant authorities include:

- Safaricom Daraja for applicable M-Pesa APIs.
- Central Bank of Kenya for payment-services regulation.
- Licensed payment providers or partners as appropriate.

References:

https://daraja.safaricom.co.ke/apis

https://www.centralbank.go.ke/national-payments-system/

Review the applicable current legal framework and partnership model.

The 2026 National Payment System Bill is a draft unless officially enacted; do not treat it as operative law without verification.

### Do not activate

- Independent fund custody.
- Escrow.
- Unauthorized payment aggregation.
- Lending.
- Cross-border remittances.
- Real payouts without provider authorization.
- Production card processing without compliant provider infrastructure.

### Do implement

- Accurate payment software.
- Secure checkout.
- Provider adapter architecture.
- Merchant records.
- Transaction lifecycle.
- Reconciliation.
- Reporting.
- Test-mode integration.
- Live-provider readiness checklist.

Report the exact prerequisites before enabling real payment collection.

---

# 25. END-TO-END FINANCIAL SCENARIO

Build a repeatable automated integration scenario.

### Scenario: Contractor invoice

1. Create a Business workspace.
2. Activate Customers and Invoicing.
3. Add a customer.
4. Create an order or contract reference.
5. Create an invoice for KSh 50,000.
6. Issue the invoice.
7. Create a payment request using an authorized test provider.
8. Simulate a KSh 30,000 payment.
9. Validate test-provider confirmation.
10. Reconcile payment.
11. Allocate the payment.
12. Confirm KSh 20,000 remains outstanding.
13. Verify customer history.
14. Verify receivables aging.
15. Verify Cash Flow reflects the confirmed test inflow in the isolated test workspace.
16. Record a KSh 5,000 expense.
17. Verify expense reporting.
18. Confirm net recorded movement reflects applicable entries without claiming to be a bank balance.
19. Simulate the final KSh 20,000 payment.
20. Confirm invoice becomes paid.
21. Repeat a callback.
22. Confirm no duplicate allocation.
23. Test a reversal.
24. Confirm balances and financial history update correctly.
25. Verify tenant isolation and usage-metering correctness.

No real funds should move during this automated test.

---

# 26. REQUIRED ADDITIONAL TESTS

Create and execute tests for:

### Invoicing

- Valid invoice.
- Invalid amount.
- Partial payment.
- Full payment.
- Overdue balance.
- Credit note.
- Voided invoice.

### Payments

- Request creation.
- Invalid merchant.
- Expired link.
- Successful test payment.
- Failed payment.
- Duplicate callback.
- Delayed callback.
- Retry.
- Reversal.
- Refund where supported.

### Reconciliation

- Exact match.
- Partial match.
- Ambiguous match.
- Unmatched payment.
- Duplicate event.
- High-volume matching.
- Concurrent matching.

### Expenses

- Create.
- Edit.
- Archive.
- Duplicate prevention.
- Category totals.

### Cash Flow

- Date filters.
- Currency handling.
- Empty records.
- Partial payments.
- Reversals.
- Upcoming obligations.
- Correct source classification.

### Security

- Cross-tenant access.
- Revoked permissions.
- Disabled entitlements.
- Unauthorized provider configuration.
- Forged callbacks.
- Webhook replay.
- Invalid API keys.

Run appropriate unit, integration and end-to-end tests.

Do not invent successful test results.

---

# 27. PERFORMANCE

Measure:

- Invoice creation latency.
- Payment request creation.
- Payment confirmation processing.
- Reconciliation runtime.
- Cash Flow query latency.
- Dashboard loading.
- API response latency.

Avoid unnecessary blocking calls.

Use appropriate database indexes.

Batch requests where sensible.

Use durable background processing for expensive or asynchronous operations.

Do not sacrifice financial consistency for a visually faster response.

---

# 28. DEPLOYMENT

Use the existing AfriCore infrastructure.

Preserve:

- Cloudflare.
- Existing backend host.
- Neon PostgreSQL.
- Existing authentication.
- Service marketplace.
- Registered users.
- Workspaces.
- Financial records.

### Deployment procedure

1. Create a safe implementation branch.
2. Establish baseline tests.
3. Implement logically grouped changes.
4. Run migrations safely.
5. Test against an isolated database environment.
6. Run end-to-end tests.
7. Verify financial correctness.
8. Verify security.
9. Build frontend/backend.
10. Deploy to staging or preview where available.
11. Test actual HTTPS workflows.
12. Deploy authorized changes to the existing environment.
13. Verify existing users can still log in.
14. Verify normal Business, Personal and Developer routes.
15. Document rollback.

Do not automatically activate live payment collection.

---

# 29. DOCUMENTATION

Update existing documentation or create suitable files for:

- Financial domain architecture.
- Customer and Order model.
- Invoicing.
- Receivables.
- AfriCore Pay.
- Payment providers.
- Daraja integration.
- Payment state machine.
- Reconciliation.
- Expenses.
- Recurring Obligations.
- Cash Flow.
- Financial event processing.
- Financial API contracts.
- Service entitlements.
- Usage metering.
- Security.
- Test scenarios.
- Deployment readiness.

Update `AGENTS.md` so subsequent development preserves financial invariants and domain boundaries.

Avoid duplicate or scattered documentation.

---

# 30. COMPLETION AND READINESS LEVELS

Report each product using a consistent readiness classification.

### Implemented

The internal software workflow, API, database, authorization and required tests are operational.

### Integration-ready

The external provider adapter and contracts exist and are validated through an appropriate test environment, but live credentials or approvals are missing.

### Live-configured

The external provider has been configured and verified, with the necessary authority to use the capability.

### Blocked

The capability cannot operate because an essential dependency is unavailable.

Do not confuse these states.

Do not mark an entire financial product live-configured because its page renders.

---

# 31. ACCEPTANCE CRITERIA

Milestone 2 is complete when:

- Customers work reliably.
- Orders work reliably.
- Invoicing works end-to-end.
- Partial payments update invoice balances correctly.
- Receivables and overdue calculations are accurate.
- AfriCore Pay has a functioning payment request and checkout software workflow.
- The authorized test payment adapter works.
- Payment callbacks are processed safely.
- Duplicate callbacks cannot duplicate payments.
- Reconciliation handles matching and exceptions.
- Expenses persist and appear in reports.
- Recurring obligations work.
- Cash Flow uses accurate records.
- Financial charts show correct data.
- Personal and Business use cases are supported appropriately.
- Developer APIs remain secure.
- Service activation and deactivation are enforced.
- Usage metering is accurate.
- Mobile screens remain compact and usable.
- Existing accounts remain intact.
- Previous security fixes remain effective.
- Financial data is preserved.
- Cloudflare and backend deployment remain operational.
- Tests and actual results are documented.
- Any provider-dependent unfinished capabilities are clearly identified.

---

# 32. REQUIRED FINAL REPORT

When implementation finishes, provide:

## Architecture

- Changes to the financial domain.
- Shared data model.
- Database migrations.
- API changes.
- Provider adapters.

## Products

For each product, report:

- Existing functionality retained.
- New functionality implemented.
- Backend routes.
- Database integration.
- UI improvements.
- Tests.
- Remaining limitations.

## AfriCore Pay

Report:

- Payment lifecycle.
- Checkout.
- Payment links.
- Daraja adapter.
- Webhooks.
- Provider verification.
- Merchant configuration.
- Test-mode results.
- Live readiness.

## Financial Integrity

Report:

- Invoice balances.
- Reconciliation correctness.
- Idempotency.
- Expense handling.
- Cash Flow consistency.
- Reversal handling.

## QA

- Test commands.
- Pass/fail results.
- Performance measurements.
- Security checks.
- End-to-end workflow results.

## Deployment

- Actual deployed status.
- Verified environment.
- Migration status.
- Outstanding credentials.
- Required founder actions.

Do not fabricate deployment success or missing test results.

---

# FINAL DIRECTIVE

Milestone 1 is completed.

Your next responsibility is the financial foundation of AfriCore.

Build a coherent, reliable system connecting:

**Customers → Orders → Invoices → Payment Requests → Provider Confirmation → Reconciliation → Cash Flow and Reporting.**

Keep Expenses and Recurring Obligations accurately integrated into the financial reporting model.

Make AfriCore Pay a serious, extensible payment orchestration and merchant integration product.

Use official provider contracts.

Preserve independent service activation.

Maintain strong financial accuracy, security and tenant isolation.

Preserve all existing users, records, application design and infrastructure.

Do not enable unsupported real-money operations.

Do not start Milestone 3 until Milestone 2 has been verified and reviewed.

**Inspect the current repository, implement the missing financial functionality, fix defects, validate end-to-end workflows, safely deploy the completed milestone, and provide a complete engineering report.**