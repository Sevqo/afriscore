# AFRICORE — COMPLETE PRODUCT ENGINEERING EXPANSION, SERVICE MARKETPLACE, ACCOUNT SECURITY & UX REFINEMENT

## MASTER IMPLEMENTATION SPECIFICATION FOR CODEX

### MISSION

You are continuing development of the existing AfriCore platform.

Act as the principal fintech software architect, senior full-stack engineer, payment infrastructure engineer, database architect, cybersecurity engineer, product designer, technical documentation specialist, financial systems engineer, blockchain engineer, and QA lead.

AfriCore is designed to help African individuals, SMEs, merchants, contractors, suppliers, and developers operate their businesses more efficiently.

The existing application already includes substantial functionality and is deployed through Cloudflare with Neon PostgreSQL, managed authentication, and backend services.

The founder has reviewed the live application and wants to move beyond basic feature implementations.

**Your assignment is to mature every existing AfriCore product into a coherent, functional, documented and professionally engineered service while also correcting the specific UI and security problems identified in the screenshots.**

Do not build a new application.

Do not replace existing working modules unnecessarily.

Do not mistake incomplete mockups for production-ready software.

Preserve user accounts, legitimate business identities, authorization, database records, financial history, blockchain records and deployment configuration.

The business named **Continua** is a legitimate registered business workspace. Preserve it.

The screenshots also show a Personal workspace named **Cypskip**. Preserve user-selected workspace names.

---

# PART 1 — IMMEDIATE SCREENSHOT CORRECTIONS

## 1. FIX THE USAGE & BILLING MOBILE INTERFACE

The first screenshot shows a large usage table compressed into the width of an iPhone screen.

Columns include:

- Service.
- Usage.
- Allowance remaining.
- Estimated cost.

The narrow layout causes severe word wrapping.

For example, a service name such as "Customers & clients" breaks into multiple awkward lines.

Phrases such as "No finite allowance published" consume considerable space.

This is unacceptable.

### Required solution

Create two responsive presentations sharing the same authoritative data.

**Desktop**

Use an appropriate table:

Service | Usage | Allowance | Estimated Charges | Actions

**Mobile**

Render a vertically organized list of compact service-usage cards.

Suggested structure:

Service name

Usage: 0 records

Plan: Free Evaluation

Estimated charges: KSh 0.00

Optional: View details

Do not repeat long internal pricing identifiers in every row.

### Technical requirements

- Responsive layout based on available width.
- Clear labels.
- No horizontal clipping.
- No arbitrary word breaking.
- Consistent number formatting.
- Correct currency.
- Efficient rendering for long service lists.
- Sorting and filtering.
- Search.
- Service-category filtering.
- Correct empty state.
- Pagination or virtualization for large datasets.
- Accessible desktop table semantics.
- Accessible mobile card semantics.

Do not solve this by shrinking the table's font to an unreadable size.

### Allowances

Interpret pricing configuration correctly.

If the service is free without a finite configured allowance, do not repeatedly display the awkward phrase "No finite allowance published."

Use clear labels based on the actual entitlement policy.

Examples:

- Free.
- Included.
- 250 of 1,000 used.
- No usage limit configured.
- Metering not applicable.

Do not call a service Unlimited unless the product explicitly guarantees unlimited usage.

### Price versions

Technical identifiers such as `evaluation-v1` belong in detailed billing records or internal administration.

In ordinary customer-facing screens, display understandable plan names.

For example:

Free Evaluation.

If pricing is not yet commercially published, state that clearly.

Do not invent finalized customer prices.

---

## 2. REDESIGN MY SERVICES

The second screenshot shows an activated Invoicing service card containing too many actions:

- Details & setup.
- Open.
- Pin.
- Move earlier.
- Deactivate.

These compete visually.

The current service usage summary is also a long list of repeated sentences.

### Required design

Create a compact, professional service card.

Each card should contain:

- Service name.
- Short description.
- Actual availability status.
- Usage summary where relevant.
- Primary action.
- Secondary action.
- Overflow menu for less frequent actions.

### Primary action

**Open Service**

Use a proper AfriCore button.

Do not render it as a default blue browser link.

Use the same border radius and button styling as the other improved application controls.

### Secondary action

**Manage**

This opens the service configuration page.

### Overflow menu

Place less frequent actions inside a three-dot menu:

- View details.
- Pin or unpin.
- Move or reorder.
- Deactivate.

A destructive or consequential action such as deactivation must require appropriate confirmation.

### Layout

Use a responsive grid of service cards.

Mobile cards should fit naturally within the viewport.

Do not place five large buttons inside each card.

Use consistent component spacing.

---

## 3. REDESIGN THE CURRENT SERVICE USAGE SUMMARY

The screenshot shows an oversized panel containing repeated text such as:

"Customers & clients: 0 customer records · Ksh 0.00 estimated · free"

followed by similar paragraphs for every service.

This is visually inefficient.

### Replace it with

A compact overview containing:

- Current period.
- Total estimated charges.
- Number of active services.
- Overall usage summary.
- A link to detailed usage.

Below that, optionally display the three most recently used or most relevant services.

Do not duplicate the entire detailed Usage & Billing page inside My Services.

### Usage details

Provide a clear action:

**View Usage & Billing**

It must use the standard button system, not an unstyled blue hyperlink inside a gray box.

### Navigation consistency

Use the same typography, radius, colors, hover effects and interactive states as other AfriCore buttons.

Avoid arbitrary blue links when the established design system uses green and neutral colors.

Use conventional text links only where appropriate.

---

## 4. STANDARDIZE EVERY APPLICATION BUTTON

The founder likes the improved rounded corners of the current buttons.

Preserve that direction.

Apply the same component system everywhere.

### Standard button variants

- Primary.
- Secondary.
- Tertiary.
- Text.
- Destructive.
- Icon-only.

### Recommended corner geometry

Use a restrained iOS-inspired radius.

Suggested range:

8–12px for standard buttons and controls.

Adjust against actual component proportions.

Do not make every control a giant pill.

### Apply consistently to

- Open Service.
- Manage.
- View Usage.
- Usage History.
- Export.
- Save.
- Create.
- Activate.
- Deactivate.
- Security actions.
- Billing actions.
- Settings controls.
- Service Catalog.
- Developer Console.

Preserve clear focus, hover, active, disabled and loading states.

Keep mobile tap targets accessible.

Do not globally reduce touch targets to achieve visual compactness.

---

# PART 2 — COMPLETE ACCOUNT SECURITY EXPERIENCE

## 5. REDESIGN ACCOUNT SECURITY

The third screenshot shows the "Secure your account" section.

