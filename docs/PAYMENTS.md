# Payments
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Only sandbox initiation is enabled; no fund movement or custody balance. Live M-Pesa initiation/callbacks fail closed with 503. Provider interfaces alone do not prove live capability.

Workflow: customer → order → invoice → issue → payment request → save one-time checkout URL → simulate → event/allocation/report. Orders may be paid directly before invoicing; once invoiced collect through the invoice only. Existing order requests are cancelled on linking.

Scenarios: success, failed, delayed (pending then success retry), partial (half rounded down), duplicate (same receipt), reversed (review event). New requests collect a partial invoice remainder. Unique provider references prevent double allocation. Pending/failed IDs differ from final receipt IDs. Late failures cannot regress paid invoices.

Sandbox callbacks require independent signing secret, raw-body HMAC and recent timestamp. Merchant imports/frontend assertions cannot confirm payments. Event, allocation, document, journal and outbox commit atomically. Equal debit provider_collections / credit receivables entries form an observational journal; this is not a custody or statutory ledger. Reversals retain evidence and enter review. Refund/reversal settlement accounting remains incomplete.

## Live M-Pesa gates
Authorized merchant/shortcode access, Daraja app credentials, applicable passkey/certificates, HTTPS callbacks and secure secret storage are required. Implement verified status lookup/callback authenticity or requery, merchant identity, environments, refunds/reversals and settlement. Test retries/outages/duplicate/delayed/out-of-order events with authorized accounts. Complete contracts and regulatory review. No live credentials or authorized live tests were supplied.

## Webhooks
Atomic durable outbox, AES-256-GCM encrypted secrets (AFRICORE_ENCRYPTION_KEY), HMAC-SHA256(timestamp + dot + exact JSON). AfriCore-Delivery remains stable across retries/replay. Five attempts with exponential delay then dead_letter. Authorized replay resets attempts. Secret rotation is immediate and requires receiver coordination. Reused target validation checks HTTPS/public DNS/private addresses/allowlist and rejects redirects; deployment egress controls are still needed against DNS rebinding. Worker is single-instance polling every 10 seconds.

## Stage 2 protected-purchase separation
See PROTECTED_PAYMENTS.md and DISPUTES.md. This is a separate sandbox arrangement/settlement workflow, not a new bank ledger or live escrow. Standard checkout and invoice creation cannot collect again against an active protected order. Seller reports/connector samples cannot establish partner confirmation. A release/refund request and simulated confirmation remain distinct; no production fund movement occurs.
