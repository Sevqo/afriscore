# AfriCore Apps Wave 1 — architecture and implementation record

Status: implementation in progress, not deployed or accepted. The owner brief is retained verbatim in APPS_WAVE_1_PLAN.md. The approved Finance reference is the owner-supplied `AfriCore Finance Dashboard Overview.png`: dark compact sidebar, persistent header, app identity/status, included-service panel, related-app row, four financial KPIs, movement/aging/category charts, recent invoices and quick actions. Its illustrative figures, named avatar, Pro plan and later-wave HR/Business ID tiles must not populate real accounts.

## Baseline audit

Existing canonical customers, orders and invoices live in ac_records and their platform services. Provider evidence, effective allocations, credits and return adjustments remain under platform/payments and finance. Notifications, approvals, events and durable workflows already exist in operations. The apps must use these, not create parallel customers, invoices, receipts or workflow engines. CRM opportunities/tasks/interaction metadata, product/warehouse/stock domains, quotations and installation ownership are genuine gaps requiring implementation. The existing private actor-scoped Assistant and all provider/identity/security gates remain.

## Registry and installation foundation

src/apps/catalog.ts defines the six stable identities, version, compatible kinds, required/optional services, navigation, documentation, setup and uninstall policy. Business supports all six. Personal initially supports simplified Finance and Analytics; enterprise pipeline/warehouse features are not forced into it. Developer keeps independent APIs/services and cannot install these business apps.

Migration 010-business-apps is additive: scoped installations, append-only installation history and activation-source references. Existing active/requires-setup/suspended selections are conservatively backfilled as direct access; no historical app ownership is invented. New CRM/Product Catalog/Inventory/Sales service definitions and free evaluation prices are registered without activating them in existing workspaces or replacing existing catalog records. Hosted application startup must remain verify-only; no migration has yet been applied to Neon.

A preview binds the exact app version, optional selections, workspace/environment, current service eligibility/setup/status and effective price versions into a deterministic review hash. Installation validates the current human administrator, checks that review, activates through the existing service engine, and records one installation/history inside the existing locked idempotent transaction. App installation has zero fee and consumes no artificial service unit. A changed review fails closed. Non-free service prices still require explicit informed confirmation; no customer charging/live provider activation is added.

Each canonical service entitlement can have several activation references: direct, a dependency of a direct service, Finance, Sales or another app. Activating an already-active service through a new path adds a reference without duplicating its entitlement. Current apps prevent direct deactivation of services they require. Uninstall removes only its own references and retains all historical records. Shared/direct selections survive. Explicit keep creates a direct reference, including shared services, so a later uninstall cannot undo that choice. Explicit sole-use deactivation runs in dependency-safe order and respects pending operations and other existing lifecycle guards.

The foundation uses the current same-origin JSON middleware, membership/capability gates, exact workspace-kind metadata, default-deny service policy and durable idempotency. Browser navigation never authorizes access. Preferences/favorites/order and installation history are persisted per workspace/environment. Nothing in this checkpoint claims that the six app dashboards, new business domains or the complete Wave 1 journey are already delivered.

## Next implementation groups

Implement shared product/warehouse/immutable-stock/reservation and CRM/quotation metadata, then integrate Sales confirmation with canonical orders and reviewed draft invoicing. Preserve explicit stock units and exact arithmetic, issued-document snapshots and payment provenance. Extend existing events/worker rather than add a competing queue; scope notifications to authorized recipients and enforce action-bound approvals. Build the shared shell and distinct app dashboards over those services, retain direct service use, then execute both database suites, concurrency/security/journey tests and visual comparison before guarded migration and backend/frontend release.

## Independently executed foundation checks

Five isolated SQLite HTTP/integration tests pass: reviewed activation/idempotency/no install meter; direct/shared ownership and retained canonical customer reads after uninstall; changed review/price and cross-workspace/nonadministrator denial; dependency-safe preservation; Personal/Developer compatibility. TypeScript passed. Early fixture errors were corrected: Personal/Developer setup requires a name; explicit keep must establish direct ownership even when another app also uses the service. PostgreSQL and full-regression/release qualification remain required for the complete wave.
