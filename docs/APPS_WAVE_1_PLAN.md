# AFRICORE APPS — WAVE 1
## THE FIRST SIX BUSINESS APPS, CONNECTED BUSINESS OPERATING SYSTEM & INTELLIGENT NOTIFICATIONS

### MASTER CODEX IMPLEMENTATION PROMPT

You are continuing development of the existing AfriCore platform.

The founder has approved the attached **AfriCore Finance dashboard image** as the official visual reference for the new AfriCore Apps experience.

**Your mission is to implement the first six genuinely functional, interconnected business applications while preserving the ability to use every underlying AfriCore service independently.**

This is the first wave of a larger application marketplace initiative.

Do not rebuild the platform from scratch. Reuse the completed financial, authentication, intelligence, automation, service catalog, usage metering and business-trust infrastructure.

---

# 1. APPROVED VISUAL DESIGN

Treat the attached Finance dashboard mockup as the primary design reference.

Recreate its visual hierarchy and proportions as closely as practical using the existing AfriCore design system.

## Global application shell

Implement:

- Dark charcoal left sidebar.
- AfriCore logo at the top.
- Business workspace selector.
- Home.
- Apps.
- Services.
- Contextual business navigation.
- Billing.
- Analytics where appropriate.
- Settings.
- Help and Support.
- Collapsible sidebar.
- Compact white application content area.
- Persistent top header.
- Global search.
- Notification bell.
- User account menu.

Preserve the previously approved rounded corners, typography, compact controls and green accents.

Do not introduce oversized cards or excessive padding.

## App interior

Each installed app should have:

1. Its own name and logo.
2. An installed/activation status.
3. A short product description.
4. A panel showing included AfriCore services.
5. A link to use those services directly.
6. A row of other installed or available apps.
7. A dedicated application dashboard.
8. Charts, records, summaries and quick actions appropriate to that app.
9. Contextual navigation.
10. Integrated notifications and activity.

The Finance app should closely reproduce the layout from the approved image.

Other apps should follow the same design system but have layouts tailored to their actual work.

Do not clone the Finance dashboard six times.

---

# 2. FUNDAMENTAL PRODUCT ARCHITECTURE

AfriCore now has two distinct user-facing ways of accessing its capabilities.

## Method A — Direct Services

Customers can activate and use AfriCore services directly.

For example:

A business activates Invoicing and uses it from the Services section.

It does not have to install the Finance app.

A developer can continue using eligible service APIs without installing business applications.

The existing Service Catalog must remain fully functional.

## Method B — AfriCore Apps

Customers can install a free application that provides a dedicated experience for one or more services.

The application automatically activates its required services after presenting the relevant requirements and any applicable charges.

Example:

Install AfriCore Finance.

AfriCore activates eligible included services such as Invoicing, Expenses, Cash Flow and Reporting.

AfriCore Pay remains subject to its actual provider setup and live-transaction eligibility.

The user does not need to open the Service Catalog and manually activate every service.

## Critical rule

**Apps are optional interfaces. Services are independent underlying capabilities.**

Neither depends on the other being used as the primary interface.

The same authoritative data must be available through both authorized access methods.

---

# 3. FREE APP INSTALLATION AND SERVICE BILLING

AfriCore applications are free to install.

The underlying services may be:

- Free.
- Free with an allowance.
- Metered.
- Subscription-based.
- Pending provider configuration.
- Restricted to eligible users.

### Installation flow

1. User opens Apps.
2. Selects an app.
3. Reviews its capabilities.
4. Reviews included services.
5. Sees any applicable usage-based charges and terms.
6. Selects Install.
7. Backend validates eligibility.
8. Required service entitlements are activated.
9. App installation is persisted.
10. User is taken to the new app.

Do not silently consent to paid usage.

Make any paid or provider-dependent requirements clear before confirmation.

Use a single coherent installation flow.

Avoid separate manual service activation steps.

### Idempotency

Repeated installation requests must not create duplicate entitlements, subscriptions or charges.

### Service activation ownership

Track whether a service was activated:

- Directly by the customer.
- Through Finance.
- Through another app.
- Through multiple authorized paths.

