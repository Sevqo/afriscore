// Only the gateway credential belongs at the edge. Database/provider secrets stay in Node.
import publicPaths from './public-paths.json' with { type: 'json' };
const publicPages = new Set(publicPaths);
function origin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password)
    throw new Error('Expected an exact HTTPS origin');
  return url;
}
function secured(response, { privateResponse = false, html = false, authOrigin = '' } = {}) {
  const result = new Response(response.body, response);
  result.headers.set('X-Content-Type-Options', 'nosniff');
  result.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  result.headers.set('X-Frame-Options', 'DENY');
  result.headers.set('Strict-Transport-Security', 'max-age=31536000');
  result.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (privateResponse || html) result.headers.set('Cache-Control', 'no-store');
  if (privateResponse) {
    result.headers.delete('Access-Control-Allow-Origin');
    result.headers.delete('Access-Control-Allow-Credentials');
  }
  if (html) result.headers.set('Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' ${authOrigin}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`);
  return result;
}
function unavailable() {
  return secured(Response.json({ error: 'backend_unavailable', message: 'The service is temporarily unavailable. Please retry shortly.' }, { status: 503 }), { privateResponse: true });
}
export async function handle(request, env, upstreamFetch = fetch) {
  const url = new URL(request.url);
  if (url.protocol !== 'https:') { url.protocol = 'https:'; return Response.redirect(url.href, 308); }
  const api = /^\/(?:api|v1)(?:\/|$)/.test(url.pathname);
  if (api) {
    // Deny encoded separators, dot segments, repeated slashes and unknown API
    // roots before forwarding. Legacy/admin routes require a separate channel.
    const path=url.pathname;
    const publicRoot=/^\/api\/(?:auth(?:\/|$)|openapi\.json$|v1\/(?:organizations(?:\/|$)|workspaces(?:\/|$)|invitations\/accept$|checkout\/|callbacks\/|buyer\/|trust\/|\.well-known\/))/.test(path);
    if (/%|\\|\/\//.test(path)||(!publicRoot&&!['/v1/health','/v1/readiness'].includes(path)))return secured(Response.json({error:'not_found'},{status:404}),{privateResponse:true});
    if (path.split('/').some(part=>part.toLowerCase()==='internal'))return secured(Response.json({error:'not_found'},{status:404}),{privateResponse:true});
    if (!env.BACKEND_ORIGIN || !env.AFRICORE_GATEWAY_SECRET || env.AFRICORE_GATEWAY_SECRET.length < 32) return unavailable();
    try {
      const upstream = origin(env.BACKEND_ORIGIN);
      upstream.pathname = url.pathname; upstream.search = url.search;
      const headers = new Headers(request.headers);
      for (const name of ['host', 'x-africore-gateway-secret', 'x-africore-client-ip', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-for', 'forwarded', 'x-real-ip']) headers.delete(name);
      headers.set('x-africore-gateway-secret', env.AFRICORE_GATEWAY_SECRET);
      headers.set('x-forwarded-proto', 'https');
      headers.set('x-forwarded-host', url.host);
      // One canonical client address, never a caller-supplied proxy chain.
      const client = request.headers.get('CF-Connecting-IP');
      if (client) {headers.set('x-forwarded-for', client);headers.set('x-africore-client-ip',client);}
      const response = await upstreamFetch(new Request(upstream, { method: request.method, headers,
        body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual', signal: AbortSignal.timeout(90000), duplex: 'half' }), { cf: { cacheTtl: 0, cacheEverything: false } });
      // Never turn a sleeping backend's HTML loading page into an API success.
      if ((response.headers.get('Content-Type') || '').includes('text/html')) return unavailable();
      if (response.status >= 300 && response.status < 400) return unavailable();
      return secured(response, { privateResponse: true });
    } catch { return unavailable(); }
  }
  if (url.pathname === '/internal' || url.pathname.startsWith('/internal/')) return new Response('Not found', { status: 404 });
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const normalized = url.pathname.replace(/\/+$/, '') || '/';
  const application = /^(?:\/app(?:\/|$)|\/checkout\/|\/buyer\/|\/trust\/share\/|\/passport\/|\/sign-up\/)/.test(normalized) || ['/get-started','/signup','/login','/signin','/forgot-password','/auth/callback','/recover','/verify','/reset','/demo','/verify-credential'].includes(normalized);
  const asset = /\.[a-z0-9]+$/i.test(normalized);
  if (!publicPages.has(normalized) && !application && !asset) return secured(new Response('Page not found', {status:404}));
  let authOrigin = '';
  if (env.NEON_AUTH_ORIGIN) { try { authOrigin = origin(env.NEON_AUTH_ORIGIN).origin; } catch { return unavailable(); } }
  const response = await env.ASSETS.fetch(request);
  if (asset && (response.headers.get('Content-Type') || '').includes('text/html')) return secured(new Response('Asset not found', {status:404}));
  return secured(response, { html: (response.headers.get('Content-Type') || '').includes('text/html'), authOrigin });
}
export default { fetch(request, env) { return handle(request, env); } };
