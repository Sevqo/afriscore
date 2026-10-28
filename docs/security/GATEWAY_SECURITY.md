# Gateway security

Canonical design and threat model: [report B/H](SECOND_PASS_REMEDIATION.md). Public customer host: `africore-web.cypriankiprop41.workers.dev`; backend origin: `africore-api.onrender.com`.

The backend requires the independent `AFRICORE_GATEWAY_SECRET` in production. Only exact health/readiness GET probes are exempt and return non-sensitive status. `AFRICORE_GATEWAY_SECRET_PREVIOUS` permits a coordinated short rotation window; remove it after both hosts use the new credential. Never reuse database or encryption keys as gateway credentials.

The Worker removes client-supplied forwarding/gateway metadata and writes the canonical client address. Application IP handling only trusts this metadata after gateway authentication, validates it, then removes it. Keeping `TRUST_PROXY` for platform compatibility does not make arbitrary X-Forwarded-For authoritative. No public IP-debug endpoint is provided. See [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

Public internal and legacy administrative routes are denied. Private operators need the backend gateway credential AND the existing verified operator identity/admin authentication; no private host or Cloudflare Access application was provisioned by this change. Do not expose a gateway credential to a browser to restore operator UI access.

Worker automatic invocation logs are disabled, per [Cloudflare log configuration](https://developers.cloudflare.com/workers/observability/logs/workers-logs/). Ordinary app logs redact capability paths/queries. Check independently configured account log sinks before enabling request logging elsewhere.