Do not create separate duplicated copies of an entitlement just because two apps use the same service.

### Uninstallation

Uninstalling an app must not automatically disable services independently activated by the customer or still required by another installed app.

If an app is the sole reason a service is active, explain the available options:

- Keep the service active for direct use.
- Deactivate the service if eligible.
- Cancel future usage or subscription as permitted.

Never delete historical financial records because an app was uninstalled.

---

# 4. FIRST SIX APPLICATIONS

Implement the following six applications:

1. AfriCore Finance.
2. AfriCore CRM.
3. AfriCore Inventory.
4. AfriCore Sales.
5. AfriCore Analytics.
6. AfriCore Automations.

These six form the initial connected-business foundation.

Additional applications will be developed in later waves.

Do not begin the full HR, Accounting, Business ID, dedicated Payments, dedicated Invoicing or other specialized apps in this wave.

Their existing underlying services must remain accessible.

---

# 5. APP ONE — AFRICORE FINANCE

## Purpose

Give a business a unified operational view of invoices, payment requests, reconciliation, expenses, receivables and cash flow.

## Included services

Use existing eligible capabilities:

- Invoicing.
- AfriCore Pay.
- Payment Reconciliation.
- Expenses.
- Cash Flow.
- Receivables.
- Financial Reporting.

Respect provider requirements for live payment functionality.

## Dashboard design

Recreate the approved screenshot structure.

### Header

- Green Finance app icon.
- AfriCore Finance title.
- Installed status.
- Description.
- Open Services Directly.
- App actions.

### Included services panel

Display service chips showing their actual state.

Examples:

- Invoicing.
- Payments.
- Reconciliation.
- Expenses.
- Cash Flow.
- Reports.

### Other apps

Show a horizontal responsive row of related applications.

### Financial KPI cards

Include:

- Total Cash In.
- Total Cash Out.
- Net Recorded Movement.
- Outstanding Receivables.

Use precise definitions and actual persisted data.

Do not assume the net amount represents a verified bank balance.

### Charts

Implement:

- Cash Flow Overview.
- Receivables Aging.
- Expense Breakdown.

Use interactive charts with working filters.

### Recent Invoices

Display actual invoices with:

- Reference.
- Customer.
- Date.
- Amount.
- Status.

### Quick actions

- New Invoice.
- Record Expense.
- Create Payment Link.
- Open Reconciliation.

The actions must work.

### Other pages

- Invoices.
- Payments.
- Expenses.
- Reconciliation.
- Receivables.
- Financial Reports.

Reuse backend domain logic from the existing platform.

Do not build a parallel financial database for the app.

---

# 6. APP TWO — AFRICORE CRM

## Purpose

Help businesses manage customer relationships and sales opportunities.

## Services

- Customers and Clients.
- Relevant Sales capabilities.
- Customer Activity.
- Supported reminders and notifications.

## Dashboard

Show:

- Total customers.
- New customers.
- Active opportunities.
- Follow-ups due.
- Opportunity pipeline.
- Recent interactions.
- Customer activity.
- Quick actions.

## Functional requirements

- Create customer.
- Edit customer.
- Search customers.
- Customer detail page.
- Customer tags.
- Leads.
- Opportunities.
- Pipeline stages.
- Assigned team member.
- Follow-up tasks.
- Interaction notes.
- Activity timeline.
- Linked quotations.
- Linked orders.
- Linked invoices.
- Outstanding receivables where authorized.

## Integrations

When a customer is created in CRM, the authorized shared Customer service should make that customer available to Sales and Finance.

Do not require users to manually reenter the same customer in every application.

When an invoice is issued, the customer's history should show the invoice.

When a confirmed payment is recorded, relevant financial activity should appear in the customer timeline.

Do not leak private financial data to team members without permissions.

---

# 7. APP THREE — AFRICORE INVENTORY

## Purpose

Manage products, stock quantities, warehouse locations and inventory operations.

## Services

- Product Catalog.
- Inventory Tracking.
- Stock Movements.
- Warehouse Management.
- Replenishment.
- Relevant Order integration.

## Dashboard

Include:

