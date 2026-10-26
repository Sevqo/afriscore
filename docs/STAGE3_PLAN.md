# Stage 3 implementation plan
Owner: AfriCore engineering. Reviewed 2026-10-25.

Baseline b7879a9: Express/TypeScript, React/Vite, SQLite by default with PostgreSQL adapter; scoped workspace sessions/API keys, additive migrations, sandbox payment/evidence sources and 174 passing tests. Stage 2 gaps remain as recorded. Production provider proof, authoritative registries and independent issuer agreements do not exist. No database-free login currently exists; add isolated browser demo transport with sample records, without weakening server authentication.

1. Offline demo: public demo credentials/button, browser-local synthetic state, reset/exit, no external model calls or real credentials/funds.
2. Add migration 003-stage3 and passport/private identity, evidence references/assurance, manual review and correction workflow.
3. Select VC Data Model 2 + JOSE compact JWS (application/vc+jwt), ES256, explicit schema versions, encrypted managed custody, issuer governance/rotation and signed Bitstring Status Lists. No invented proof suite; no false OpenID conformance claims.
4. Build recipient-bound requests/grants, nonces, signed minimal-credential presentations, one-time access/revocation and access history. No field hiding presented as cryptographic selective disclosure.
5. Implement OpenZeppelin standard Merkle trees and immutable root-only Solidity contract, local EVM deployment/tests, confirmation/reconciliation service and independent verifier. Sepolia optional, mainnet disabled; no purchasing gas.
6. Integrate passport/credential/network/sharing/review UI into existing app, public verification/product pages and original SVG scenes.
7. Test cryptography/tampering/status/rotation/tenant/privacy/replay/contract failures and regression; document acceptance criteria and blockers individually. Run builds, contracts, API checks and browser mobile/desktop demo checks before commit/push.

Public standards researched 2026-10-25: W3C VC2, VC JOSE/COSE, DID Core, Bitstring Status List; OpenID4VCI/VP1 final; OpenZeppelin MerkleProof/tree; Hardhat3. Coherent JOSE profile with minimal signed claims is the initial implementation. OpenID complete wallet interoperability and cryptographic selective disclosure must remain explicitly gated unless a separate conformance demonstration passes.
