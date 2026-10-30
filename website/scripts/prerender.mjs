import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'),
  dist = path.join(root, 'dist');
// Container website stages do not copy the deployment tooling directory.
await fs.mkdir(path.resolve(root, '../deploy/cloudflare'), { recursive: true });
const server = await createServer({
  root,
  configFile: false,
  plugins: [react()],
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
const esc = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;');
globalThis.window = { location: { pathname: '/', search: '' } };
globalThis.location = globalThis.window.location;
try {
  const { publicPaths, renderPublic } =
    await server.ssrLoadModule('/src/prerender.tsx');
  const template = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  await fs.writeFile(path.resolve(root, '../deploy/cloudflare/public-paths.json'), JSON.stringify([...new Set(publicPaths)].sort(), null, 2) + '\n');
  const origin = process.env.AFRICORE_SITE_URL || '';
  for (const route of [...new Set(publicPaths)]) {
    const rendered = renderPublic(route),
      canonical = origin ? new URL(route, origin).href : route;
    let html = template
      .replace(
        /<title>[\s\S]*?<\/title>/,
        '<title>' + esc(rendered.title) + '</title>',
      )
      .replace(
        /<meta\s+name="description"[^>]*>/,
        '<meta name="description" content="' + esc(rendered.description) + '">',
      )
      .replace(
        '<div id="root"></div>',
        '<div id="root" data-route="' +
          esc(route) +
          '">' +
          rendered.html +
          '</div>',
      )
      .replace(
        '</head>',
        '<link rel="canonical" href="' + esc(canonical) + '"></head>',
      );
    html = html
      .replace(
        /<meta property="og:title"[^>]*>/,
        '<meta property="og:title" content="' + esc(rendered.title) + '">',
      )
      .replace(
        /<meta property="og:description"[^>]*>/,
        '<meta property="og:description" content="' +
          esc(rendered.description) +
          '">',
      );
    if (!html.includes('name="description"'))
      html = html.replace(
        '</head>',
        '<meta name="description" content="' +
          esc(rendered.description) +
          '"></head>',
      );
    const structured = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: rendered.title,
      description: rendered.description,
      url: canonical,
      inLanguage: 'en',
    }).replaceAll('<', '\\u003c');
    html = html.replace('</head>', '<meta property="og:url" content="' + esc(canonical) + '"><script type="application/ld+json">' + structured + '</script></head>');
    const target = route === '/' ? dist : path.join(dist, route.slice(1));
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'index.html'), html);
  }
  const sitemap = [...new Set(publicPaths)]
    .map(
      (route) =>
        '<url><loc>' +
        esc(origin ? new URL(route, origin).href : route) +
        '</loc></url>',
    )
    .join('');
  if (origin)
    await fs.writeFile(
      path.join(dist, 'sitemap.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        sitemap +
        '</urlset>',
    );
  await fs.writeFile(
    path.join(dist, 'robots.txt'),
    'User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /checkout/\nDisallow: /buyer/\nDisallow: /trust/share/\n' +
      (origin ? 'Sitemap: ' + new URL('/sitemap.xml', origin).href + '\n' : ''),
  );
  console.log(
    'Prerendered ' +
      new Set(publicPaths).size +
      ' public education/product pages with route-specific metadata.',
  );
} finally {
  await server.close();
}
