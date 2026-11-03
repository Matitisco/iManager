// Opt-in production-build QA. Only a disposable loopback backend is accepted.
// No traces, screenshots, request payloads or identity tokens are persisted.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { createSpaHandler } from './serve-spa.mjs';

const root = resolve(process.env.CSP_BUILD_DIR || 'dist');
const config = JSON.parse(await readFile(resolve(root, 'csp-config.json'), 'utf8'));
const api = new URL(config.apiOrigin);
const port = Number(process.env.CSP_PORT);
assert.ok(api.hostname === '127.0.0.1' && Number(api.port) > 20000, 'Build must target an exclusive loopback backend above port 20000');
assert.ok(port > 20000 && port < 65536, 'Set CSP_PORT to an exclusive loopback port above 20000');
const base = `http://127.0.0.1:${port}`;
const email = 'dueno@imanager.local';
const payload = { uid: 'test-dueno-imanager-local', email, name: 'CSP QA', emailVerified: true };
const localAuth = `Bearer test.${encodeURIComponent(JSON.stringify(payload))}`;
const now = Math.floor(Date.now() / 1000);
// Synthetic Firebase REST response; accepted only by this browser fixture.
const idToken = [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({ sub: payload.uid, user_id: payload.uid, iat: now, exp: now + 3600, auth_time: now, email, email_verified: true, firebase: { sign_in_provider: 'password' } })).toString('base64url'), 'fixture'].join('.');
const remoteConfig = { sessionRecording: { endpoint: '/s/', sampleRate: 1, minimumDurationMilliseconds: 0 }, capturePerformance: false, supportedCompression: ['gzip-js'], featureFlags: {} };
const routes = ['dashboard', 'comercial/ventas', 'comercial/canjes', 'comercial/devoluciones', 'stock/equipos', 'stock/control', 'stock/catalogo', 'atencion/clientes', 'atencion/servicio', 'finanzas/proveedores', 'finanzas/gastos', 'analisis/reportes', 'analisis/resumen-periodico', 'analisis/comisiones', 'analisis/historial', 'analisis/fallas', 'cuenta/notificaciones', 'cuenta/ayuda', 'cuenta/configuracion', 'plan'];
const browser = await chromium.launch({ executablePath: process.env.CSP_CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

try {
  // Verify the exact same candidate/build in this order before rollout.
  for (const reportOnly of [true, false]) {
    const server = createServer(createSpaHandler({ root, basicAuth: () => true, cspReportOnly: reportOnly,
      fetchImpl: async url => new URL(url).origin === api.origin ? fetch(url) : new Response('<!doctype html><title>Local Firebase helper</title>', { headers: { 'content-type': 'text/html' } }),
    }));
    await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'allow',
      userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`,
    });
    const violations = [];
    const requests = [];
    const consoleViolations = [];
    try {
      await context.exposeBinding('__cspViolation', (_source, value) => violations.push(value));
      await context.addInitScript(() => {
        // Analytics intentionally disables itself for automation; enable it only
        // inside this isolated fixture. All provider traffic is fulfilled below.
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        addEventListener('securitypolicyviolation', event => window.__cspViolation({
          directive: event.effectiveDirective, disposition: event.disposition,
          blocked: /^https?:/.test(event.blockedURI) ? new URL(event.blockedURI).origin : event.blockedURI,
        }));
      });
      // Every external request is intercepted. Never send analytics or auth data.
      await context.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === base) return route.continue();
        if (url.origin === api.origin) {
          return route.continue({ headers: { ...request.headers(), ...(request.headers().authorization ? { authorization: localAuth } : {}) } });
        }
        requests.push({ host: url.hostname, type: request.resourceType(), path: url.pathname.replace(/phc_[^/]+/, 'fixture') });
        const headers = { 'access-control-allow-origin': base, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-credentials': 'true' };
        const fulfill = (body, contentType = 'application/json') => route.fulfill({ status: 200, headers, contentType, body });
        if (request.method() === 'OPTIONS') return fulfill('');
        if (url.hostname.includes('posthog.com') || url.origin === config.posthogOrigin) {
          if (url.pathname.endsWith('/config.js')) {
            // The build uses only a synthetic public project identifier for QA.
            const token = url.pathname.split('/')[2];
            return fulfill(`window._POSTHOG_REMOTE_CONFIG = {${JSON.stringify(token)}: {config: ${JSON.stringify(remoteConfig)}}};`, 'text/javascript');
          }
          if (/\/(lazy-recorder|recorder|recorder-v2)\.js$/.test(url.pathname)) {
            const name = url.pathname.split('/').pop();
            return fulfill(await readFile(resolve('node_modules/posthog-js/dist', name), 'utf8'), 'text/javascript');
          }
          return fulfill(JSON.stringify(url.pathname.endsWith('/config') ? remoteConfig : { status: 1, featureFlags: {} }));
        }
        if (url.hostname === 'identitytoolkit.googleapis.com') {
          if (url.pathname.includes('accounts:signInWithPassword')) return fulfill(JSON.stringify({ localId: payload.uid, email, displayName: 'CSP QA', idToken, refreshToken: 'local-fixture', expiresIn: '3600', registered: true }));
          if (url.pathname.includes('accounts:lookup')) return fulfill(JSON.stringify({ users: [{ localId: payload.uid, email, displayName: 'CSP QA', emailVerified: true, providerUserInfo: [{ providerId: 'password', rawId: email, email }] }] }));
          return fulfill('{}');
        }
        if (request.resourceType() === 'image') return fulfill('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', 'image/svg+xml');
        if (url.hostname === 'fonts.googleapis.com') return fulfill('', 'text/css');
        if (request.resourceType() === 'document') return fulfill('<!doctype html><title>Local auth fixture</title>', 'text/html');
        if (request.resourceType() === 'script') return fulfill('/* provider fixture */', 'text/javascript');
        return fulfill(JSON.stringify({ venta: 1000, compra: 990 }));
      });
      const page = await context.newPage();
      page.on('console', message => { if (/violat.*(content security|Content-Security-Policy)|Refused to (load|execute|connect|create)/i.test(message.text())) consoleViolations.push(message.type()); });
      const response = await page.goto(base);
      const headers = response.headers();
      assert.ok(headers[reportOnly ? 'content-security-policy-report-only' : 'content-security-policy'].includes("default-src 'self'"));
      await expect(page.getByTestId('login-email')).toBeVisible();
      await page.getByTestId('login-email').fill(email);
      await page.getByTestId('login-password').fill('test123456');
      await page.getByTestId('login-submit').click();
      await expect(page.locator('.desk-app')).toBeVisible({ timeout: 30000 });
      for (const route of routes) {
        await page.evaluate(route => { location.hash = `#/${route}`; }, route);
        await expect(page.locator('.desk-app')).toBeVisible();
        await page.waitForTimeout(300);
      }
      // Real mouse interaction releases the recorder's idle buffer gate.
      await page.mouse.move(350, 250);
      await page.mouse.click(350, 250);
      // Force and await the real generated worker, even when auth frames delay load.
      await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); });
      await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated');
      assert.equal((await page.request.get(`${base}/manifest.webmanifest`)).status(), 200);
      assert.equal(await page.evaluate(() => new Promise(resolve => {
        const url = URL.createObjectURL(new Blob(['postMessage("worker-ok")'], { type: 'text/javascript' }));
        const worker = new Worker(url);
        worker.onmessage = event => { worker.terminate(); URL.revokeObjectURL(url); resolve(event.data); };
        worker.onerror = () => resolve('worker-failed');
      })), 'worker-ok');
      if (process.env.CSP_AUTH_MODE === 'e2e') {
        const google = await context.newPage();
        await google.goto(base);
        await google.evaluate(() => { localStorage.clear(); });
        await google.reload();
        await google.getByTestId('login-google').click();
        await expect(google.locator('.desk-app')).toBeVisible({ timeout: 30000 });
        await google.close();
      } else {
        await expect.poll(() => requests.some(r => r.host === 'identitytoolkit.googleapis.com' && r.path.includes('signInWithPassword'))).toBe(true);
        await expect.poll(() => requests.some(r => r.type === 'script' && r.path.includes('lazy-recorder'))).toBe(true);
        await expect.poll(() => requests.some(r => r.path === '/s/'), { timeout: 20000 }).toBe(true);
      }
      // OAuth is emulated; exercise every provider resource type against the
      // browser policy as well, without contacting a live Firebase project.
      const providerProbes = await page.evaluate(async () => {
        const load = (tag, url) => new Promise((resolve, reject) => {
          const node = document.createElement(tag);
          const timer = setTimeout(() => reject(new Error('Provider probe timed out')), 10000);
          node.onload = () => { clearTimeout(timer); node.remove(); resolve(true); };
          node.onerror = () => { clearTimeout(timer); node.remove(); reject(new Error('Provider probe blocked')); };
          node.src = url;
          document.body.append(node);
        });
        const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
        const blob = URL.createObjectURL(new Blob([picture], { type: 'image/svg+xml' }));
        try {
          return await Promise.all([
            load('script', 'https://apis.google.com/csp-fixture.js'),
            load('script', 'https://www.gstatic.com/csp-fixture.js'),
            load('iframe', 'https://csp-fixture.firebaseapp.com/__/auth/iframe'),
            load('iframe', 'https://accounts.google.com/csp-fixture'),
            load('iframe', '/__/auth/iframe'),
            load('img', `data:image/svg+xml,${encodeURIComponent(picture)}`), load('img', blob),
            fetch('https://securetoken.googleapis.com/v1/token', { method: 'POST', body: '{}' }).then(r => r.ok),
          ]);
        } finally { URL.revokeObjectURL(blob); }
      });
      assert.ok(providerProbes.every(Boolean));
      await page.reload();
      await expect(page.locator('.desk-app')).toBeVisible({ timeout: 30000 });
      assert.deepEqual(violations, [], 'Unexpected securitypolicyviolation events');
      assert.deepEqual(consoleViolations, [], 'Unexpected CSP console errors');
      console.log(JSON.stringify({ mode: reportOnly ? 'report-only' : 'enforcing', screens: routes.length, auth: process.env.CSP_AUTH_MODE === 'e2e' ? 'email + Google E2E' : 'Firebase REST mock', replay: requests.some(r => r.path === '/s/'), workers: 'service worker + blob', violations: violations.length }));
      if (!reportOnly) {
        // Intentional negative probes, separate from the zero-violation journey.
        await page.evaluate(() => {
          const inline = document.createElement('script'); inline.textContent = 'window.__cspInjected = true'; document.head.append(inline);
          const external = document.createElement('script'); external.src = 'https://csp-denied.invalid/probe.js'; document.head.append(external);
        });
        await expect.poll(() => violations.length).toBe(2);
        assert.equal(await page.evaluate(() => window.__cspInjected), undefined);
        assert.ok(violations.every(v => v.directive === 'script-src-elem' && v.disposition === 'enforce'));
        console.log('Enforcing bloquea script inline arbitrario y origen externo no autorizado');
      }
    } finally {
      await context.close();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
} finally { await browser.close(); }
