# Stage 2 compliance and activation gaps
Reviewed 2026-10-25. This is an engineering launch-gate register, not a legal opinion or certification. No AfriCore license, regulatory approval, financial partnership or safeguarding account has been verified.

| Area | Implemented boundary | Required before live use |
| --- | --- | --- |
| Payment/custody | Production protected-payment adapter disabled; simulator handles no money | Kenyan counsel determines regulated activities; authorized partner contract and approvals, permissions, settlement ownership and complaint responsibilities |
| Safeguarding | No internal wallet, customer float or escrow represented | Partner safeguarding/trust arrangements, segregation, reconciled balances, insolvency treatment, audit/reporting and disclosure review |
| Initiation/settlement | Sandbox commands, idempotency, explicit confirmations | Signed authenticated partner callbacks, replay protection, provider reference reconciliation, failure/reversal/refund and duplicate/concurrency live tests |
| Buyer protection | Clear sandbox terms, inspection/dispute states, merchant claims labeled | Reviewed consumer terms, independent dispute/appeal/support process, timelines, refund rights, fee/pricing disclosure and incident ownership |
| Identity and abuse | Member roles, tenant isolation, buyer bearer capability | Partner KYC/KYB/AML obligations, sanctioned-use controls, independent evidence assurance and operational case review |
| Privacy | Minimized assistant evidence, consent UI, scoped records, encrypted attachments | Lawful basis, controller/processor mapping, ODPC registration assessment, DPIA where required, processor agreements, cross-border safeguards and user-rights handling |
| Retention | 365-day evidence access window; metadata/audit retained | Approved retention schedule, physical purge, legal hold, backups/deletion and access/export processes |
| AI | Read-only tools, explicit provider consent, bounded usage, no stored prompts | Approved provider/model/project policies, privacy terms, credit funding, output evaluation and human review; no financial guarantees |
| Reliability | Local transactions/dedupe, bounded retries, aggregate operations | Distributed leases/limits, production load qualification, alert transport, restore drills, key rotation, penetration testing and incident exercises |
| Tax/connectors | Live bank/M-Pesa/eTIMS adapters unavailable | Authorized integrations, credentials, lawful permissions, version/rate-limit contracts and provider-specific acceptance tests |

Primary references checked during implementation:
- Kenya National Payment System Act, section 13 authorization framework: https://new.kenyalaw.org/akn/ke/act/2011/39/eng%402023-09-15/source.pdf
- CBK National Payment System Regulations 2014 (safeguarding, trust/operational obligations): https://www.centralbank.go.ke/wp-content/uploads/2016/08/NPSRegulations2014.pdf
- CBK current legislation directory: https://www.centralbank.go.ke/policy-procedures/legislation-and-guidelines/
- CBK published proposed National Payment System Bill 2026: https://www.centralbank.go.ke/wp-content/uploads/2026/09/National-Payment-System-Bill-2026.pdf . A proposal is not assumed enacted; counsel must check the governing law immediately before launch.
- ODPC data protection law directory: https://www.odpc.go.ke/data-protection-laws-kenya/
- ODPC data subject rights: https://www.odpc.go.ke/rights-of-a-data-subject/

Never change a production-enabled flag to bypass these gates. Blockchain, crypto/token systems, lending, AfriCore Capital, automated credit decisions and financing approvals remain excluded. Add no real funds to sandbox tests.
