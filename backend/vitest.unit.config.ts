import { createBackendVitestConfig } from "./vitest.shared.js";

export default createBackendVitestConfig(["src/**/*.test.ts"], ["src/**/*.integration.test.ts"]);