- Total products.
- Stock value where a defensible valuation policy exists.
- Low-stock items.
- Out-of-stock items.
- Incoming stock.
- Reserved stock.
- Recent movements.
- Replenishment needs.
- Product categories.

## Functionality

- Create product.
- Edit product.
- Product variants.
- SKU.
- Barcode fields where applicable.
- Category.
- Units of measure.
- Purchase cost.
- Sale price.
- Supplier.
- Inventory tracking settings.
- Warehouse.
- Location.
- Stock receipts.
- Stock movements.
- Stock adjustments.
- Reservations.
- Returns.
- Reorder points.
- Stock alerts.

## Critical inventory model

Distinguish:

- On Hand.
- Reserved.
- Available.
- Incoming.
- Outgoing.
- Forecasted.

A confirmed order can reserve stock.

Actual on-hand stock decreases according to the appropriate fulfillment or stock-movement event, not simply because a user viewed or drafted an order.

Support transaction-safe reservations to avoid overselling.

Use exact quantity arithmetic appropriate to the unit.

## Integrations

Sales should use the same product and stock data.

Finance should use the relevant invoiced products and financial records.

Low stock should generate appropriate notifications or replenishment suggestions.

Do not automatically place supplier purchase orders without explicit policy and authorization.

---

# 8. APP FOUR — AFRICORE SALES

## Purpose

Manage the sales journey from quotation to confirmed order, invoicing and fulfillment.

## Services

- Sales Orders.
- Customers.
- Product Catalog.
- Quotation Management.
- Order Fulfillment.
- Invoicing integration.

## Dashboard

Include:

- Open quotations.
- Confirmed orders.
- Orders awaiting fulfillment.
- Sales activity.
- Revenue-related metrics where supported.
- Recent orders.
- Pipeline/conversion summaries.
- Pending actions.

## Functional requirements

- Create quotation.
- Select customer.
- Add products/services.
- Calculate totals.
- Apply discounts.
- Configure relevant taxes.
- Send/share quotation where supported.
- Accept quotation.
- Convert to sales order.
- Confirm order.
- Reserve inventory where applicable.
- Track fulfillment.
- Create draft invoice from order.
- Review payment status.
- Handle cancellation.
- Record returns where supported.

## Integration

A confirmed sales order should propagate the appropriate effects to:

- Inventory reservations.
- Finance draft invoicing.
- Customer history.
- Sales analytics.
- Notifications.

Do not duplicate sales values as revenue before the relevant accounting recognition rules are satisfied.

A quotation must not reduce stock.

---

# 9. APP FIVE — AFRICORE ANALYTICS

## Purpose

Provide cross-functional business insights using the records from authorized AfriCore services.

## Services

- Business Metrics.
- Financial Intelligence.
- Cross-Service Reporting.
- Data Quality.
- Reporting and Export.

## Dashboard

Include:

- Business performance overview.
- Sales trends.
- Customer trends.
- Inventory movement.
- Expenses.
- Cash-flow summaries.
- Receivables.
- Data source coverage.
- Relevant alerts.

## Requirements

- Interactive chart filters.
- Timeframe selection.
- Data comparisons.
- Segmentation.
- Drill-down.
- Custom dashboard layouts where appropriate.
- Saved reports.
- Authorized exports.
- Data freshness.
- Metric definitions.
- Permission-aware reporting.

## Data access

Only use services and records the workspace is entitled and authorized to access.

If Inventory isn't active, the Analytics app may explain how to enable inventory analytics, but must not create fake stock data.

Do not force the customer to activate every other business app.

An independently activated service can supply data to Analytics if the necessary authorization exists.

## Quality

Clearly distinguish:

- Actual records.
- Imported records.
- Derived metrics.
- Estimates.
- Forecasts.

No invented trends.

---

# 10. APP SIX — AFRICORE AUTOMATIONS

## Purpose

Give businesses direct control over repetitive cross-service workflows.

## Services

- Automation Engine.
- Workflow Builder.
- Business Events.
- Approvals.
- Notifications.
- Execution History.

## Dashboard

Include:

- Active workflows.
- Recent executions.
- Successful executions.
- Failures.
- Pending approvals.
- Upcoming scheduled actions.
- Most-used workflows.