It displays active sessions, but each session card exposes a raw browser user-agent string.

This is difficult for ordinary users to understand.

The Account Security section must become a professional security center.

### Main security page

Create clearly separated sections:

1. Security Overview.
2. Password.
3. Two-Factor Authentication.
4. Passkeys, where supported.
5. Active Sessions.
6. Trusted Devices, where supported.
7. Account Recovery.
8. Security Notifications.
9. Recent Security Activity.
10. Account Protection Settings.

Do not show fake capabilities as active.

---

## 6. SECURITY OVERVIEW

Provide an accurate overview of the account's current protection state.

Examples:

- Email verified.
- Password configured.
- Two-factor authentication enabled or unavailable.
- Number of active sessions.
- Last successful sign-in, if available.
- Recovery methods configured.
- Recent security changes.

A summary might say:

"Your email is verified. Review your active sessions and strengthen your sign-in security."

Do not invent a percentage-based security score without a defensible methodology.

If some security capabilities are not supported yet, clearly distinguish them from enabled protections.

---

## 7. ACTIVE SESSIONS AND DEVICES

Replace raw user-agent strings with readable device cards.

Example:

**iPhone · Safari**

Current session

Last active: Today

Expires: [actual session expiry]

Revoke session

### Device identification

Parse user-agent information using a maintained library where useful.

Display only information that can be reasonably inferred.

Do not invent exact device models or operating-system versions.

If an exact device name cannot be established, use a sensible general description.

### Session actions

Implement:

- View active sessions.
- Identify current session.
- Revoke another session.
- Revoke all other sessions.
- Sign out everywhere.
- Display actual expiration.
- Show reliable last activity where available.

Protect session-management actions with server-side authorization and appropriate reauthentication.

### Important

Review Neon Managed Better Auth's supported session-management capabilities.

If the managed authentication API does not expose a required session operation, do not implement a fake local-only revoke action.

Use an officially supported server-side revocation mechanism or document the capability as unavailable.

### Additional improvements

- Compact session cards.
- Clear device icons.
- No raw HTTP header dumps.
- Safe truncation.
- No misleading location guesses.
- Confirmation for mass session revocation.
- Audit logs for security-sensitive changes.

---

## 8. IMPLEMENT ACCOUNT TWO-FACTOR AUTHENTICATION CORRECTLY

The founder wants complete two-factor authentication.

Research current official Neon Managed Better Auth capabilities before implementation.

### Important platform constraint

As of the current Neon documentation, MFA support is listed as upcoming for Neon Managed Better Auth.

Standard self-managed Better Auth supports a Two-Factor Authentication plugin with functionality such as TOTP and backup codes, but managed Neon authentication does not automatically support arbitrary Better Auth plugins.

Official references:

https://neon.com/docs/auth/roadmap

https://neon.com/docs/auth/guides/plugins

https://www.better-auth.com/docs/plugins/2fa

Do not claim that installing the standard Better Auth two-factor plugin automatically enables MFA in the managed Neon authentication service.

### Required engineering work

Evaluate two secure approaches:

**Approach A — Retain Neon Managed Better Auth**

Implement every supported security capability now.

Build a clean authentication security architecture with clearly defined MFA integration boundaries.

Do not display MFA as enabled until actual server-side verification is enforced.

**Approach B — Migrate to a supported authentication architecture**

Evaluate self-managed Better Auth or another suitable established identity provider supporting the required features.

If this is selected, create a migration plan that preserves:

- Existing users.
- Existing valid credentials where migration is supported.
- Session security.
- Workspace memberships.
- Organization ownership.
- Email verification.
- API authentication.
- Neon database integration.
- Cloudflare deployment compatibility.
- Password reset.
- Account recovery.

Do not execute a high-risk authentication migration without explicit authorization and validated rollback procedures.

### Mandatory principle

A UI switch is not two-factor authentication.

A real implementation must enforce the second factor on the server before establishing a fully authenticated session.

---

## 9. TOTP AUTHENTICATOR APP

When supported through the chosen authoritative authentication architecture, implement TOTP authentication.

Supported user experience:

1. Open Security.
2. Choose Enable Two-Factor Authentication.
3. Reauthenticate.
4. Generate an enrollment secret securely.
5. Display authenticator QR code.
6. Support manual setup key entry.
7. User enters the generated verification code.
8. Server verifies the code.
9. Activate the second factor.
10. Generate recovery codes.
11. Confirm successful setup.

Support authenticator applications using the standard TOTP protocol.

### Security

- Secure random secret generation.
- Encrypted secret storage where applicable.
- Short validity window.
- Rate limiting.
- Replay protection.
- Trusted enrollment confirmation.
- Safe disabling.
- Recovery procedures.
- Security event logging.

Do not activate MFA before successful enrollment confirmation.

---

## 10. RECOVERY CODES

When genuine MFA is implemented, support backup/recovery codes.

Requirements:

- Cryptographically secure generation.
- Single use.
- Secure hashing or equivalent safe verification storage.
- One-time display.
- Download/copy controls.
- Regeneration after strong reauthentication.
- Previous-code invalidation.
- Recovery attempts logged.
- Rate limiting.

Never show existing secret recovery codes repeatedly after initial issuance.

---

## 11. PASSKEYS AND WEBAUTHN

Research supported WebAuthn/passkey integrations.

If supported by the chosen identity architecture, implement:

- Register Passkey.
- View Registered Passkeys.
- Rename Passkey.
- Remove Passkey.
- Authenticate with Passkey.
- Secure recovery.
- Additional authenticator enrollment.

Do not attempt to hand-roll WebAuthn cryptography.

Use established server-side verification libraries.

If the current managed Neon service lacks support, document the limitation and implement only an integration-ready structure until a supported authentication system is selected.

Do not present a decorative Passkey button that performs no secure authentication.

---

## 12. ADDITIONAL SECURITY CONTROLS

Implement or refine:

### Password management

- Change password.
- Require current credentials where appropriate.
- Confirm new password.
- Password visibility toggle.
- Strength/requirements guidance.
- Safe session revocation after password changes.
- Password reset.

### Email management

- Verified email display.
- Request email change.
- Verify new email.
- Prevent unverified account takeover.
- Notifications for sensitive changes.

### Security notifications

- Password changed.
- Email changed.
- MFA enabled or disabled.
- New authenticator registered.
- Recovery method changed.
- Session revoked.
- Suspicious sign-in where detection is reliable.

### Audit history

Display meaningful events without exposing secrets.

### Privileged operations

Require reauthentication or stronger assurance for:

