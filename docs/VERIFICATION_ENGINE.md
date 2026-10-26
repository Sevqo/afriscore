# Verification engine
Owner: AfriCore engineering/security. Reviewed 2026-10-26.

Public /api/v1/trust/verify accepts an authorized compact credential and optional externally pinned public JWK. It reports signature, supported schema, issuer/key identity, validity period, current stored status, assurance, holder-binding limits and optional anchoring separately. Unknown keys are not fetched from URLs. With an explicit external public key, a valid signature remains unrecognized/requires_review with status unchecked. Private JWK inputs and jku/x5u redirects are rejected.

Public verification is bounded to30 checks/minute/IP (single-instance memory limit) in addition to existing global limits. Uploaded credential text is not retained or logged. Public reports omit underlying private financial records. The authenticated organization verification endpoint verifies an owned credential and stores minimal result metadata/audit events for history; public verification remains stateless.

Presentation verification checks managed-holder signature, known key state, audience, nonce, expiry, exact grant/token binding, current grant authorization and each included credential. Repeated technical verification of a copy is not a second disclosure; one-time access enforcement applies when retrieving the presentation. No bearer credential alone proves live holder possession.

Proof verification recomputes the randomized commitment, uses OpenZeppelin standard Merkle verification and queries the configured/pinned chain+contract. RPC unavailable, unbatched and insufficient-confirmation outcomes remain distinct. A database confirmed flag alone is not accepted as on-chain evidence.

Independent component: scripts/verify-credential.mjs uses Node crypto (separate implementation from jose API verification), fresh signed status snapshots, OpenZeppelin tree verification and optional direct RPC lookup. Run node scripts/verify-credential.mjs --file bundle.json --rpc URL --contract ADDRESS --issuer EXPECTED_URI. Metadata/snapshots must come from a separately trusted current source; a bundle cannot prove its own issuer authority. No external OpenID wallet/conformance suite has passed; see CREDENTIAL_ARCHITECTURE.md.
