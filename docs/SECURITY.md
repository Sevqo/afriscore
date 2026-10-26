# Security
Owner: AfriCore engineering. Reviewed: 2026-10-25.

Every workspace operation resolves server-side membership or hashed scoped credential. Queries include org/environment predicates. Owner/admin manage team/developers; finance manages invoices/payments/imports; operations handles customers/orders; viewer reads. API keys cannot request admin scope or mint new keys.

Scrypt passwords, random salts, timing-safe comparison, hashed 256-bit sessions, HttpOnly/SameSite cookies and Secure in production. Recovery consumes tokens and revokes sessions atomically. JSON-only writes plus origin/Sec-Fetch-Site checks protect browser mutations. Development verification/recovery token return must never be publicly exposed. Production registration/recovery is disabled pending email delivery.

PostgreSQL RLS blocks untrusted direct roles; trusted table-owner backend bypasses RLS and enforces authorization in services. No browser DB credentials. See DATABASE.md for limitations. HTTP tests verify tenant/role/environment denial.

Opaque checkout tokens are hashed, expire and are redacted from access logs. Referrer policy is no-referrer. Configure reverse proxy/error logs to redact checkout paths and recovery query tokens too. No cookies/bodies/secrets should be logged. Production responses use no-store; maintain it at proxies. Website CSP permits same-origin assets; API CSP remains restrictive.

Only trusted adapters/signed sandbox callbacks advance payment state. Financial history is append-only by service convention. Independent 32+ character encryption key and HTTPS public origin are required at production startup. Public HTTPS webhook allowlist plus egress restrictions are essential; application DNS checks alone cannot eliminate rebinding.

Verified engineer allowlist controls internal access independently of workspace role. Kai has no provider and does not generate fabricated replies or receive customer data.

Remaining gates: external audit, retention/deletion, incident procedures, legal terms/support, distributed rate limits/worker leases, complete browser accessibility QA, PostgreSQL verification and real provider certification. No compliance claim. Database administrators can change workspace journal records; independent external anchoring is not implemented.

## Stage 2 controls and limits
Tenant/environment capabilities apply across Stage 2 routes. Commerce idempotency binds actor/action/input; buyer tokens are hashed, expire and are redacted in normal/error logs. Buyer views expose only their agreement/tracking/dispute. Separate assigned approvals require current owner/admin authority and expire. Model prompts contain minimized computed data with explicit consent, no direct DB/tool execution; prompts are not stored in AI usage.

Evidence attachments are encrypted and served as authenticated downloads, validated for supported type/size/signature; malware scanning and physical purge remain open. Bearer buyer links are not verified identities. Approval records for non-commerce categories do not universally gate legacy mutations. Initial single-process limits, service-role RLS bypass and incomplete accessibility/load/security audits remain documented deployment constraints.

## Stage 3 controls
Read STAGE3_SECURITY_REVIEW and KEY_MANAGEMENT. Credential production mutations are disabled; sandbox issuer authority is explicit and distinct from recognized institutions. Issuance requires holder authorization, approved types, current source hashes and safe status. Remote credential-controlled key URLs are not fetched. Public verification does not retain uploaded credential text. Recipient-bound one-time grants enforce audience/nonce/purpose/type/expiry and current membership; logs redact share/presentation capabilities.

Issuer compromise revokes dependent credentials; historical signatures/roots persist. Material Passport identity edits reset review/suspend identity credentials. Document custody is encrypted with bounded validated downloads. No browser private keys, public PII on-chain or tokens/fund movement. KMS/HSM, independent governance, external audit/OpenID conformance, physical deletion/malware scans, distributed controls and comprehensive load/fault qualification remain launch gates. Public demo identities are confined to synthetic browser state or a separate loopback database.
