# Business Passport
Owner: AfriCore engineering/product. Reviewed 2026-10-26.

The existing Business workspace now has Business Passport navigation: Overview, Business Identity, Credentials, Trust Evidence, Business Network, Verification Requests, Shared Access, Activity History, Privacy & Security, Issuer Desk and restricted Trust Operations. Roles reuse existing read/admin capabilities; issuer signing additionally requires separately approved sandbox issuer ownership and a holder-authorized request.

A Passport has a stable UUID linked to organization+environment, an external urn:uuid subject URI, display name/category/industry/country and separate private identity reviews. A URN is an identifier, not a claim to implement a DID method. DID Core was evaluated; did:web requires independently controlled deployment/domain/key resolution that is not yet available. No user wallet or seed phrase is required.

Creation is private by default. Public-profile opt-in reveals only display name, category, industry, country, reference and precise review status at /passport/:id. Private registration information, documents, credentials, relationships and financial records are excluded. A secure verification link starts authenticated recipient disclosure rather than exposing private credentials in a QR payload. Public profile can be disabled.

Review statuses implemented: not_submitted, pending, additional_information_required, document_reviewed, rejected and revoked; expiry is recorded and must be considered in policy. Source verification is unavailable without an authorized registry. Document review does not prove government registration or representative authority. Changing Passport display name/country resets review status and suspends active identity/review credentials.

Overview displays credentials, expiring credentials, grants, relationships, source coverage and the deterministic coverage index. Insufficient evidence is not an adverse judgment. Index snapshots retain methodology version. Historical financial records are referenced, not copied wholesale. Corrected evidence and credential statuses preserve signed history.

For immediate access, see DEMO_LOGIN.md. Browser demo needs no backend/database; connected demo creates an isolated SQLite file automatically. Production rollout requires all gates in COMPLIANCE_GAPS_STAGE3.md. This is a sandbox beta, not a verified institutional network.