## Workflow builder

Support:

Trigger → Condition → Action.

Examples:

1. Invoice overdue → Check unpaid status → Create reminder.
2. Payment confirmed → Reconcile → Update invoice status.
3. Stock below threshold → Create replenishment suggestion.
4. New customer → Create onboarding task.
5. Order approved → Reserve inventory and prepare draft invoice.
6. Credential expiring → Notify authorized owner.

## Requirements

- Create.
- Edit.
- Test.
- Activate.
- Pause.
- Disable.
- Version workflows.
- View run history.
- Retry failures.
- Manage approvals.
- Inspect errors.

Use the existing durable backend workflow infrastructure.

Do not execute customer-controlled arbitrary code.

Enforce permissions at the time each action runs.

---

# 11. MOST IMPORTANT FEATURE — AUTOMATIC CROSS-APP SYNCHRONIZATION

This is a central requirement.

AfriCore Apps must behave as a single connected business operating system.

Users should not repeatedly enter the same information in different apps.

### Shared authoritative entities

Reuse:

- Customer.
- Product.
- Order.
- Invoice.
- Payment.
- Payment Allocation.
- Expense.
- Inventory Movement.
- Workflow.
- Audit Event.

Apps are views and workflows over these shared domains.

Do not create one customer database for CRM and another for Finance.

Do not create separate unlinked invoice systems for Sales and Finance.

## Event-driven integration

Implement or reuse reliable domain events.

Examples:

- CustomerCreated.
- CustomerUpdated.
- ProductCreated.
- StockReceived.
- StockReserved.
- StockReleased.
- StockDispatched.
- StockAdjusted.
- SalesOrderConfirmed.
- OrderChanged.
- DraftInvoicePrepared.
- InvoiceIssued.
- PaymentConfirmed.
- PaymentAllocated.
- InvoicePaid.
- ReconciliationExceptionCreated.
- WorkflowApprovalRequested.

Use defined schemas, event versions, identifiers, workspace scopes and audit records.

### Reliability

Use transactional changes and a durable outbox or equivalent dependable event mechanism.

Use Cloudflare Queues, existing Orbit workers or another appropriate current infrastructure component.

Avoid introducing a second competing background event system.

Make consumers idempotent because events may be delivered more than once.

Prevent event loops and repeated actions.

---

# 12. AUTOMATIC UPDATES — SAFE RULES

Implement automatic synchronization based on business semantics.

## Example A — Customer changes address

CRM updates the customer record.

Other authorized apps show the new address for future operations.

Existing issued invoices preserve their legally relevant historical customer details as required by the invoice model and applicable rules.

## Example B — New sales order

Sales creates and confirms an order.

Inventory reserves available stock.

Finance prepares an appropriate draft invoice.

CRM updates the customer timeline.

Notifications report completed actions.

## Example C — Product quantity adjustment

Inventory records an authorized stock adjustment.

Availability and stock reports update.

Affected unfulfilled orders are checked for shortages.

The business receives an actionable notification where needed.

Already issued invoices are not silently rewritten.

## Example D — Confirmed payment

Payment provider evidence is validated.

Payment state changes.

Reconciliation allocates payment.

Invoice balance updates.

Cash-flow reporting refreshes.

CRM timeline updates.

The relevant user receives a useful notification.

## Example E — Invoice modification

A draft invoice can synchronize appropriate changes from the source order while respecting user edits and configured policies.

An issued/finalized invoice must not silently have its financial terms changed.

Instead, create an authorized correction or approval workflow using supported amendment, credit note or debit note procedures as appropriate.

### Automatic versus approval-required

Use automatic actions for low-risk, clearly permitted updates.

Require approval where the action is sensitive, financially consequential, legally constrained or inconsistent with locked records.

---

# 13. NOTIFICATIONS — NEW PLATFORM-WIDE CAPABILITY

The founder approves adding the notification bell shown in the generated image.

Implement a genuine Notification Center.

## Header

Add a compact bell icon in the persistent top bar.

Show an unread count.

Allow opening the notification panel.

## Notification types

- Informational.
- Success.
- Warning.
- Action Required.
- Approval Required.
- Security.