- API key management.
- Financial approvals.
- Credential signing.
- Business ownership transfers.
- Sensitive organization settings.
- Internal administrative access.

Do not expose raw authentication tokens or private keys.

---

# PART 3 — FULL AFRICORE PRODUCT ARCHITECTURE

## 13. PRODUCT INVENTORY AND DOMAIN OWNERSHIP

The founder wants each AfriCore product to be fully researched, technically developed, functional and clearly explained on the public website.

Before implementation, inspect every product.

Create a comprehensive inventory containing:

- Product name.
- Business purpose.
- Existing code.
- Existing database entities.
- API routes.
- UI pages.
- Dependencies.
- External integrations.
- Supported account types.
- Current implementation status.
- Known defects.
- Security requirements.
- Usage-metering rules.
- Required tests.
- Public documentation.
- Developer documentation where relevant.

Do not claim a product is complete merely because a dashboard or marketing page exists.

Separate:

- Fully functional internal software.
- Configured and verified external integrations.
- Simulated external integrations.
- Awaiting provider credentials.
- Awaiting authorization or licensing.
- Not yet implemented.

Create a product status matrix.

---

# 14. CORE SHARED BUSINESS DATA MODEL

Design the shared foundation carefully.

Relevant canonical entities may include:

- User.
- Workspace.
- Organization.
- Membership.
- Customer.
- Supplier.
- Contact.
- Product or service item.
- Order.
- Invoice.
- Invoice line.
- Payment request.
- Provider payment event.
- Payment allocation.
- Refund or reversal.
- Expense.
- Recurring obligation.
- Financial account/source.
- Data connection.
- Business credential.
- Verification evidence.
- Workflow.
- Usage event.
- Audit event.

All products should reuse appropriate shared entities.

Do not create unrelated duplicates of customer, invoice or payment records inside every service.

Preserve tenant boundaries.

Use database transactions, constraints and idempotency.

Maintain domain-specific APIs even where the data model is shared.

---

# PART 4 — INDIVIDUAL PRODUCT SPECIFICATIONS

# 15. PRODUCT: CUSTOMERS & CLIENTS

### Purpose

Help businesses and independent professionals organize the people and organizations they serve.

### User experience

A merchant should be able to add a customer, view their orders, review invoices, identify outstanding amounts, and contact them using supported communication channels.

### Required functionality

- Create customer.
- Edit customer.
- Archive customer.
- Customer search.
- Contact details.
- Customer type.
- Customer notes.
- Customer activity history.
- Linked orders.
- Linked invoices.
- Linked payment records.
- Outstanding balance.
- Tags or categories.
- CSV import/export.
- Duplicate detection.
- Appropriate privacy controls.

### Backend

Use canonical customer records with workspace-scoped ownership.

Support pagination, filtering and audit history.

### Website explanation

Explain how this replaces scattered customer details across notebooks, spreadsheets and messaging threads.

Include a walkthrough showing a customer progressing from first order to payment.

### Testing

Create customer → create order → create invoice → reconcile payment → view updated customer history.

---

# 16. PRODUCT: ORDERS

### Purpose

Track what customers purchase and the fulfillment of those purchases.

### Required functionality

- Create order.
- Add products or services.
- Customer association.
- Order reference.
- Quantity.
- Unit price.
- Discount.
- Tax where configured.
- Order total.
- Status transitions.
- Payment association.
- Fulfillment status.
- Cancellation.
- Refund references.
- Activity timeline.

### Suggested status model

- Draft.
- Confirmed.
- Awaiting payment.
- Partially paid.
- Paid.
- In fulfillment.
- Fulfilled.
- Cancelled.

Avoid treating fulfillment status and payment status as one field.

### Backend

State transitions must be validated.

Prevent invalid or unauthorized transitions.

### Website explanation

Use a real business scenario involving an online shop receiving and fulfilling an order.

---

# 17. PRODUCT: INVOICING & RECEIVABLES

### Purpose

Let businesses request payment and track amounts owed.

### Required functionality

- Draft invoices.
- Line items.
- Customer association.
- Currency.
- Taxes and discounts.
- Issue date.
- Due date.
- PDF generation.
- Secure sharing.
- Invoice history.
- Partial payments.
- Payment allocation.
- Outstanding balance.
- Credit notes.
- Reminders.
- Overdue tracking.
- Invoice exports.
- Audit history.

### Invoice states

- Draft.
- Issued.
- Partially paid.
- Paid.
- Overdue, derived where appropriate.
- Voided.
- Credited.

### Financial correctness

Use appropriate decimal or minor-unit arithmetic.

Prevent negative outstanding balances unless explicitly supported by credit accounting.

Preserve authoritative payment evidence.

### Website explanation

Use a relatable example:

A contractor sends an invoice for KSh 50,000.

The client pays KSh 30,000.

AfriCore shows KSh 20,000 remaining.

Show the actual workflow visually.

### Metering

Use issued invoices or another clearly defined billable unit.

Do not count draft saves or page views as issued invoices.

---

# 18. PRODUCT: AFRICORE PAY

## PRODUCT VISION

AfriCore Pay should become the payment-software infrastructure connecting merchant businesses, checkout experiences, payment-provider integrations and financial records.

Use Stripe as a reference for:

- Payment lifecycle architecture.
- Checkout.
- Payment links.
- Webhooks.
- Merchant integration.
- API design.
- Idempotency.
- Reconciliation.
- Provider abstraction.

Official references:

https://docs.stripe.com/payments/payment-intents

https://docs.stripe.com/connect

https://docs.stripe.com/payments/checkout

Use Safaricom Daraja as an authoritative source for applicable M-Pesa integrations:

https://developer.safaricom.co.ke/

AfriCore Pay must be designed for African commerce and supported local payment methods.

Do not copy Stripe's branding or proprietary code.

## 18.1 Merchant onboarding

Allow authorized businesses to configure payment collection.

Collect only necessary information.

Support:

- Business identity.
- Payment-provider choice.
- Provider account status.
- Required verification.
- Merchant permissions.
- Payment configuration.
- Settlement configuration where provider-supported.
- Payment-method availability.

Do not imply a business is legally approved for live payment processing merely because it created an AfriCore account.

## 18.2 Payment links

Build:

- Create payment link.
- Link to invoice/order where appropriate.
- Amount.
- Currency.
- Customer reference.
- Expiration.
- Secure sharing.
- Payment status.
- Cancellation/expiration.
- Receipt after confirmed payment.

Use opaque, secure identifiers.

Do not put reusable authentication secrets in exposed query strings.

## 18.3 Hosted checkout

Create an AfriCore-hosted checkout experience.

Support:

