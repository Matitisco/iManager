import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    env: {
      TZ: 'America/Argentina/Buenos_Aires',
    },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/**/*.{ts,tsx}',
        'src/context/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**/*',
      ],
    },
  },
});
