import { expect, test } from '@playwright/test';
test('public production page has server OG metadata, one contact and no cached catalog after deactivation', async ({ page, request, context, baseURL }, testInfo) => {
  await request.post('/__test__/catalog?active=true');
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const privateRequests: string[] = [];
  page.on('request', req => { if (/\/api\/(me|inventory|clients|sales)(?:\/|$)/.test(new URL(req.url()).pathname)) privateRequests.push(req.url()); });
  const response = await page.goto('/c/tienda-publica-qa');
  expect(response?.headers()['cache-control']).toBe('no-store');
  const html = await response!.text();
  expect(html).toContain('property="og:title" content="Tienda pública QA · Lista de precios"');
  expect(html).toContain(`property="og:image" content="${baseURL}/api/public/catalog/tienda-publica-qa/preview.png"`);
  await expect(page.getByRole('heading', { name: 'Tienda pública QA' })).toBeVisible();
  await expect(page.getByText('US$ 920')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Escribinos por WhatsApp' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByTestId('login-email')).toHaveCount(0);
  expect(privateRequests).toEqual([]);
  expect(await page.evaluate(async () => {
    const keys = await caches.keys();
    const requests = (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(req => new URL(req.url).pathname)))).flat();
    return requests.some(path => path.startsWith('/c/') || path.startsWith('/api/public/catalog'));
  })).toBe(false);
  await request.post('/__test__/catalog?active=false');
  await page.reload();
  await expect(page.getByText('Esta lista de precios no está disponible')).toBeVisible();
  await expect(page.getByText('US$ 920')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveCount(1);
  if (testInfo.project.name !== 'iphone-webkit') {
    await context.setOffline(true);
    // A catalog document must fail offline instead of receiving the cached app shell/metadata.
    const result = await page.goto('/c/tienda-publica-qa').catch(() => null);
    expect(result).toBeNull();
    await context.setOffline(false);
  }
});
