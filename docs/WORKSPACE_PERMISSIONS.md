# Workspace permissions

All protected application queries use server-derived identity, current membership or a hashed scoped API credential, plus organization and environment predicates. Default deny applies to inactive workspaces. New workspace types are restricted in access(), before individual service handlers.

| Kind | Scope |
| --- | --- |
| Personal | Own clients, invoices, payment records/requests, manual income, expenses and relevant reports |
| Business | Existing Stage 1–3 capabilities, subject to role, assurance and environment controls |
| Developer | Own sandbox applications, synthetic records/requests, credentials, webhooks, audit and documentation |

Personal cannot manage team invitations, integration credentials or enterprise trust operations. Developer cannot use production environment or team/business operations through its developer container. A Developer identity may separately join an employer's Business organization and receive that membership's role. Internal engineering and approved issuer authority remain separate allowlists/registries.

Existing role rules remain: owner/admin administration, finance financial writes, operations operational writes and viewer read-only access. Keys cannot request admin scope and cannot mint keys. Workspace type never overrides role denial or grants access to another organization's data. PostgreSQL RLS denies untrusted direct roles; the trusted backend owner enforces application scope. Do not describe this as per-user database RLS.

Revoked owned workspace records are retained. Repeating Personal/Developer onboarding checks current active owner membership and returns access denied instead of silently restoring membership or navigating to a historical container. Requests for reinstatement require review.
