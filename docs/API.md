# API
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Workspace inventory: platform-openapi.json, served by /api/openapi.json. Generate with node scripts/platform-openapi.js; npm run validate:platform rejects route drift. It currently uses generic JSON body/response schemas; field-level contracts are still required before SDK publication. Legacy openapi.json remains independently validated.

## Identity
POST /api/auth/signup or /signin {email,password}; password 12–200 characters. GET /me; POST /signout; POST /recover {email}; POST /reset {token,password}; POST /verify {token}. Sessions: HttpOnly/SameSite cookie, Secure in production, one-day expiry, hash stored. Tokens: one-hour, consumed once. Development returns tokens explicitly; production signup/recovery fails closed pending email delivery.

## Workspaces
GET/POST /api/v1/organizations. Body: name,business_type,industry,country (KE),location,currency (KES),email,phone, optional registration_number/tax_id/features. PATCH /organizations/{org} updates validated profile for owner/admin. GET team; POST invitations {email,role}; POST /api/v1/invitations/accept {token}; PATCH team/{member} {role}.

All following paths share /api/v1/organizations/{org}. X-Environment is sandbox (default) or production. Server clients use Authorization: Bearer ac_<secret>; scopes read/operations/finance. Keys are org/environment-bound. Key administration requires member sessions.

GET /records/{kind}?limit=50&offset=0&q=&status=; GET /records/{kind}/{id}; POST /records/{kind}; PATCH /records/{kind}/{id}. Kinds: customers/orders/invoices/applications/transactions/integrations. Search filters the selected page. Customer: name,type individual/business,email,phone,notes. Application: name,description. Integration: provider csv/sandbox/africore_pay. Transactions use /import.

Order/invoice: customer_id, optional order_id (invoice only), currency, items [{description,quantity,unit_price_minor}], issue_date,due_date (YYYY-MM-DD), discount_minor,tax_bps,notes,terms,payment_instructions. Quantities are positive integers. Taxes use basis points. Server computes totals. Linked invoice must equal order customer/currency/total; one non-void invoice per order. PATCH status issued (invoice) or awaiting_payment (order). Paid state cannot be submitted. Order fulfillment_status processing/fulfilled/cancelled is independent.

POST /payment-requests {document_id}, Idempotency-Key header 8–200 chars. Checkout URL shown once. Retry returns original metadata without secret. GET /payments. Public GET /api/v1/checkout/{token}; POST .../pay {scenario:success|failed|delayed|partial|duplicate|reversed}. Sandbox only.

POST /api/v1/callbacks/sandbox body {request_id,reference,status,amount_minor,currency}; AFRICORE_SANDBOX_CALLBACK_SECRET required. AfriCore-Timestamp (seconds) and AfriCore-Signature (hex HMAC-SHA256 over timestamp + dot + raw JSON), freshness 5 minutes. Other provider callbacks return 503. This is not Daraja verification.

GET /reconciliation; POST /reconciliation/{id}/review {note} preserves provider evidence. POST /import {rows:[{external_id,amount_minor,currency,type:inflow|outflow,occurred_at:ISO8601,source,counterparty}]} (1–1000 rows, atomic/deduplicated). GET /report?from=&to=&currency=KES&customer_id=&format=csv. Customer filter affects receivables only. Currency buckets never combined. Browser Print/Save PDF exports invoices.

GET/POST /credentials (application_id,scopes); DELETE /credentials/{id}; rotation=create replacement then revoke old. GET/POST /webhooks (url,subscriptions); POST /webhooks/{id}/rotate; POST /webhooks/process; POST /deliveries/{id}/replay; GET /audit (admin). GET /api/v1/internal requires verified engineering allowlist membership, independent of org role.

Errors contain error/message/request_id; validation includes issues. Lists limit 1–100. Global IP limit 600/minute; auth 40 requests/15 minutes, per-process. Signed webhooks: AfriCore-Signature t=...,v1=...; HMAC over timestamp + dot + raw payload. Reject old signatures and deduplicate AfriCore-Delivery. See PAYMENTS.md.

Currency display respects zero-decimal UGX/RWF as well as two-decimal KES/USD/EUR/GBP/TZS. New document line-item controls collect ordinary unit prices and convert to validated minor units before submission.

## Stage 2 API
New /api/v1/organizations/:org groups: intelligence, forecasts, expenses, obligations, assistant, automation-templates, automations/runs/process, notifications/preferences, approvals, shipments, protected-sales, disputes/evidence, connectors/catalog/sync/import and risk-signals. Buyer capability routes live under /api/v1/buyer/:token. Internal /api/v1/internal/stage2 routes require verified engineering access. Lists support existing limit/offset conventions; aggregates are bounded by workspace data rather than cursor pagination.

Use X-Environment sandbox/production and explicit currency. Commerce commands require Idempotency-Key. Never log buyer tokens or send external AI evidence without per-request consent. platform-openapi.json is generated from mounted routes plus shared Zod schemas for the main Stage 2 inputs. Remaining generic schemas are inventory contracts, not complete SDK validation. Run npm run build then node scripts/platform-openapi.js after route/schema changes; npm run validate:platform builds/checks drift. Legacy OpenAPI remains separate and unchanged. Signed Stage 1 outbox supports the expanded catalogue in src/stage2/events.ts.
