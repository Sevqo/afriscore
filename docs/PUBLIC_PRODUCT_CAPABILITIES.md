# Public product capability inventory

Generated from src/marketplace/catalog.ts on 29 October 2026. Registry availability is a software-service classification, not provider activation. Actual runtime limits are below. Refresh this inventory after catalog changes; public discovery imports the catalog directly.

| ID | Name | Registry state | Eligible workspaces | Dependencies | Usage measure | Education destination |
| --- | --- | --- | --- | --- | --- | --- |
| customers | Customers & clients | available | personal, business, developer | None | customer records | /products/business |
| orders | Orders | available | business, developer | None | orders created | /products/business |
| invoicing | Invoicing | available | personal, business, developer | None | issued invoices | /products/invoicing |
| income | Income tracking | available | personal | None | income entries | /docs |
| expenses | Expenses | available | personal, business | None | expense entries | /products/cash-flow |
| cash_flow | Cash Flow | available | personal, business | None | cash-flow entries | /products/cash-flow |
| payments | AfriCore Pay | evaluation | personal, business, developer | None | confirmed test payments | /products/pay |
| reconciliation | Reconciliation | evaluation | business, developer | None | resolved reconciliation exceptions | /products/reconciliation |
| intelligence | Financial Intelligence | available | business | None | analysis requests | /products/intelligence |
| forecasting | Forecasts | available | business | None | scenarios calculated | /learn/forecasts |
| assistant | AI Business Assistant | available | personal, business, developer | None | successful explanations | /products/intelligence |
| automations | Automations | available | business | None | completed workflow executions | /products/automations |
| data | AfriCore Data | available | business, developer | None | normalized records | /products/data |
| connect | Connect & data sync | evaluation | business, developer | None | successful sync runs | /products/connect |
| passport | Business Passport | evaluation | business | None | Passports created | /products/business-passport |
| verification | Business Verification | evaluation | business | passport | eligible completed reviews | /products/business-verification |
| credentials | Verifiable Credentials | evaluation | business | passport | credentials issued | /products/verifiable-credentials |
| trust_network | Trust Network | evaluation | business | passport | relationships requested | /products/trust-network |
| blockchain | Blockchain Verification | evaluation | business | credentials | proof checks | /products/blockchain-verification |
| fulfillment | Fulfillment & delivery | available | business | None | shipments created | /products/business |
| protected_payments | Protected Payments | evaluation | business | None | test agreements created | /products/protected-payments |
| developer_api | Developer API access | evaluation | business, developer | None | successful API requests | /developers |
| webhooks | Webhooks | requires_configuration | business, developer | None | successful deliveries | /developers |
| verification_api | Verification APIs | evaluation | business, developer | None | verification requests | /products/verification-api |

## Source verification and runtime limits

Financial operations: src/operations/finance and workspace record routes implement issuance, partial allocations, bounded credits/returns and reconciliation. Manual income/expense/import provenance remains separate from independently confirmed payment evidence. Orders and fulfillment record separate statuses; no live courier feed.

Payments: src/operations/providers contains simulator and guarded Daraja adapter. Hosted Daraja enablement remains false; no provider authorization is inferred. Protected payments retain sandbox agreement/review states and no live custody.

Intelligence/forecast/assistant: canonical snapshots, forecast arithmetic, prospective evaluation and alerts are implemented. Actor-private encrypted conversations and fixed tools exist. Real external AI output remains unqualified: reused key returned provider_credit_exhausted.

Automations: immutable version-bound rules and durable bounded retries support in-app notifications. Free single-instance hosting may sleep. No automatic payment, email or SMS action.

Connect/Data: authorized CSV imports and canonical lineage are implemented; remote connector catalog remains simulated. Validation/normalization is not source verification.

Trust: src/trust implements private evidence/manual review, signed JOSE credentials, status, sharing, bilateral relationships and proof verification. No institutional approval, malware scan, production signing/KMS, OpenID certification or public-chain activation is claimed. Trust dimensions do not determine creditworthiness.

Developer: existing scoped keys, environment/capability/service fences, OpenAPI and explorer remain authoritative. Webhook egress additionally requires an approved receiver and runtime enablement.

Pricing: src/marketplace/schema.ts evaluationPrice creates evaluation-v1 free estimates with charging disabled; published immutable price versions and existing selections take precedence in authenticated review. No invented allowance or permanent-free promise. Capital remains deferred. The first six optional Business apps and simplified Personal Finance/Analytics are available in the authenticated evaluation workspace; see APPS_WAVE_1_REPORT.md for exact release scope and qualification.
