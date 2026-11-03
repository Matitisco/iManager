import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import { pwaPlugin } from './scripts/pwa.mjs';
import { cspPlugin } from './scripts/security-headers.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), cspPlugin(env), pwaPlugin(), {
      name: 'catalog-server-config',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'catalog-config.json', source: JSON.stringify({ apiBase: env.VITE_API_BASE_URL || '' }) }); },
    }],
    build: { sourcemap: false },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
