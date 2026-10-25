# Integrations
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Available: CSV normalization/deduplication, deterministic sandbox payments, AfriCore Pay record source and preserved legacy synthetic connectors/statement parsers. Integration records expose provider/status/authorization explicitly; they are not live OAuth bank connections.

Unavailable: authorized M-Pesa/banks/POS/eTIMS/accounting/inventory. Provider access, contracts, auth/revocation, capability mapping, health/error handling and authorized testing are required. No fake connected accounts are displayed.

CSV: external_id,amount_minor,currency,type,occurred_at,source,counterparty. Type inflow/outflow; timezone-bearing ISO8601; positive integer minor units. Source/external ID dedupe per org/environment. Quoted fields and escaped quotes are parsed, then validated/committed atomically. Imports cannot mark invoices paid.

Applications own scoped org/environment API credentials stored as hashes and shown once. Rotation creates replacement then revokes old. Webhook secrets are separately encrypted; durable deliveries support retry/dead-letter/replay.