- Merchant identity.
- Order or invoice summary.
- Amount.
- Currency.
- Supported payment options.
- Payment status.
- Confirmation.
- Error handling.
- Expiration.
- Retry or recovery where appropriate.

Keep checkout minimal and mobile-friendly.

Do not collect raw card data directly unless using an appropriately compliant hosted or tokenized provider solution.

## 18.4 M-Pesa integration

Create a provider adapter around supported Daraja APIs.

Potential capabilities:

- STK Push.
- C2B confirmation.
- Transaction status inquiry.
- Reversal where supported.
- B2C payouts only when the merchant account and API permissions support them.

Implement only supported and authorized provider methods.

Use actual documented endpoints and payloads.

Do not assume an acknowledgment means payment success.

Wait for authoritative confirmation.

## 18.5 Payment lifecycle

Implement an explicit state machine.

Possible states:

- Created.
- Pending.
- Requires customer action.
- Processing.
- Succeeded.
- Failed.
- Cancelled.
- Refunded.
- Partially refunded.
- Reversed.
- Expired.

Adapt transitions to the relevant provider.

Use verified provider events and status queries.

## 18.6 Provider adapters

Create interfaces for payment providers.

A provider adapter should support available operations such as:

- Create payment request.
- Verify callback.
- Retrieve status.
- Request refund.
- Reconcile records.
- Inspect capabilities.

Do not require every provider to support every operation.

Expose capability metadata.

## 18.7 Payment webhooks

Implement:

- Authenticating provider events.
- Signature verification where available.
- Replay prevention.
- Idempotent processing.
- Event persistence.
- Retry handling.
- Auditing.
- Durable asynchronous dispatch.

Customer-side success screens must not be treated as proof of payment.

## 18.8 Settlement and reporting

Distinguish:

- Payment initiated.
- Payment confirmed.
- Provider fees.
- Settlement pending.
- Settlement completed.
- Reversal.
- Refund.

Do not confuse money received by a provider with money settled to a merchant.

Do not invent merchant balances.

## 18.9 Developer API

Where implemented, support:

- Payment request creation.
- Payment status lookup.
- Webhook registration.
- Merchant configuration.
- Supported refunds/reversals.
- Idempotency keys.
- Request logs.
- Scoped credentials.

Provide versioned API contracts and examples.

## 18.10 Financial and regulatory boundary

AfriCore Pay is initially a software and integration platform.

Do not enable independent custody, clearing, settlement, money transmission or unauthorized payment aggregation.

Determine whether an operation requires a licensed provider or regulatory approval.

The Central Bank of Kenya National Payment System framework governs relevant payment service activity.

Where external provider credentials, contracts or approvals are missing, implement the complete supported internal software workflow and an isolated test adapter.

Clearly identify what cannot operate live.

Do not claim full Stripe-equivalent production payment processing without the required operational infrastructure.

## 18.11 Public website

Create an in-depth AfriCore Pay page.

Explain:

- What AfriCore Pay is.
- Who uses it.
- Payment links.
- Checkout.
- M-Pesa integration.
- Transaction confirmation.
- Payment tracking.
- Reconciliation.
- Developer APIs.
- Availability.
- Pricing model.
- Security.

Include an illustrated step-by-step merchant journey and an interactive checkout demonstration using explicitly synthetic transactions.

The public website must distinguish available capabilities from upcoming or partner-dependent ones.

---

# 19. PRODUCT: PAYMENT RECONCILIATION

### Purpose

Match confirmed incoming payments to the correct customer invoices or orders.

### Workflow

1. Retrieve verified payment evidence.
2. Normalize provider data.
3. Locate candidate invoices.
4. Match using legitimate references and amounts.
5. Apply valid allocations.
6. Identify exceptions.
7. Update invoice status.
8. Record audit history.

### Features

- Automatic matching.
- Manual reconciliation.
- Partial payments.
- Overpayments.
- Unmatched payments.
- Duplicate prevention.
- Exception queue.
- Reconciliation history.
- Supporting evidence.
- Reports.

### Financial integrity

Separate transaction occurrence time from reconciliation time.

Avoid expensive unbounded matching.

Use bounded algorithms and appropriate background jobs.

### Website explanation

Use a clear example of multiple M-Pesa payments arriving and AfriCore matching each to the correct order.

Explain how this differs from payment collection.

### Metering

Count a clearly defined successful reconciliation event or eligible transaction, avoiding duplicate charges.

---

# 20. PRODUCT: CASH FLOW & FINANCIAL REPORTING

### Purpose

Help businesses understand recorded inflows, expenses and upcoming obligations.

### Required functionality

- Income summaries.
- Expense summaries.
- Cash-flow trends.
- Historical activity.
- Upcoming obligations.
- Receivables aging.
- Date filtering.
- Currency.
- Category analysis.
- Exports.
- Financial trend charts.
- Source coverage.
- Data quality.

### Calculations

Distinguish:

- Revenue.
- Confirmed collections.
- Recorded expenses.
- Net recorded movement.
- Profit.
- Cash balance.
- Forecasted cash flow.

Do not present incomplete transaction coverage as a complete bank statement.

### Charts

Use the existing improved interactive financial chart system.

Support date ranges and touch inspection.

### Website explanation

Show how a small business owner can review incoming payments, expenses and bills due next week.

Explain the difference between revenue, profit and cash flow in plain language.

---

# 21. PRODUCT: EXPENSES & RECURRING OBLIGATIONS

### Purpose

Record business spending and plan upcoming commitments.

### Required functionality

- Create expense.
- Categorize expense.
- Attach supporting document.
- Edit or archive.
- Link to supplier.
- Link to obligation.
- Expense history.
- Recurrence rules.
- Upcoming payment schedule.
- Reminder states.
- Overdue obligations.
- Reporting integration.

### Backend

Prevent duplicate recurring generation.

Handle timezones correctly.

Ensure scheduled jobs operate independently of the user's browser.

### Website explanation

Explain using rent, supplier bills, stock purchases and monthly operating costs.

---

# 22. PRODUCT: FINANCIAL INTELLIGENCE

### Purpose

Convert reliable financial records into business insights.

### Features

- Revenue trends where available.
- Expense trends.
- Receivables analysis.
- Payment behavior.
- Cash-flow forecasts.
- Scenario planning.
- Customer concentration.
- Financial alerts.
- Data completeness.
- Evidence confidence.
- Exportable insights.

### Forecasting

Use transparent and explainable methods.

Distinguish actual values from forecasts.

Do not claim high confidence without sufficient history.

Do not use raw self-uploaded inflows as verified revenue without appropriate classification.

### Website explanation

