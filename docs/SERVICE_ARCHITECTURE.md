# Modular services, entitlements and activation

28 October 2026. Canonical inventory: [SERVICE_CATALOG](SERVICE_CATALOG.md). Pricing and metering: [SERVICE_PRICING](SERVICE_PRICING.md). Release evidence: [MODULAR_RELEASE_REPORT](MODULAR_RELEASE_REPORT.md).

## Foundation and optional products

Identity, workspace resolution, account security, current membership checks, team administration, basic reports/exports, security notifications, approvals, audit history and usage administration remain foundation capabilities. They require authentication and the applicable role, never an unrelated product subscription.

`src/marketplace/catalog.ts` is the reviewed executable product registry. Migration 007 persists its definitions and initial immutable free-evaluation price versions. Internal operators can version explanations and availability; adding an executable product, changing kinds/dependencies or extending a route still requires reviewed source changes. There are no client-defined product IDs or client-authorized purchases.

`ac_service_entitlements` has one row per workspace/environment/service. Its stored status, price, configuration and navigation preferences belong to that resource scope. Current identity, membership, role, workspace kind and environment are checked independently on each server request. An API credential needs both Developer API access and its target product entitlement and existing capability scope. Foundation key revocation remains available to authorized humans after deactivation.

## Activation and setup

Explore Services searches and filters the current workspace's eligible catalog. Goal selection recommends explicit free services, permits customization and supports skipping. A new workspace starts without optional entitlements and opens discovery. Account type remains a separate onboarding decision. Existing workspaces preserve their previous free evaluation access through an audited migration; no customer records or account names are recreated.

Activation requires a current human owner/admin. Under the workspace transaction lock it checks eligibility, dependencies, availability, suspension, configuration and the effective price. Repeated activation is idempotent. A non-free estimate plan requires explicit confirmation of its price version. Active entitlements retain their price; reactivation after cancellation reviews the currently effective version. Neither operation starts collection.

An unconfigured Assistant or Webhooks entitlement is `requires_setup`, not operational access. Assistant needs a server key/model and the safety switch enabled; each external explanation separately needs a verified human and explicit provider consent. Webhooks need an exact approved receiver hostname and retain qualified public HTTPS/DNS/TLS delivery checks. Public managed identity and private configuration never enter browser catalog data. Existing provider and production gates remain authoritative even when an entitlement is active.

Invoicing includes customer entry. Its customer navigation/API is available without a Customers or Payments subscription. Orders likewise includes customer entry. Fulfillment can read existing orders without purchasing order creation. Business Expenses has an independent entry/history screen; Cash Flow includes expense/obligation tools. Intelligence does not fetch or render optional expense/obligation tools unless their entitlements allow them. Personal, Business and Developer use their own eligible catalogs.

Business Passport is the disclosed prerequisite for business verification, credentials and relationships; credential proof functionality requires Credentials. These prerequisites are displayed before activation, never silently purchased. Existing evidence may still be insufficient for a particular credential or review; entitlement does not certify evidence or confer issuer authority.

## Navigation and historical access

My Services contains status, setup/details, activation/deactivation, pinning and ordering, service usage and estimate links. The sidebar keeps its existing groups and adds pinned services. Supporting customer entry does not appear as a separate purchase. Personal retains its side menu/drawer; Developer retains explicit test-key context. Unknown routes still fail closed through the workspace kind and product policy maps. Hiding a link is never authorization.

Deactivation explicitly confirms the service, checks current role/dependencies/in-flight reservations and running workflows, cancels queued workflow runs, marks the entitlement off and records audit history. It deletes no financial, customer, credential or audit history. Authorized historical GETs and foundation exports remain available; new product writes stop. A pending external operation must finish or receive audited operator review before cancellation. Simulated connectors have no external paid subscription to disconnect. No provider connection is silently claimed to have been removed.

Workers check service access, not sidebar state. Automations and syncs honor workspace limits; webhook delivery reserves before networking and records success once. A provider-confirmed financial callback still settles after checkout access is disabled, preserving the immutable financial event. Turning off a service cannot erase money already confirmed by a provider.

## Persistence, administration and operations

007 adds catalog/prices/entitlements/history, usage events/reservations/limits/alerts and frozen estimate statements. Price versions, usage corrections and activation history are separate from merchant invoices and payment journals. PostgreSQL tables enable RLS and revoke PUBLIC access; server authorization remains mandatory. SQLite implements the same application contract for isolated local tests.

Internal endpoints live under `/api/v1/internal/services`. A verified identity on the existing engineering allowlist is required; workspace ownership/API keys are insufficient. The Cloudflare gateway denies the entire internal namespace. The internal `/app/service-admin` console supports versioned descriptions/availability, immutable price publication, suspension, bounded corrections and reviewed reservation releases only through that separately authorized channel. No gateway secret is given to the browser.

Current deployment is single-instance. Crash-held reservations fail closed until reviewed; there is no unaudited timeout refund that might race a continuing provider call. Distributed worker leases and shared rate limiting remain prerequisites for horizontal scaling. Live payment collection, lending, escrow, eTIMS and mainnet are disabled. Capital remains deferred.
