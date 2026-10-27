# Cloudflare deployment

From the repository root install root, website and deploy/cloudflare dependencies with npm ci in each directory. Run the existing gates, then npm --prefix website run build and npm --prefix deploy/cloudflare test. Run npm --prefix deploy/cloudflare run check and npm --prefix deploy/cloudflare run deploy. Wrangler configuration lives in deploy/cloudflare/wrangler.jsonc. The Vite plugin is intentionally unnecessary: Vite emits static assets and Wrangler deploys a separate Fetch gateway; the Express application is not bundled into an edge runtime.

Set public Wrangler vars BACKEND_ORIGIN to the actual Render HTTPS origin and NEON_AUTH_ORIGIN to the existing provider origin. Store AFRICORE_GATEWAY_SECRET using wrangler secret put, never vars. No database credentials belong in Cloudflare or VITE variables. Existing Workers/services and unrelated DNS must remain unchanged.

run_worker_first ensures APIs cannot fall through to SPA HTML. Private responses and HTML have no-store. Content-hashed assets retain static caching. Direct app route refresh uses SPA fallback; prerendered public pages remain available. The gateway preserves auth/body/query, strips caller-supplied forwarding/gateway headers, rejects upstream redirects and wake-up HTML, and returns a bounded JSON 503.

The manual GitHub Actions evaluation workflow installs, verifies and deploys main only. Configure its protected evaluation environment with a narrowly scoped CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID variable and existing RENDER_DEPLOY_HOOK secret before enabling it. Do not claim automatic GitHub integration until these are installed. The dashboard public-repository clone flow creates a second repository and is deliberately not used.