Show how intelligence helps a business notice late payments, rising expenses or potential future cash shortages.

Use a different educational presentation from the Invoicing page.

---

# 23. PRODUCT: AI BUSINESS ASSISTANT

### Purpose

Help users understand their business records and navigate AfriCore.

### Features

- Natural-language questions.
- Financial explanations.
- Source-backed answers.
- Report summaries.
- Invoicing guidance.
- Cash-flow explanations.
- Supported workflow suggestions.
- Permission-aware retrieval.
- Clear uncertainty handling.

### Architecture

The AI model should not independently invent financial calculations.

Use deterministic business services for authoritative values.

Use explicit permissions for any actions.

Sensitive operations require confirmation and appropriate authorization.

### Security

- Data minimization.
- Consent.
- Prompt-injection defenses.
- Organization isolation.
- Usage quotas.
- Provider cost limits.
- Model versioning.
- Error handling.

### Website explanation

Show realistic examples of questions a business owner can ask.

Explain clearly what the assistant can and cannot access.

### Metering

Use documented AI credits or verified model usage.

Do not bill arbitrary estimated tokens as authoritative usage without a defined policy.

---

# 24. PRODUCT: AUTOMATIONS

### Purpose

Automate repetitive business workflows.

### Architecture

Trigger → Conditions → Actions.

### Example

An invoice becomes overdue.

AfriCore checks whether payment has been recorded.

If unpaid, it sends an authorized reminder.

### Features

- Workflow creation.
- Triggers.
- Conditions.
- Actions.
- Delays.
- Scheduling.
- Execution logs.
- Retry handling.
- Pause/resume.
- Approval steps.
- Error notifications.
- Workflow versioning.

### Security

Enforce permissions on every action.

Avoid duplicate execution.

Protect against looping workflows.

Do not allow unrestricted access to external systems.

### Website explanation

Use a visual workflow showing what happens automatically.

Explain the time saved and the actions the user still controls.

### Metering

Use defined successful executions, step usage or another transparent unit.

---

# 25. PRODUCT: AFRICORE CONNECT

### Purpose

Connect supported external business systems and providers.

### Possible integrations

- Payment providers.
- Accounting platforms.
- E-commerce systems.
- Business management platforms.
- Authorized data sources.
- Communication platforms.

### Features

- Connector catalog.
- Connection setup.
- Credential management.
- Permission consent.
- Connection status.
- Synchronization schedule.
- Import/export.
- Error handling.
- Revocation.
- Activity logs.

### Security

- Secure secrets.
- Scoped credentials.
- Token rotation.
- Consent records.
- Provider rate limits.
- Retry and backoff.
- No credential exposure to frontend code.

### Website explanation

Demonstrate how connecting a payment source and an accounting application eliminates repetitive manual work.

Do not show unavailable providers as already connected.

---

# 26. PRODUCT: AFRICORE DATA

### Purpose

Turn data from authorized sources into consistent, structured business information.

### Architecture

Connectors → Ingestion → Validation → Normalization → Canonical Business Model → Intelligence / APIs.

### Core objects

- Customers.
- Suppliers.
- Accounts.
- Transactions.
- Payments.
- Revenue and expenses.
- Invoices.
- Inventory where supported.
- Business metrics.
- Verification evidence.

### Features

- Schema validation.
- Duplicate detection.
- Source attribution.
- Data quality checks.
- Data mapping.
- Versioned schemas.
- Synchronization history.
- Consent enforcement.
- Export.
- Access control.

### Website explanation

Use an understandable before-and-after example:

A business has information in several systems.

AfriCore connects the permitted sources and organizes them into one reliable business view.

Avoid making claims that AfriCore automatically has access to banking or tax data without the required agreements and permissions.

---

# 27. PRODUCT: COMMERCE CHECKOUT

### Purpose

Help merchants convert orders received through social channels into structured checkout and payment requests.

### Workflow

1. Merchant creates an order or checkout link.
2. Customer opens the link.
3. Customer reviews order.
4. Customer selects an available payment method.
5. Provider processes payment.
6. AfriCore records verified status.
7. Merchant sees the order updated.

### Features

- Order checkout.
- Shareable links.
- Product descriptions.
- Amount.
- Customer information.
- Payment method selection.
- Checkout expiration.
- Payment status.
- Order tracking.
- Receipt.
- Delivery status where available.

### Website explanation

Use a WhatsApp seller example.

Show how a conversation becomes a properly recorded order.

### Safety

Do not imply that a screenshot of a payment confirmation proves payment.

Use provider confirmation.

---

# 28. PRODUCT: FULFILLMENT & DELIVERY TRACKING

### Purpose

Help merchants coordinate fulfillment after receiving orders.

### Features

- Fulfillment records.
- Status changes.
- Courier reference.
- Dispatch date.
- Delivery status.
- Proof of delivery.
- Customer notifications.
- Exceptions.
- Returns.
- Evidence attachments.

### Backend

Support provider adapters where genuine courier integrations exist.

Do not invent real-time GPS tracking without an actual data source.

### Website explanation

Use a sequence from order acceptance to customer delivery.

---

# 29. PRODUCT: PROTECTED PAYMENTS

### Purpose

Provide a trusted transaction workflow for buyers and sellers.

### Concept

Buyer and seller agree on transaction terms.

An approved payment partner processes or safeguards funds as required.

Delivery evidence and dispute conditions determine whether a partner-supported release or refund may proceed.

### Required application functionality

- Transaction terms.
- Buyer/seller identity.
- Amount.
- Agreement confirmation.
- Delivery evidence.
- Buyer acceptance.
- Disputes.
- Review workflow.
- Partner payment state.
- Release eligibility.
- Refund eligibility.
- Audit trail.

### Critical restriction

AfriCore must not claim to hold funds in escrow unless it actually has the appropriate authorized custody arrangement.

Do not implement self-custody of real funds without the necessary operational and regulatory prerequisites.

Build the software workflow fully, with a partner adapter and isolated simulated transactions for testing.

### Website explanation

Explain the buyer/seller protection concept with clear diagrams.

Distinguish operational software from available live financial custody.

---

# 30. PRODUCT: BUSINESS VERIFICATION

### Purpose

Review and substantiate business identity claims.

### Features

- Business profile.
- Registration evidence.
- Verification requests.
- Document submission.
- Verification status.
- Reviewer workflow.
- Evidence provenance.
- Expiration.
- Reverification.
- Rejection reasons.
- Appeal/correction.
- Audit history.

### Important

A business's self-entered details are not automatically verified.

Do not issue a verified badge without sufficient evidence.

### Website explanation