## Examples

"Order #1042 confirmed. Three units reserved."

"Draft invoice created from Sales Order #1042."

"Invoice #1042 was fully paid."

"Inventory for Product X is below the reorder threshold."

"Approval required: change to issued invoice #1042."

"Automation failed: customer reminder could not be delivered."

## Notification actions

- Open related record.
- Mark as read.
- Mark all as read.
- Approve where authorized.
- Reject where authorized.
- View change details.
- Dismiss where permitted.
- Configure preferences.

An approval must show the exact proposed change and its consequences.

Do not implement approval by simply toggling a notification's status.

The backend must enforce the decision.

## Realtime behavior

Use an appropriate architecture for reasonably prompt updates.

Evaluate:

- Existing realtime functionality.
- Server-sent events.
- WebSocket connections.
- Efficient polling.

Choose based on actual infrastructure and authorization requirements.

Notification delivery must not require the user to refresh the whole application.

## Persistence

Store notifications and read/unread state in Neon or the appropriate existing persistence layer.

## Security

Notify only authorized members.

Workspace switching must not show another organization's private notifications.

Do not leak confidential record details into untrusted push channels.

Support audit trails.

## Reduce noise

Do not notify every employee about every database update.

Provide preferences, subscriptions, aggregation and priority handling.

Do not duplicate a notification repeatedly when an event is retried.

---

# 14. APPROVAL CENTER

Build a centralized pending approvals view.

Approvals may originate from:

- Sales.
- Finance.
- Inventory.
- Automations.

Examples:

- Discount above policy limit.
- Significant stock write-off.
- Financial record correction.
- Sensitive invoice amendment.
- High-value supplier order.
- Sensitive workflow action.

### Features

- Pending.
- Approved.
- Rejected.
- Expired.
- Request details.
- Before/after values.
- Reason.
- Requester.
- Approver.
- Decision timestamp.
- Activity log.

### Security

Permissions must be enforced.

Bind the approval to the exact operation and version.

Do not let someone approve an amount and then execute a different amount.

Prevent replay.

Do not automatically grant approval privileges to every team member.

---

# 15. SIDEBAR AND APP NAVIGATION

Recreate the visual direction of the approved image.

Keep the sidebar compact and coherent.

## Permanent destinations

- Home.
- Apps.
- Services.
- Notifications, accessible through the bell and optionally the sidebar where useful.
- Billing.
- Settings.

## Apps

Display installed apps in a useful launcher or contextual navigation group.

When Finance is open, show Finance-specific sections.

When Inventory is open, show Inventory-specific sections.

When CRM is open, show CRM-specific sections.

Do not permanently clutter the sidebar with every subsection of every installed application.

## Services

Move existing direct-service navigation into a structured Services area.

Customers must be able to open independently activated services without installing an app.

Provide search and favorites.

## App switching

Allow users to switch apps quickly using an Apps launcher.

Preserve workspace identity.

Preserve the app shell.

Avoid repeated full reloads.

## Access

Do not show inaccessible private apps as installed.

Do not mistake navigation visibility for permission enforcement.

---

# 16. APP MARKETPLACE AND PERSONAL WORKSPACES

The primary Wave 1 apps target Business accounts.

However, Personal workspaces may appropriately use selected apps.

### Personal eligibility

Consider appropriate simplified versions of:

- Finance.
- CRM/Client Management.
- Analytics.
- Automations where relevant.

Do not force enterprise sales pipelines, warehouses, team administration or complex inventory functionality into every Personal account.

### Developer accounts

Do not create ordinary Business Apps inside Developer workspaces.

Developers should continue using direct services and developer APIs.

### App compatibility

Define eligibility in the authoritative app registry.

Do not duplicate app identities across account types unless there is a genuine product requirement.

---

# 17. APP REGISTRY AND PERSISTENCE

Create or extend a structured App Registry.

Every app must define:

- Stable app ID.
- Name.
- Icon.
- Description.
- Supported workspace types.
- Required services.
- Optional services.
- Installation configuration.
- Version.
- Navigation.
- Dashboard route.
- Permissions.
- Setup requirements.
- Availability.
- Uninstall behavior.
- Documentation.

