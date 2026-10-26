# Stage 3 implementation and acceptance report
Owner: AfriCore engineering. Reviewed 2026-10-26. Baseline b7879a9; preserve Stage 1/2 and original database ownership. This is a sandbox beta, not a production-readiness declaration.

## Product
Integrated Business Passport, private identity/documents, evidence source/assurance, nine minimal credential types, issuer applications/operator governance, real ES256 issuance, encrypted managed custody, status/rotation/compromise response, relationship confirmation, transparent coverage index, recipient-bound requests/grants/presentations, verification reports/history and correction workflows. No ordinary account becomes an authoritative institution. Levels2/3 and government/source verification are not fabricated.

Database-free demo: /signin -> Enter demo workspace, or demo@africore.demo / AfriCoreDemo2026!. Browser state is synthetic, resettable and isolated from real server sessions. WebCrypto verifies a real sample signature while remote status/authority remains unavailable. Connected demo creates an isolated SQLite database automatically and supplies owner, issuer/reviewer and partner accounts; see DEMO_LOGIN.md. Existing personal accounts are not reset or modified.

## Blockchain and cryptography
VC2-JOSE-ES256-minimal-v1; jose API signing/verification, separately implemented Node crypto verifier, signed five-minute Bitstring Status List snapshots, randomized SHA256/Keccak ABI commitments and OpenZeppelin StandardMerkleTree/MerkleProof. Exact signed JWS bytes define the commitment input. No invented signature/hash/canonicalization suite is used.

The local EVM31337 contract is immutable and root-only with publisher access, pause and duplicate prevention. It accepts no funds and creates no tokens. Batches/retries/receipts/confirmations/reconciliation are persisted; independent verification queries the pinned chain/contract rather than trusting a DB flag.

Latest actual local test deployment (ephemeral, not Sepolia):
- Contract: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
- Deployment transaction: 0x2743ce5b09f2bbd16c8cfa810dc6f026e6627351cd58c398f61d11ef55af028a
- Compiler: 0.8.38+commit.1835d247.Emscripten.clang; deployment block 6
- Deployment gas: 601620; nominal local cost 342988106035860 wei (test units, no fiat value asserted)
- Anchoring transaction: 0xbcc76ae690e1c4cc0753cc2386074b45d8a5535fe2faa4b183692d8cd6096e63
- Anchored root: 0xc6595ce1d0b19d14766ee1fa32a29e7e5b9f2419fcbfa184b80b8675949bb41f
- Confirmations at verification: 1

Reproduce with npm run check:chain; it uses/stops its own loopback chain18545. Local resets invalidate deployment state. Sepolia11155111 is configurable but disabled by default; no authorized RPC/funded disposable publisher resources were supplied, so no public deployment/address/transaction or measured public-network cost is claimed. Mainnet IDs are rejected.

## Verification executed
The full SQLite Stage 1–3 run passed **194 tests /21 suites**, zero failures/skips, approximately33seconds. This includes 20 Stage 3 tests. The local contract test passed, and the self-contained local EVM pipeline passed contract plus 20 Stage 3 HTTP/crypto/privacy/anchoring tests and the independent CLI with signature valid, fresh snapshot active, inclusion valid and onchain confirmed. An earlier focused run encountered one stale HTTP keep-alive ECONNRESET; fresh-connection test requests and the complete rerun passed. No production mutation was retried to hide a failure.

TypeScript backend/site builds and contract inventory checks are completed again at the final gate. New runtime dependencies are locked; root audit was patched to zero findings (tmp0.2.7, current Zod/UUID overrides). Final results are appended below after the last code changes.

Browser QA: public demo credentials signed in without a backend; adding KES80 expense changed recorded outflows KES120 -> KES200 and movement KES1080 -> KES1000; reload preserved the change. Passport/credential UI rendered and browser ES256 verification returned valid signature with requires_review/current_remote_status_unavailable. Desktop/mobile observations and final screenshots are recorded at the final gate. Connected demo seeded through real normal auth/API routes in an isolated database.