Show how verification helps customers or business partners establish confidence in a company's identity.

---

# 31. PRODUCT: BUSINESS PASSPORT

### Purpose

Provide a reusable business identity and credential-sharing profile.

### Features

- Business identity profile.
- Verified attributes.
- Credential wallet.
- Issuer details.
- Credential status.
- Selected sharing.
- Expiration.
- Permission grants.
- Verification history.
- Privacy controls.

### Example

A supplier needs to demonstrate its registration status to a buyer.

Rather than repeatedly uploading documents, it shares an authorized credential with the buyer.

### Security

Selective sharing must be enforced.

Business Passport must not disclose all internal business data publicly.

### Website explanation

Use an illustrated supplier-to-buyer journey.

Explain the difference between a business profile and verified credentials.

---

# 32. PRODUCT: VERIFIABLE CREDENTIALS

### Purpose

Allow trustworthy issuers to make tamper-evident claims that authorized verifiers can check.

### Standards

Use appropriate W3C Verifiable Credentials Data Model 2.0 concepts.

Reference:

https://www.w3.org/TR/vc-data-model-2.0/

### Features

- Issuer registration.
- Issuer authorization.
- Credential creation.
- Cryptographic signing.
- Credential status.
- Expiration.
- Revocation.
- Verification.
- Holder-controlled sharing.
- Evidence references.
- Audit history.

### Important distinction

Cryptographic validation proves the credential's integrity and issuer relationship.

It does not independently prove that the underlying business claim is true.

### Website explanation

Explain issuer, holder and verifier roles using an accessible example.

---

# 33. PRODUCT: TRUST NETWORK

### Purpose

Create a consent-aware network of verifiable business relationships.

### Features

- Verified business connections.
- Supplier relationships.
- Customer relationships.
- Credential-backed attestations.
- Consent.
- Relationship status.
- Evidence provenance.
- Revocation.
- Dispute/correction.
- Trust history.

### Trust assessments

If an assessment or score is displayed:

- Explain its evidence.
- Show data freshness.
- Show confidence.
- Provide corrections.
- Avoid unsupported conclusions.
- Do not make automatic consequential financial decisions without appropriate safeguards.

### Website explanation

Show a network of businesses connected through verifiable relationships.

Explain how trust grows from evidence, not merely from joining the platform.

---

# 34. PRODUCT: BLOCKCHAIN VERIFICATION

### Purpose

Provide independent integrity verification for selected business proofs and credentials.

### Architecture

Off-chain business data → Canonical proof → Cryptographic commitment → Optional blockchain anchoring → Verification.

### Required functionality

- Proof creation.
- Canonical hashing.
- Signed credentials where applicable.
- Merkle proof support where implemented.
- Anchoring records.
- Chain/network identity.
- Verification status.
- Revocation checks.
- Evidence provenance.
- Audit history.
- Explorer links where applicable.

### Security

Do not publish sensitive personal or business records on-chain.

Use carefully defined commitments and metadata.

Protect signing keys.

Do not claim testnet anchoring is production anchoring.

### Website explanation

Explain blockchain in ordinary language.

For example:

"AfriCore can create a mathematical proof that a credential hasn't been changed since it was issued."

Then explain limitations.

Do not claim blockchain proves that all information in the credential is truthful.

---

# 35. PRODUCT: DEVELOPER PLATFORM

### Purpose

Provide developers with secure APIs for authorized AfriCore capabilities.

### Features

- Developer applications.
- API keys.
- Key scopes.
- Sandbox credentials.
- Production eligibility.
- API Explorer.
- API documentation.
- SDK examples.
- Webhook endpoints.
- Request logs.
- Usage metrics.
- Rate limits.
- Error diagnostics.
- Key rotation.
- Revocation.

### APIs

Where existing capabilities permit, expose:

- Customers.
- Invoices.
- Payment requests.
- Payment status.
- Reconciliation.
- Business verification.
- Verifiable credentials.
- Credential verification.
- Authorized business data.

### Standards

Use:

- Versioned API schemas.
- OpenAPI.
- Consistent errors.
- Idempotency.
- Pagination.
- Request identifiers.
- Scoped authorization.
- Webhook signing.
- Rate limits.

### Website explanation

Provide genuine request-and-response examples.

Do not publish credentials or real user data.

### Metering

Count eligible API requests accurately.

Do not bill internal retries or failed authorization attempts as normal usage unless a published policy explicitly says otherwise.

---

# 36. PRODUCT: AFRICORE CAPITAL

AfriCore Capital remains deferred.

Do not activate lending, invoice financing or credit disbursement.

Do not build a live lender workflow.

You may preserve architectural interfaces that could eventually allow approved financial partners to offer financing.

For the public website, do not advertise active financing products that cannot be delivered.

Any future rollout requires a separate product, risk, funding and compliance assessment.

---

# PART 5 — IMPROVE THE SERVICE MARKETPLACE

## 37. EVOLVE BEYOND BASIC ACTIVATE/DEACTIVATE BUTTONS

The current My Services implementation is a foundation.

Expand it into a mature modular SaaS system.

### Service states

Support:

- Available.
- Active.
- Requires setup.
- Awaiting provider approval.
- Suspended.
- Deactivated.
- Unavailable.

Do not equate service activation with all external integrations being ready.

### Service lifecycle

Discover → Understand → Activate → Configure → Use → Monitor → Manage → Deactivate.

Every step should have backend rules.

---

## 38. SERVICE DEPENDENCIES

Implement service-specific dependencies.

Examples:

Invoicing does not require Pay.

Reconciliation requires payment evidence but may accept permitted imported records without requiring AfriCore Pay.

Financial Intelligence requires relevant financial records.

Business Passport may require identity verification for particular claims.

Automation depends on its configured trigger/action services.

Developer API access depends on explicit scope and service entitlement.

### Rule

Do not force users to activate unrelated paid services.

Shared infrastructure should not appear as unnecessary customer-facing products.

---

## 39. SERVICE BUNDLES WITHOUT FORCED PACKAGES

Allow users to select services individually.

Optionally create recommended bundles such as:

- Freelancer Essentials.
- Merchant Starter.
- Contractor Operations.
- Developer Starter.

Bundles are recommendations, not compulsory subscriptions.

Users must be able to customize them.

Do not silently activate paid services.

---

## 40. IMPROVE PRICING & USAGE

The screenshots show nearly every service marked:

Free Evaluation.

This may be appropriate during the current testing period.

However, the UI needs clearer financial presentation.

### Required functionality

