import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import { pwaPlugin } from './scripts/pwa.mjs';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pwaPlugin()],
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
