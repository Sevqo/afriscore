# Product technology review

Reviewed 2026-10-27 against current source, installed exports, HTTP regressions and primary references. Keep the present modular TypeScript/Express/React and SQL architecture. SQL transactions and constraints, not a language rewrite, protect persistence; TypeScript runtime schemas still validate untrusted inputs. No performance evidence justifies introducing Python services or a new full-stack framework.

| Products | Decision and reviewed boundary |
| --- | --- |
| Accounts / workspaces | TypeScript plus managed identity verification; current database membership controls access. No email auto-linking or frontend authorization. |
| Customers / orders / invoicing | SQL-backed transactional services, runtime validation and integer totals. Preserve issued history, source links and partial allocations. |
| Payments / reconciliation | Provider adapters, idempotent events, transactional allocations/journal and explicit status transitions. A receipt/import is not settlement. No real provider activation. |
| Cash flow / intelligence | Deterministic TypeScript aggregation of scoped evidence with explicit coverage, currencies and forecast assumptions. Python would become relevant only after a defined statistical workload, data/quality evaluation and deployment need. |
| AI assistant | Existing read-only, bounded tools and explicit provider consent. Financial arithmetic remains deterministic. No new model integration or paid API request was required for this repair. |
| Automations / Connect | Durable SQL run state and source-aware imports; one-process workers remain proportionate. Distributed leases/limits and real provider qualification remain launch gates. |
| Fulfillment / protected purchase | Explicit state machines and distinct approvals/evidence. No custody, escrow or unilateral release shortcut. |
| Passport / credentials / Trust Network | TypeScript/JOSE signatures and bounded disclosure/status services. Signatures establish integrity, not the truth of a commercial statement or recognized issuer status. |
| Blockchain verification | Keep Solidity/OpenZeppelin root commitments and independent Merkle verification. No contract identifier changes, new token, mainnet publication or real funds. |
| Developer platform | Scoped keys, OpenAPI, signed webhooks, replay/rate controls and separate Developer containers. Do not require a merchant business for developer onboarding. |

The review identified missing managed credentials in operations/Passport HTTP requests and CSV downloads; all now use one authenticated transport. Initialization is deduplicated without caching access tokens indefinitely. Checked-out PostgreSQL client failures are captured during transactions, failed clients are discarded and writes are not automatically replayed. A live local-PostgreSQL connection-termination test proves rejection and subsequent pool recovery. Idle pool handling alone did not cover this case.

Performance observations: production build retains lazy auth chunks and a separate React vendor chunk; the main application remains eager and is a future route-splitting candidate, not a claimed performance win. Three new 1200px WebP scenes add about 475KB total and load through existing lazy media boundaries. Vite's shared font directory was missing from its filesystem allowlist and is now explicitly allowed; no broad filesystem exposure was added. Full load/soak, distributed throughput and public testnet/provider measurements were not performed.

Primary references: [PostgreSQL isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [pool lifecycle](https://node-postgres.com/apis/pool), [W3C credential data model](https://www.w3.org/TR/vc-data-model-2.0/), [OpenZeppelin Merkle proofs](https://docs.openzeppelin.com/contracts/5.x/api/utils#MerkleProof), [Vite server configuration](https://vite.dev/config/server-options). These references do not establish protocol conformance or external provider authorization.
