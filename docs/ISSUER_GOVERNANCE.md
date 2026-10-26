# Issuer governance
Owner: Trust operations/security. Reviewed 2026-10-26.

Application records organization ownership, display name, requested types and authority statement. Workspace owner/admin may apply. Verified AFRICORE_TRUST_OPERATOR_EMAILS allowlist controls separate review routes. Sandbox approval is clearly approved_sandbox with recognized:false and no institutional authority. Public registry metadata exposes public keys, key state, type permissions and sanitized review method/time, not application narratives, private keys or operator reasons.

Issuance requires both current admin membership of the approved issuing organization and an unexpired holder-authorized request. The issuer cannot select an arbitrary foreign tenant and read its private evidence. Type/evidence/category consistency, active status, source hash and retention are checked. A valid signature never upgrades a self-attestation to source verification.

Operator can suspend/revoke an issuer. Current verification rejects credentials from suspended/revoked issuers. Owners can rotate sandbox keys with a recorded reason; compromise deactivates old keys and revokes dependent credentials. Retired keys remain available to verify historic signatures. See KEY_MANAGEMENT.md for incident/recovery procedure.

Live governance is not implemented: independent legal/domain/representative checks, binding issuer agreements, type-specific delegated authority, separation of reviewer duties and appeals panel require real operating policy and review. No bank, government registry, courier or financial institution is claimed as a participant. A sandbox operator may approve a synthetic test issuer; that is not institutional onboarding.

Disputes/corrections are org-scoped, retain statements/history and allow an operator to uphold, reject or request information. Upheld evidence corrections mark the source disputed and suspend dependent active credentials; signed payloads/anchors remain intact. Reissuance needs a fresh holder request. Appeals/escalation case management and external adjudication remain documented launch gates.
