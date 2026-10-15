// Inyecta el HTML de cada ruta en el index que armó Vite, para que el primer
// response ya traiga el contenido (crawlers y previews de un link).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const dist = join(root, 'dist');
const template = await readFile(join(dist, 'index.html'), 'utf8');
const { render, pageUrl } = await import(new URL('../dist/server/entry-server.js', import.meta.url).href);

const routes = [
  ['/', 'index.html'],
  ['/terminos', 'terminos/index.html'],
  ['/privacidad', 'privacidad/index.html'],
  ['/404', '404.html'],
];

function applyMeta(html, meta) {
  const url = pageUrl(meta);
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`)
    .replace(/name="description" content="[^"]*"/, `name="description" content="${meta.description}"`)
    .replace(/property="og:title" content="[^"]*"/, `property="og:title" content="${meta.title}"`)
    .replace(/property="og:description" content="[^"]*"/, `property="og:description" content="${meta.description}"`)
    .replace(/property="og:url" content="[^"]*"/, `property="og:url" content="${url}"`)
    .replace(/rel="canonical" href="[^"]*"/, `rel="canonical" href="${url}"`)
    .replace(/name="twitter:title" content="[^"]*"/, `name="twitter:title" content="${meta.title}"`)
    .replace(/name="twitter:description" content="[^"]*"/, `name="twitter:description" content="${meta.description}"`);
  if (meta.noindex) {
    out = out
      .replace(/\s*<link rel="canonical"[^>]*>/, '')
      .replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
  }
  return out;
}

for (const [url, file] of routes) {
  const { html, meta } = render(url);
  const page = applyMeta(template, meta).replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  const target = join(dist, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, page);
  console.log('prerender', url, '→', file, html.length);
}
