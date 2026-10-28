# Encryption and key management

`src/platform/crypto.ts` uses Node AES-256-GCM, random 96-bit nonces and a SHA-256-derived existing server key. New envelopes identify the key version and bind authenticated data to key ID plus record context. Contexts cover trust objects, signing keys, credentials, disclosures, evidence, endpoint secrets and Merkle proofs. Swapping ciphertext between tenants/records fails authentication.

`AFRICORE_ENCRYPTION_KEY_ID` selects the active ID; `AFRICORE_ENCRYPTION_PREVIOUS_KEYS` is a private JSON read-key map. Keep it in a backend secret store. Do not publish it, rotate the current key without retaining necessary read keys, or put keys in frontend variables. Legacy three-part envelopes remain readable. Migration 006 does not rotate keys or blindly re-encrypt stored evidence.

Rollout: back up first; deploy compatible readers with production `AFRICORE_ENCRYPTION_WRITE_VERSION=1` (default); verify deployment and existing ciphertext reads; set 2 only once old processes drain. After version-2 writes, any rollback must retain this reader. Lowering the write version does not make existing version-2 records readable by old code. Preserve additive schema and existing sessions. A bulk re-encryption task needs its own inventory, validated backup, audit and optimistic record predicates.

Current hosted state: this staged rollout completed on 28 October 2026. Version 2 is active in the existing Render service and mirrored in render.yaml. A private synthetic Passport proved correct-context decryption and wrong-context rejection against actual hosted ciphertext. Historical rows were not bulk re-encrypted; see SECURITY_TEST_RESULTS for deployment identifiers.

`ID_HASH_SALT` remains the deployed variable name, now a private HMAC key. The HMAC input includes a versioned domain, identifier type and normalized value. Exact legacy matches upgrade on resubmission with audit, preserving record IDs and historical ledger bytes. Legacy hashes cannot be re-keyed without the original input; do not store raw identifiers to simplify rotation.

The guarded development maintenance script exports an encrypted row snapshot using the existing key with a separate backup derivation domain. It verifies encrypted readback and branch/endpoint. It is not a full PostgreSQL schema/auth/PITR backup or a demonstrated restore drill. Retain the matching private key securely outside Git. No key rotation occurred in this release.
