import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';
import { pwaPlugin } from './scripts/pwa.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss(), pwaPlugin(), {
      name: 'catalog-server-config',
      generateBundle() { this.emitFile({ type: 'asset', fileName: 'catalog-config.json', source: JSON.stringify({ apiBase: env.VITE_API_BASE_URL || '' }) }); },
    }],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
