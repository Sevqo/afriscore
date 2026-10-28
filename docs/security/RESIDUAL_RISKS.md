# Residual risks and external gates

28 October 2026. These are explicit limitations, not closed vulnerabilities.

1. **Privileged MFA:** Managed Better Auth's supported plugin contract does not expose it. Public internal routes are denied. Qualify an MFA-enforcing internal access provider and enrollment/recovery policy before opening privileged interactive access. Do not add arbitrary Better Auth plugins to a managed server or replace existing identity without a reviewed migration.
2. **Password breach screening:** The owner retained eight characters. Stronger local checks ship; HIBP prefix egress was rejected without specific consent and remains unimplemented. Managed provider policy is independently controlled.
3. **Historical encryption:** Compatible readers were deployed and version-2 writes activated, with an actual hosted ciphertext check. Historical records remain legacy until individually re-encrypted with backup/audit. Never discard previous keys required to read retained records or roll back to a legacy-only decoder.
4. **Ledger freshness:** Independently stored expected checkpoints are supported but no immutable external custody/scheduler was configured. A database-local chain cannot detect rollback of itself and its own head to a consistent historical snapshot.
5. **KYC lifecycle:** Pre-response audit and private authorization are corrected. Malware scanning/quarantine, retention execution, legal holds and full restore acceptance remain operational work.
6. **Webhook qualification/scaling:** Hosted destinations remain disabled until a receiver is explicitly qualified. Per-process busy guards are not distributed leases. Retried delivery is at least once; receivers must deduplicate.
7. **Abuse/scaling:** Local IP/auth limits and single-instance workers remain the current deployment model. Distributed limits, queues/leases and signup bot controls are required before horizontal scaling. Global AI reservations bound cost but are not provider billing reconciliation or a funded provider account.
8. **Provider boundaries:** No live payment, financing, escrow, eTIMS or mainnet workflow is activated. Live provider/account idempotency namespaces need their own authoritative contract. Legacy major-unit decimal APIs remain compatibility surfaces.
9. **Vendor and dependency assurance:** Local Better Auth patching does not patch Neon's managed service. Confirm vendor-side advisory handling. The transitive deepmerge email-rendering dependency has an unpatched low-severity advisory; the application does not use its server-side email rendering. Keep monitoring rather than claiming zero advisories.
10. **Verification limits:** Synthetic managed-session tests do not replace new-account mailbox/device checks, independent penetration testing, an actual full backup restore drill, geographically distinct client-IP acceptance, professional smart-contract audit or qualified Kenyan privacy/automated-decision legal review.

No production branch or paid plan was changed, customer history was not reset, and no external AI call was billed during testing. Deployment-specific outcomes are in SECURITY_TEST_RESULTS.