- Service-specific pricing models.
- Included allowances.
- Metered usage.
- Pricing versions.
- Usage history.
- Estimated charges.
- Spending alerts.
- Usage caps.
- Deactivation.
- Historical billing audit.

### Presentation

Customers should see:

Service → Plan → Usage → Estimated Charge.

They should not be forced to understand internal version identifiers.

### Important

Keep live customer charging disabled until pricing, billing infrastructure and payment collection are configured and authorized.

Use accurate estimates, not fictional payable balances.

---

# PART 6 — PUBLIC WEBSITE PRODUCT EDUCATION

## 41. EXPAND EVERY PRODUCT PAGE

Every product must have a properly researched public explanation.

The founder wants ordinary users to understand products without reading complex technical documentation.

### Each product page must explain

- What the product is.
- The problem it solves.
- Who uses it.
- How to start.
- What the user does.
- What happens behind the scenes.
- What information is required.
- How it connects to other products.
- Realistic examples.
- Availability.
- Pricing model.
- Security.
- Limitations.
- Related products.

Do not write the same repetitive introduction on every page.

---

## 42. UNIQUE EDUCATIONAL PRESENTATIONS

Use different explanation styles.

### Payments

A checkout journey with payment states.

### Reconciliation

Matching an incoming payment to an invoice.

### Cash Flow

An interactive financial timeline.

### Invoicing

A real invoice and partial-payment example.

### Automation

A visual trigger-to-action workflow.

### Business Passport

Credential-sharing interaction.

### Trust Network

Verified business relationships.

### Blockchain

An interactive proof-verification explanation.

### Developer APIs

An API request/response walkthrough.

Use original illustrations where they improve understanding.

Preserve the established NVIDIA-inspired website structure and AfriCore design system.

Do not turn the entire website into a repetitive sequence of nearly identical cards.

---

## 43. WEBSITE CONTENT MUST MATCH ACTUAL FUNCTIONALITY

Do not advertise features that do not exist.

Every service page must distinguish:

- Available now.
- Requires setup.
- Requires an external provider.
- Preview or testing.
- Planned.

Do not advertise unauthorized payment custody, lending or live settlement as currently available.

All marketing claims must be backed by actual implementation or clearly identified future capabilities.

---

# PART 7 — DESIGN SYSTEM REFINEMENT

## 44. CONSISTENT GLOBAL UI

Preserve the recent improvements to button geometry.

Improve:

- Spacing.
- Typography.
- Cards.
- Inputs.
- Tables.
- Mobile responsiveness.
- Interactive states.
- Empty states.
- Action placement.

Use shared components.

Avoid inconsistent custom controls.

### Mobile

Do not force desktop tables onto phone screens.

Use cards, summaries, drill-down views and appropriate responsive layout changes.

### Font sizing

Maintain compact, readable typography.

Do not apply another blind 20% size reduction if previous passes have already reached suitable proportions.

Measure actual components and adjust only the remaining oversized elements.

### Accessibility

Maintain suitable contrast, mobile touch targets and readable input text.

---

# PART 8 — BACKEND, DATA AND SECURITY

## 45. BACKEND PRODUCT ARCHITECTURE

Each product needs real application services.

Use appropriate separations:

- Domain logic.
- Service orchestration.
- Persistence.
- API handlers.
- External adapters.
- Background processing.
- Audit logging.
- Authorization.

Do not implement core financial business rules only in React components.

Do not duplicate the same business entities across modules.

---

## 46. DATABASE

Continue using Neon PostgreSQL.

Use versioned migrations.

Preserve:

- Users.
- Sessions.
- Workspaces.
- Customers.
- Orders.
- Invoices.
- Financial history.
- Credentials.
- Blockchain records.
- Usage records.
- Entitlements.

Do not reset production.

Use appropriate constraints and indexes.

---

## 47. SECURITY

Preserve prior security remediation.

Test:

- Authentication.
- Tenant isolation.
- Role permissions.
- Service entitlements.
- API key scopes.
- Financial idempotency.
- Webhook verification.
- Sensitive-file access.
- Session revocation.
- Credential signing.
- Approval workflows.
- Logging redaction.
- Rate limiting.

Do not regress previously fixed vulnerabilities.

---

## 48. EXTERNAL DEPENDENCY CONTROL

Create a provider-readiness registry.

For each integration record:

- Provider.
- Supported operations.
- Configuration status.
- Test-mode availability.
- Live credentials availability.
- Verification status.
- Required authorization.
- Health.
- Known limitations.

This should power accurate service availability states.

Do not show a service as fully operational merely because a simulator works.

---

# PART 9 — COMPREHENSIVE TESTING

## 49. SCREENSHOT REGRESSION TESTS

Reproduce the three supplied screenshot problems.

Verify:

- Usage table is mobile-friendly.
- Service names no longer break awkwardly.
- Price labels are readable.
- My Services cards use consistent buttons.
- Current Usage summary is compact.
- Security sessions display readable device information.
- Session management works.

Capture before-and-after screenshots.

---

## 50. COMPLETE PRODUCT TEST MATRIX

For every existing product:

Test at least:

1. Opening the service.
2. Backend authorization.
3. Empty-state behavior.
4. Create operation where applicable.
5. Read operation.
6. Update operation.
7. Delete/archive operation where permitted.
8. Validation.
9. Database persistence.
10. Cross-workspace isolation.
11. Error handling.
12. Related-service interaction.
13. Service deactivation.
14. Usage-metering accuracy.
15. Mobile responsiveness.
16. Public website correctness.

Add product-specific financial or cryptographic tests where required.

---

## 51. AFRICORE PAY END-TO-END TEST

Using an isolated test provider:

1. Create Business workspace.
2. Activate AfriCore Pay.
3. Configure a supported test provider.
4. Create an order.
5. Create a payment link.
6. Open checkout.
7. Initiate a test payment.
8. Receive an authenticated test callback.
9. Update payment status.
10. Reconcile payment.
11. Update the invoice/order.
12. Verify transaction history.
13. Prevent duplicate callback processing.
14. Test failure.
15. Test timeout.
16. Test reversal where supported.
17. Verify reporting.
18. Verify event metering.
19. Verify tenant isolation.
20. Confirm no real funds move.

Do not run tests using live financial credentials without explicit authorization.

---

## 52. ACCOUNT SECURITY TEST

Verify:

- Current-session detection.
- Other-session listing.
- Session revocation.
- Sign out all other sessions.
- Password change.
- Email verification.
- Email change.
- Recovery flow.
- Security notifications.
- Security audit history.

If MFA is genuinely supported and implemented, also verify:

- Enrollment.
- TOTP challenge.
- Invalid code.
- Replay.
- Recovery code.
- Lost authenticator recovery.
- Disabling MFA.
- Privileged step-up.

