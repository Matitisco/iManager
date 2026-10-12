import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function createServiceWorker(version, precache, staticAssets) {
  return readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8')
    .replace('__CACHE_VERSION__', JSON.stringify(version))
    .replace('__PRECACHE__', JSON.stringify(precache))
    .replace('__STATIC_ASSETS__', JSON.stringify(staticAssets));
}

/** @returns {import('vite').Plugin} */
export function pwaPlugin() {
  return {
    name: 'imanager-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const hash = createHash('sha256');
      hash.update(readFileSync(new URL('./service-worker.js', import.meta.url)));
      const bundled = Object.keys(bundle).sort();
      for (const name of bundled) {
        const file = bundle[name];
        hash.update(name).update(file.type === 'chunk' ? file.code : file.source);
      }
      const staticAssets = ['/manifest.webmanifest', '/apple-touch-icon.png', '/favicon.ico', '/favicon-16x16.png', '/favicon-32x32.png'];
      for (const dir of ['icons', 'brand', 'screenshots']) {
        for (const name of readdirSync(join('public', dir)).sort()) staticAssets.push(`/${dir}/${name}`);
      }
      for (const name of staticAssets) hash.update(readFileSync(join('public', name)));
      const assets = bundled.filter((name) => name.startsWith('assets/') && !name.endsWith('.map')).map((name) => `/${name}`);
      this.emitFile({
        type: 'asset', fileName: 'sw.js',
        source: createServiceWorker(hash.digest('hex').slice(0, 16), ['/', ...assets], staticAssets),
      });
    },
  };
}
