# Pricing, usage metering and billing foundation

All deployed initial plans are free evaluation. This document defines infrastructure, not commercial rates. Collection is hard-disabled and the collection adapter refuses execution. No payment provider, automatic subscription, payable platform invoice, tax invoice or actual charge is created.

## Price contract

`src/marketplace/pricing.ts` validates immutable service/version pairs with effective/expiry dates, a monthly period, explicit currency/unit, included units, fixed/unit amounts, graduated tiers, minimum/cap, tax wording and description. Current platform pricing supports KES minor units only; unsupported currencies are rejected rather than converted or mixed. Merchant transaction currencies remain unchanged.

Models: `free` returns zero; `flat` applies the fixed activation-month estimate; `metered` multiplies units; `allowance` deducts included units first; `tiered` uses increasing graduated bands ending in an open tier; `hybrid` adds fixed access and allowance/overage. BigInt intermediate arithmetic rejects unsafe totals. A cap bounds the estimate; a minimum applies to a nonzero usage charge. Fixed fees cover a month with activation, without proration, as disclosed in the cancellation dialog. Historical activation intervals determine eligible months; a preference edit cannot extend a canceled interval.

Example schema **for isolated tests only, never a published rate**:

```json
{"service_id":"invoicing","version":"synthetic-example-v1","currency":"KES","model":"allowance","unit":"issued invoices","included":10,"fixed_minor":0,"unit_minor":100,"tiers":[],"minimum_minor":0,"cap_minor":null,"period":"monthly","effective_at":"2026-10-28T00:00:00.000Z","expires_at":null,"tax_treatment":"Synthetic estimate only; no tax invoice.","description":"Test fixture, not a commercial offer."}
```

Publishing a version never overwrites another. Existing active entitlements retain their version. An owner must review and confirm the current non-free version before a new activation/reactivation. Real commercial rates, tax treatment, collection authorization, payment idempotency and reconciliation require a separately reviewed launch configuration.

## Authoritative units

Server policy and domain completion determine usage. Clients cannot submit quantity, price, workspace attribution or a billing period through a consumption endpoint. Successful resource creation uses the committed resource identity; issued invoices use their invoice identity. API requests count each successful authorized handled request. Failed requests do not create completed usage. Client retry headers cannot erase real consumption.

Automations use successful run IDs; simulated data syncs use completed stable batches; provider payments use accepted confirmed event IDs; signed webhooks use successful delivery IDs; AI explanations use successful provider result IDs after a durable service reservation, separate from conservative platform USD safety reservations; credentials use issued credential IDs; manual business reviews use completed review IDs; verification APIs count valid handled requests; proof access counts active-service checks. Public bounded verification remains a distinct public facility. The catalog records each precise unit rather than calling all activity a transaction.

`ac_usage_events` is append-only through production services and unique on workspace/environment/service/idempotency key. A replay with conflicting quantity/source fails. Corrections require an internal actor, reason and positive original event in the same workspace, environment, service, price and period. They append bounded negative quantities; they cannot reverse more than the original. No customer action deletes evidence or rewrites an old price.

## Limits and alerts

Owner/admin controls support service or whole-workspace monthly estimate budgets, quantity caps, hard stops and warning thresholds. Reservations and consumption are serialized with the workspace lock; pending reservations are included in limit checks. Completion records usage and releases the reservation atomically; failures release without consumption. Replays cannot consume twice. Threshold alerts and owner/admin in-app notices deduplicate by scope, period, percentage and kind.

Financial confirmation must not be discarded because an operational limit is reached after a checkout was initiated. Provider callbacks preserve settlement and account for the accepted event. Manual compliance outcomes similarly retain their audit history. These are explicitly different from permitting a new external paid operation above its cap.

## Statements and visibility

Usage & Billing shows UTC monthly units, included/remaining allowance, historical price versions, pending reservations, thresholds, authenticated CSV export and saved estimate snapshots. A saved `ac_billing_statements` snapshot is immutable and separate from customer invoices. Every view identifies estimates and `amount_due_minor: 0`, `collection_enabled: false`. There is no simulated payment-attempt success. A future authorized collection system must introduce its own payment/reconciliation contract before it can collect these amounts.

Safeguards are implemented in `src/marketplace/{engine,request,policy,routes}.ts`. Fixture tests cover all models, boundaries, currency rejection, concurrent caps, release/replay, scoped corrections, price changes, cancellation months, alert notices, independent Personal/Developer use and API-key deactivation.
