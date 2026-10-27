# Online evaluation operations

One Render API instance owns webhook, operations and trust polling. Stop competing local polling against the shared development branch while evaluating online. Health checks never establish payment/provider readiness. Inspect structured backend logs, admin-only /v1/metrics, request IDs and Cloudflare Worker errors/latency. Never log request bodies, Authorization, gateway secrets, passwords, connection strings or raw financial evidence.

Backend /v1/readiness uses SELECT 1; public /v1/health is liveness. The gateway returns no-store JSON 503 when Render is asleep or unavailable. Retry after the backend wakes. Do not use artificial keepalive traffic to imply an always-on free worker.

Public application requests need the gateway credential, then ordinary scoped JWT/API-key authorization; gateway access never grants tenant access. Health/readiness remain readable for the hosting platform. No wildcard credentialed CORS is introduced. Cloudflare static responses add CSP, HSTS, frame/referrer/content-type controls.

No new custom domain, billing plan, live provider, external email credentials, storage bucket or blockchain publisher is enabled. External alert delivery and physical-device/mailbox testing remain explicit acceptance gates.