Persist:

- Workspace installations.
- Installed app version.
- Installation origin.
- Required service entitlement references.
- App preferences.
- App navigation order.
- Favorites.
- Installation history.
- Audit logs.

Use safe versioned Neon migrations.

Do not overwrite the existing Service Catalog records.

---

# 18. PROFILE PICTURES — FUTURE ENHANCEMENT

The approved mockup shows a user avatar.

Preserve the layout space for an avatar and user menu.

For this wave:

- Use existing profile information.
- Use initials or existing supported avatar data.
- Do not fabricate photos of actual users.
- Keep the account menu functional.

Do not make building a full photo-upload system a dependency of Wave 1.

The founder wants profile-photo upload in Settings during a later enhancement.

Document the integration point for that future feature.

---

# 19. PROTECT FINANCIAL AND INVENTORY INTEGRITY

Critical invariants:

- A draft order does not automatically consume physical stock.
- Reserving stock does not necessarily mean it has shipped.
- Stock adjustment records must be auditable.
- Issued invoices must not silently change due to unrelated later edits.
- Payment confirmation requires authoritative evidence.
- Financial reporting must not duplicate payment events.
- Expense recording must not automatically prove external payment settlement.
- Inventory valuations require a defined costing method.
- Business analytics must distinguish actual records from estimates.
- Automated financial operations must respect role permissions.
- Historical records remain accessible according to legitimate retention rules.

Do not sacrifice correctness just to make app interactions feel automatic.

---

# 20. END-TO-END INTEGRATION TEST

Create a realistic isolated business test.

### Test journey

1. Create an authorized Business workspace.
2. Install Finance.
3. Verify its service dependencies activate correctly.
4. Install CRM.
5. Install Inventory.
6. Install Sales.
7. Install Analytics.
8. Install Automations.
9. Verify no duplicate service subscriptions.
10. Create customer in CRM.
11. Open Sales and select the same customer.
12. Create a product in Inventory with 20 units on hand.
13. Create an order for 3 units.
14. Confirm the order.
15. Verify 3 units are reserved.
16. Verify on-hand remains correct until fulfillment.
17. Verify available stock adjusts correctly.
18. Verify a draft invoice is prepared according to policy.
19. Open Finance and review the draft invoice.
20. Issue the invoice.
21. Process a simulated, provider-confirmed test payment.
22. Reconcile it.
23. Confirm invoice balance updates.
24. Confirm customer history updates.
25. Confirm Analytics updates.
26. Confirm appropriate notification delivery.
27. Create an authorized stock adjustment.
28. Verify affected stock views and relevant alerts update.
29. Attempt a change that affects an issued invoice.
30. Verify no silent illegal modification.
31. Verify approval/correction workflow.
32. Uninstall one app.
33. Verify independently activated or shared services remain active as appropriate.
34. Open one service directly outside its app.
35. Confirm the service remains fully usable.
36. Verify all data survives refresh and session changes.

### Negative tests

- Wrong workspace.
- Unauthorized team member.
- Inactive service.
- Duplicate events.
- Duplicate install request.
- Concurrent stock reservations.
- Insufficient stock.
- Failed worker.
- Event replay.
- Expired approval.
- Tampered approval parameters.
- Provider callback failure.
- Incorrect service metering.

No real payment should occur during automated tests.

---

# 21. VISUAL QA

Compare the implementation to the attached approved image.

Specifically review:

- Dark sidebar proportions.
- Top header.
- App logo and title.
- Installed status.
- Included-service chips.
- Related-app row.
- KPI card arrangement.
- Chart layouts.
- Donut charts.
- Recent records.
- Quick actions.
- Button radius.
- Typography.
- Spacing.
- White backgrounds.
- Restrained green accents.

### Responsive testing

Test desktop, tablet and iPhone-sized viewports.

On mobile:

- Collapse sidebar.
- Keep app identity clear.
- Use compact KPI arrangements.
- Stack charts appropriately.
- Avoid compressed financial tables.
- Preserve notification accessibility.
- Keep actions reachable.
- Avoid horizontal overflow.

### Important

