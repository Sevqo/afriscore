# Privacy and sharing
Owner: AfriCore privacy/security. Reviewed 2026-10-26.

Passports are private by default. Public profiles contain only explicit minimal fields. Private identity documents, encrypted managed credentials and relationships require workspace authorization. Raw financial records are referenced off-chain and are not uploaded to public IPFS or a blockchain.

A verification request names the requester organization, holder, specific credential types, purpose, expiry and nonce. Holder reviews exactly which minimal credentials will be disclosed. Grant creation enforces holder ownership, active credentials, matching recipient/request/purpose/types, request freshness and explicit consent. Unrequested extra credential types are denied for linked requests. Pending issuance authorization can be cancelled before signing.

Sharing grants use hashed256-bit bearer secrets, a required named recipient organization, expiry, optional one-time use and revocation. Link retrieval additionally requires authenticated membership of the named recipient. One-time consumption uses an atomic conditional update. Access is logged. URLs are redacted in normal/error logs; maintain no-referrer and proxy redaction. A token by itself cannot grant an unrelated account access.

Signed presentations include audience, nonce, expiry and exact authorization binding. Recipient access cannot substitute another request or purpose. Revocation blocks future authorization; copies already disclosed cannot be erased remotely. Offline status/metadata snapshots have explicit freshness limits.

Cryptographic selective disclosure/zero-knowledge proofs are disabled. Whole issuer-signed minimal-claim credentials are shared, and the preview includes their entire claim set. Hiding fields in the UI is not presented as selective disclosure. There are no signing private keys in browser localStorage. Browser demo stores only synthetic records and a public example credential; its signature is checked with WebCrypto but remote status/authority remain unavailable.

Documents support TXT/PDF/PNG/JPEG up to250KB, encoding/signature validation, SHA256, encrypted storage and authenticated attachment downloads.365-day access windows are enforced for downloads/issuance; physical purge, malware scanning, legal holds, processor agreements, rights handling and backup erasure remain launch gates. See COMPLIANCE_GAPS_STAGE3.md for the DPIA draft.
