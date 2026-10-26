# Stage 3 compliance gaps and DPIA draft
Owner: AfriCore privacy/security/legal review. Reviewed 2026-10-26. Engineering draft; not a legal opinion, certification or completed DPIA.

## Processing map and purpose
Workspace businesses manage identity/evidence, authorize credential issuance and limited recipient disclosure. Eligible sandbox issuers assert minimal claims; named recipients verify them. The backend processes legal/representative statements, documents, business source references, signatures, access logs and encrypted custody. Only randomized aggregate commitments are eligible for chain publication. No financial eligibility or credit decision is made.

## DPIA risk assessment
| Risk | Implemented mitigation | Remaining decision/action |
| --- | --- | --- |
| Unauthorized disclosure | Tenant/role checks, private defaults, named-recipient grants, one-time access, encrypted files/tokens, redacted logs | Independent penetration/authorization review, proxy redaction and processor-access audit |
| Overclaiming assurance | Explicit levels, max0 sandbox/max1 manual review, source hashes, issuer/type controls, separate technical reports | Vetted registry/source agreements and independent issuer governance |
| Immutable linkability | Random salts, root-only batches, no direct subject IDs on-chain | Legal assessment of residual linkability, batch anonymity policy, retention of authorized proof material |
| Inaccurate/contested claims | Correction requests, suspension/revocation and historical preservation | Independent appeal/escalation process and service-level obligations |
| Excessive collection | Minimal signed summaries; existing source references rather than full copied finance data | Data inventory, lawful-basis assessment, business/representative authority and consent evidence |
| Retention/deletion conflict | Download/issuance access windows and off-chain data design | Physical purge, legal holds, backups, user-rights workflows, retention approval and deletion verification |
| Key/administrator compromise | Encrypted custody, environment separation, operator allowlist, rotation/revocation, production disabled | Managed KMS/HSM, dual control, key ceremonies, external security assessment and incident drills |
| Recipient copies | Purpose/expiry, preview and explicit copy limitation | Recipient contracts, misuse response, cross-border/processor assessment |
| Credential/relationship profiling | Transparent coverage-only methodology, no credit/fraud verdict | DPIA consultation, fairness review and prohibition on financial eligibility use |
| Network/RPC failure | Local chain default, chain/address checks, confirmations/retries | Independent RPC redundancy, reorg/load qualification and external alerts |

## Kenyan requirements for qualified review
ODPC describes rights to information/access/objection/correction/deletion and principles of purpose limitation, minimization, accuracy, bounded retention and cross-border safeguards: https://www.odpc.go.ke/rights-of-a-data-subject/ . Law directory: https://www.odpc.go.ke/data-protection-laws-kenya/ (directory fetch timed out on final review; do not infer a legal change). Obtain current Kenya Data Protection Act/regulations and sector advice from qualified counsel.

Determine controller/processor/joint-controller roles; ODPC registration/DPO/DPIA obligations; representative authority; institutional issuer contracts; transfer/hosting safeguards; data-subject request and complaint procedures; retention/deletion/legal hold; status publication privacy and incident notification. Hashing is not assumed anonymization. A permanent root cannot be deleted through the contract; revoke/correct off-chain assertions instead. No government/financial partnership or recognized legal certification is claimed.

Production gates: real authorized sources, vetted issuers, reviewed terms/privacy notices/recipient agreements, completed DPIA, managed keys, external security/contract assessment, tested deletion/restore/incident operations, distributed controls, external OpenID interoperability and approved network configuration. Capital, crypto assets and automated financing remain deferred.
