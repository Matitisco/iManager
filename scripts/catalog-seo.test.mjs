import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpaHandler } from './serve-spa.mjs';
async function renderCatalog(upstream) {
  const root = await mkdtemp(join(tmpdir(), 'catalog-seo-'));
  await writeFile(join(root, 'index.html'), '<html><head><title>iManager</title><meta name="description" content="app"></head><body><div id="root"></div></body></html>');
  const result = {};
  const response = { writeHead(status, headers) { result.status = status; result.headers = headers; }, end(body) { result.body = body; } };
  const fetchImpl = async (url) => { assert.equal(url, 'https://api.example.com/api/public/catalog/mi-tienda'); return upstream; };
  try { await createSpaHandler({ root, fetchImpl, catalogApiBase: 'https://api.example.com' })({ url: '/c/mi-tienda', method: 'GET', headers: { host: 'app.example.com', 'x-forwarded-proto': 'https' }, socket: {} }, response); return result; }
  finally { await rm(root, { recursive: true, force: true }); }
}
test('catalog HTML includes escaped server-side SEO and OG metadata without private fields or rows', async () => {
  const result = await renderCatalog(Response.json({ active: true, store: { name: 'Mi <Tienda> & vos' }, items: [{ model: 'iPhone 15' }] }));
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.match(result.body, /Mi &lt;Tienda&gt; &amp; vos · Lista de precios/);
  assert.match(result.body, /property="og:image" content="https:\/\/api.example.com\/api\/public\/catalog\/mi-tienda\/preview.png"/);
  assert.match(result.body, /property="og:url" content="https:\/\/app.example.com\/c\/mi-tienda"/);
  assert.doesNotMatch(result.body, /iPhone 15|cost|imei|supplier/);
  assert.equal((result.body.match(/<title>/g) || []).length, 1);
});
test('revoked and unavailable catalogs are noindex, never cached', async () => {
  const result = await renderCatalog(new Response('{}', { status: 404 }));
  assert.equal(result.status, 404); assert.match(result.body, /name="robots" content="noindex"/); assert.equal(result.headers['cache-control'], 'no-store');
});