If MFA remains unsupported by the selected managed authentication architecture, report that clearly rather than passing fake UI tests.

---

## 53. MULTI-SERVICE TEST

Create a Business workspace with only Invoicing activated.

Confirm:

- Invoicing works.
- Invoicing does not force payment activation.
- Other services are discoverable.
- Inactive services cannot be used through unauthorized API calls.
- Customer records persist.
- Usage is recorded correctly.
- My Services displays actual selections.

Then activate Cash Flow and verify both services work together.

---

## 54. PERFORMANCE TEST

Measure:

- Initial login.
- Workspace bootstrap.
- My Services loading.
- Usage & Billing loading.
- Service activation.
- Invoicing.
- Payment processing.
- Reconciliation.
- Chart rendering.
- Service navigation.

Investigate database/API bottlenecks.

Do not merely replace spinners with longer cached placeholders.

Report actual latency measurements.

---

# PART 10 — IMPLEMENTATION EXECUTION

## 55. PRIORITY ORDER

Execute in the following order.

### Priority 1 — Screenshot fixes

Repair Usage & Billing, My Services and session-card presentation.

### Priority 2 — Account security

Implement supported security controls and evaluate genuine MFA support/migration.

### Priority 3 — Product audit

Inventory all existing services and identify their actual state.

### Priority 4 — Shared backend foundation

Improve canonical entities, service contracts, authorization and event handling.

### Priority 5 — AfriCore Pay

Build and validate payment-software workflows, provider adapters, checkout, payment links and transaction states.

### Priority 6 — Core business services

Customers, Orders, Invoicing, Expenses, Reconciliation, Cash Flow and Receivables.

### Priority 7 — Intelligence and automation

Financial Intelligence, AI Assistant, Automations.

### Priority 8 — Commerce

Social Commerce Checkout, Fulfillment and Protected Payments software.

### Priority 9 — Trust infrastructure

Business Verification, Business Passport, Verifiable Credentials, Trust Network, Blockchain Verification.

### Priority 10 — Data and developer infrastructure

AfriCore Connect, AfriCore Data, Developer APIs, Webhooks, Usage Analytics.

### Priority 11 — Marketplace improvement

Service entitlements, dependencies, My Services, Usage & Billing, availability states.

### Priority 12 — Public website

Expand every product page using accurate product-specific explanations.

### Priority 13 — QA and performance

Run functional, financial, security, mobile and integration tests.

### Priority 14 — Deployment

Publish validated changes through the existing Cloudflare/backend deployment setup.

### Priority 15 — Documentation and final report

Record completed functionality, tests, limitations and external blockers.

Use coherent implementation milestones and commits.

Do not perform one giant untested refactor.

---

# 56. MANDATORY COMPLETION STANDARD

A product is not complete merely because:

- Its page renders.
- A database table exists.
- A button works.
- A demonstration animation plays.
- Synthetic data appears.
- A provider adapter has a method name.

Define completion through real capabilities.

### Internal product completion

- Functional UI.
- Backend service.
- Persistent data.
- Authorization.
- Validation.
- Error handling.
- Audit history.
- Tests.
- Accurate documentation.

### External integration completion

Additionally requires:

- Provider credentials.
- Successful provider integration tests.
- Verified webhooks.
- Operational monitoring.
- Required provider approval.
- Required regulatory/compliance readiness where applicable.

Never label a provider-dependent feature live before these requirements are met.

---

# 57. DOCUMENTATION

Create or update appropriate documentation for:

- Product architecture.
- AfriCore Pay.
- Reconciliation.
- Invoicing.
- Cash Flow.
- Intelligence.
- AI.
- Automation.
- Commerce.
- Protected Payments.
- Business Passport.
- Credentials.
- Trust Network.
- Blockchain Verification.
- Developer Platform.
- Service Marketplace.
- Usage Metering.
- Account Security.
- MFA Capability Assessment.
- Authentication Architecture.
- Provider Readiness.
- Public Product Education.
- Product QA.
- Deployment.
- Known Limitations.

Update `AGENTS.md`.

Use semantic names rather than implementation-stage folder names.

Avoid duplicate documentation.

---

# 58. FINAL IMPLEMENTATION REPORT

Provide a detailed report covering:

### A. Screenshot Corrections

Show exact UI changes and before-and-after screenshots.

### B. Account Security

List implemented and verified controls.

Clearly identify MFA/passkey capabilities requiring an authentication architecture change or future provider support.

### C. Product Inventory

For every AfriCore product:

- Current status.
- Features implemented.
- Backend functionality.
- External integrations.
- Tests.
- Remaining limitations.

### D. AfriCore Pay

Explain the architecture, checkout, provider adapter, webhook handling, reconciliation and live-provider readiness.

### E. Other Products

Document each domain's implementation and dependencies.

### F. Service Marketplace

Explain activation, deactivation, dependencies, billing and usage.

### G. Public Website

List all product pages expanded and the educational scenarios implemented.

### H. Security and Performance

Report testing, latency and defects.

### I. Deployment

Provide the actual deployment status.

### J. Remaining External Requirements

List missing credentials, approvals, providers, security capabilities or legal/compliance prerequisites.

Do not declare blocked functionality complete.

---

# FINAL DIRECTIVE

AfriCore must evolve into a comprehensive, modular business infrastructure platform.

Every service must have a clear purpose, reliable backend implementation, understandable user interface, accurate documentation and appropriate access control.

The founder wants all customers to choose the products they need rather than being forced into a large all-in-one bundle.

Strengthen the Service Marketplace and Usage & Billing experience.

Fix the mobile Usage table.

Redesign My Services cards and usage summaries.

Preserve the improved rounded buttons and make all actions consistent.

Build a genuine Account Security Center with readable sessions, strong account controls and correctly implemented authentication capabilities.

Do not pretend that Neon Managed Better Auth supports MFA when the installed managed service does not.

Fully engineer AfriCore Pay as an extensible payment orchestration, checkout and merchant integration platform.

Use Stripe's architectural patterns and Safaricom's documented APIs as references without copying proprietary implementations.

Do not enable unauthorized real-money custody, lending, settlement or escrow.

Build and improve every other existing AfriCore product according to its specific business requirements.

Expand the public website explanations so normal users understand exactly what each service accomplishes.

Preserve Neon, Cloudflare, existing identities, business records, financial integrity and blockchain security.

**Inspect the actual repository, verify product capabilities, implement the improvements in safe logical milestones, test each product end to end, deploy validated changes, and report exactly what is functional and what still requires external configuration or approval.**