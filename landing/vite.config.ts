import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  server: { port: 5180, host: true },
  preview: { port: 4180, host: true },
  build: {
    target: 'es2020',
    cssTarget: 'safari15',
    outDir: isSsrBuild ? 'dist/server' : 'dist',
    emptyOutDir: !isSsrBuild,
  },
}));