The screenshot includes illustrative example figures.

Do not populate real workspaces with these values.

Use genuine records, or meaningful empty states for empty accounts.

---

# 22. IMPLEMENTATION ORDER

Work in safe, testable increments.

### Phase A — Audit

Inspect current repository, app/service inventory and previous milestones.

### Phase B — App Registry

Implement data model, app definitions, installation and entitlement integration.

### Phase C — Shared Shell

Build the approved global navigation, Apps launcher, Services access and top header.

### Phase D — Finance

Match the approved screenshot and connect to genuine financial services.

### Phase E — CRM

Implement customer relationships and shared records.

### Phase F — Inventory

Implement reliable stock and product operations.

### Phase G — Sales

Implement quotations, orders and fulfillment integration.

### Phase H — Analytics

Build genuine cross-service reporting.

### Phase I — Automations

Create app-specific workflow management over the existing execution infrastructure.

### Phase J — Cross-App Events

Implement reliable synchronization and appropriate automatic updates.

### Phase K — Notifications & Approvals

Implement backend persistence, authorization, realtime updates and action handling.

### Phase L — Testing

Run unit, integration, security, concurrency and end-to-end tests.

### Phase M — Deployment

Validate and deploy through existing Cloudflare/backend infrastructure.

### Phase N — Report

Document completed functionality, screenshots, tests and remaining limitations.

Do not begin additional app waves during this implementation.

---

# 23. DOCUMENTATION

Update existing documentation for:

- App Marketplace Architecture.
- App Registry.
- App Installation.
- Service Entitlement Relationships.
- Finance App.
- CRM App.
- Inventory App.
- Sales App.
- Analytics App.
- Automations App.
- Event-Driven Cross-App Integration.
- Business Notifications.
- Approval Workflows.
- Stock Reservation Semantics.
- Financial Data Integrity.
- Navigation and Design System.
- Personal Workspace Compatibility.
- Usage and Billing.
- Testing.
- Deployment.

Update `AGENTS.md`.

Avoid duplicated or inconsistent documentation.

---

# 24. FINAL ACCEPTANCE CRITERIA

Wave 1 is complete only when:

- Six applications are implemented and functional.
- Finance closely follows the approved design.
- Each app has its own icon, name, dashboard and contextual navigation.
- The Apps launcher works.
- Existing services remain directly usable.
- Installing an app activates its eligible required services through one flow.
- Charges and requirements are disclosed before activation.
- Shared services are not duplicated.
- Uninstallation does not destroy unrelated entitlements or historical records.
- Shared customer data works across apps.
- Products and stock records are consistent.
- Sales orders produce appropriate inventory and draft-invoice updates.
- Issued invoices cannot be silently overwritten.
- Payments and reconciliation update related views correctly.
- Analytics uses actual records.
- Automation executes authorized workflows durably.
- Notifications are persisted, timely and actionable.
- Approval decisions are secured.
- Workspace isolation is enforced.
- Existing Business/Personal/Developer authentication remains functional.
- Profile-photo upload is not falsely represented as implemented.
- Existing Neon data remains intact.
- Cloudflare/backend deployment remains operational.
- Screenshots, tests and deployment results are documented.

---

# FINAL DIRECTIVE

AfriCore Apps must feel like a connected business operating system.

The approved Finance image establishes the visual standard.

Customers install applications for convenience, not because applications are required to use AfriCore services.

Every app is free to install.

Its required services activate through a single informed installation flow, subject to eligibility and disclosed pricing.

Independent direct service use must always remain available.

The first six apps are Finance, CRM, Inventory, Sales, Analytics and Automations.

They must share authoritative business data and synchronize permitted changes automatically.

Build a genuine Notification Center and secure approval workflows.

Customers should be able to create a customer once, select that customer across multiple apps, confirm a sales order, reserve the correct inventory, prepare an invoice and see the resulting activity without repeating data entry.

Preserve financial and inventory correctness.

Preserve the existing platform, accounts, security, service marketplace, billing and completed milestones.

**Implement the complete first wave, validate cross-app workflows, compare the visuals against the approved reference image, deploy safely and provide a comprehensive implementation report.**