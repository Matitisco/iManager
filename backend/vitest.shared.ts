import { defineConfig } from "vitest/config";

export function createBackendVitestConfig(include: string[], exclude?: string[]) {
  return defineConfig({
    test: {
      environment: "node",
      include,
      exclude,
      setupFiles: ["src/test/setup-env.ts"],
      coverage: {
        provider: "v8",
        include: [
          "src/modules/**/*.service.ts",
          "src/modules/auth/session.service.ts",
          "src/middleware/**/*.ts",
        ],
        exclude: [
          "src/**/*.test.ts",
          "src/**/*.integration.test.ts",
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  });
}