## Master acceptance criteria
| # | Criterion | Actual status |
| --- | --- | --- |
|1|Preserve Stage1/2|Regression suite passes|
|2|Create Passport|Implemented, private by default|
|3|Org scoping|HTTP tenant/environment tests pass|
|4|Assurance distinctions|Levels/methods/limitations visible; no invented source verification|
|5|Approved signed issuance|Sandbox operator approval + holder authorization + real ES256|
|6|Issuer impersonation denied|Role/type/holder checks tested; institutional live onboarding gated|
|7|Cryptographic verification|API, browser sample and separate Node implementation|
|8|Expiry/revocation|Credential/key/grant checks, signed status lists and tests|
|9|Credential management|List/details/export/status history; production holder recovery gated|
|10|Specific sharing|Minimal credential selection and named-recipient grants|
|11|Unauthorized sharing denied|Recipient/purpose/audience/nonce/replay/expiry tests|
|12|Issuer/status inspection|Sanitized metadata plus separate technical/authority checks|
|13|Relationship verification|Separate authenticated counterparty, no independence guarantee|
|14|Transparent non-credit index|Versioned category-coverage methodology/snapshots|
|15|Private data off-chain|Only randomized roots/batch refs/publisher metadata on-chain|
|16|Genuine Merkle proofs|OpenZeppelin proofs + tamper tests|
|17|Independent root checking|Standalone RPC/contract verification passed locally|
|18|Modified proof rejection|Token/salt/commitment/inclusion checks|
|19|Local contracts tested|Access/zero/duplicate/inclusion/pause/no-funds tests passed|
|20|Testnet where resources available|Not deployed: authorized RPC/test funds/publisher unavailable|
|21|No customer-fund contracts|No payable/funds/token functionality; rejection tested|
|22|No cryptocurrency creation|No token/NFT/asset issuance|
|23|Documented developer API|Generated route inventory/shared input schemas + runbooks|
|24|Relevant webhooks|New events integrated with existing signed durable outbox; baseline delivery tests retained|
|25|Public verification|Credential upload/token reports and recipient-link/minimal-profile pages|
|26|Mobile layouts|Responsive implementation and focused viewport QA; full assistive-tech/physical-device audit remains|
|27|Tenant security tests|HTTP denials pass; external penetration audit not performed|
|28|Key management docs|Encrypted sandbox keys/rotation/compromise/recovery limits documented; production KMS gated|
|29|Compliance gaps|DPIA draft/legal/issuer/privacy/retention gate register recorded|
|30|Regression tests|Full 194 pass; PostgreSQL/Docker runtime not locally verified|

## Explicit incomplete acceptance and external gates
OpenID4VCI/VP complete authorization-server/wallet protocols and external conformance are **not implemented or claimed**. Independent JOSE verification is demonstrated; it is not an OpenID conformance test. Cryptographic selective disclosure/ZK is disabled; whole issuer-signed minimal credentials are the documented alternative. DID method/domain-resolution interoperability, real vetted issuer/source agreements, KMS/HSM/dual control, independent appeal process, malware scanning/physical purge/rights handling, production legal review and external security/contract audits remain launch gates. Further property/fuzz/reorg/nonce/load/distributed-worker qualification is required; a local successful test is not proof of public-network reliability.

Kai remains authorized runbook search with no autonomous trust actions; Compass retains milestone/gate metadata rather than live issue sync; Orbit adds private trust/batch observations without external pager/tracing transport. API response schemas are not universally field-complete SDK contracts. Large-workspace pagination/aggregation and full accessibility need qualification. Capital, lending/financing approvals, tokens, DeFi and mainnet remain excluded.

## Engineering/deployment
Migration003-stage3 is additive; source files src/stage3, chain/contracts/scripts, standalone verifier, demo transports/server and integrated React workspace/public views. Existing auth/access/payment/ledger/outbox boundaries are reused. Seven original SVG scenes extend the existing media generator (17 total), without rebuilding the site or copying third-party art.

Run npm ci; npm --prefix website ci; npm run build; npm --prefix website run build; npm start. Immediate demos: npm run demo:web or npm run demo:server. Quality gates: npm test, typecheck, validate:openapi/platform, website build and check:chain. CI includes the local-EVM pipeline. Back up DB/encryption keys before migration; rollback binaries without dropping signed history. Production trust issuance/anchoring is disabled; do not bypass that gate with labels or configuration. See DEPLOYMENT.md and domain runbooks for continuation.

## Final release gate — 2026-10-26
- npm test: **194/194 passed**,21 suites, no failures/skips (~33.1seconds);20 Stage 3 tests include separate demo-cookie isolation and material-identity-change invalidation.
- npm run check:chain: contract test +20 Stage 3 integration tests +independent Node CLI passed. The harness starts/stops its own local EVM; no manual chain prerequisite.
- Backend typecheck/build, website TypeScript/Vite build, legacy59-operation and workspace136-operation contracts passed. Website51 modules; JS~433KB/~125KB gzip, CSS~34KB/~8KB gzip.
- Current full and production-only npm audits: **zero vulnerabilities** after locked transitive patches.
- Browser: offline public-password login, persistent expense recalculation, real WebCrypto sample verification, desktop/mobile Passport and connected owner login/credential checks passed. Mobile390px document width375px; temporary viewport override reset. Observed Passport-card text contrast was corrected.
- Connected demo verification now queries an actual running local31337 anchor: contract 0x5FbDB2315678afecb367f032d93F642f64180aa3, transaction 0xa27c08f0e12a7a07f42f319a4dc9fc6ee736ffa1620189c467825e64325c7419, root 0xebd018fe697876729e3e49da0f6e49560371961dd77e78f2fae9f4f6ff32940d, confirmations1; inclusion/onchain both true. Nominal local publication gas73216, cost71149124839936wei (no real monetary value). This is distinct from the ephemeral CI-style test deployment above.
- Screenshots saved in the task visualization directory: stage3-connected-passport.png, stage3-connected-verification.png, stage3-passport-mobile.png. No full assistive-technology or physical-phone audit is claimed.
- Normal .env/private keys/databases/scratch files stay ignored. Connected demo uses a dedicated cookie and database and leaves normal application accounts intact.
- PostgreSQL/Docker runtime remains unverified locally; existing PostgreSQL CI retained. Production/testnet/OpenID/KMS/independent legal/security gates remain explicitly incomplete.
