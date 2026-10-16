import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5180, host: true },
  preview: { port: 4180, host: true },
  build: { target: 'es2020', cssTarget: 'safari15' },
});
