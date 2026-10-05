import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const productionEnv = {
  DATABASE_URL: "postgresql://localhost/imanager",
  FIREBASE_PROJECT_ID: "demo-project",
  FIREBASE_CLIENT_EMAIL: "demo@example.com",
  FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
  FIRESTORE_DATABASE_ID: "demo-database",
};

describe("parseEnv NODE_ENV", () => {
  it("defaults an empty or missing NODE_ENV to production", () => {
    expect(parseEnv({ ...productionEnv, NODE_ENV: "" }).NODE_ENV).toBe("production");
    expect(parseEnv({ ...productionEnv, NODE_ENV: "   " }).NODE_ENV).toBe("production");
    expect(parseEnv(productionEnv).NODE_ENV).toBe("production");
  });

  it("keeps an explicit development, test, or production value", () => {
    expect(parseEnv({ ...productionEnv, NODE_ENV: "development" }).NODE_ENV).toBe("development");
    expect(parseEnv({ ...productionEnv, NODE_ENV: "production" }).NODE_ENV).toBe("production");
    expect(parseEnv({
      DATABASE_URL: productionEnv.DATABASE_URL,
      NODE_ENV: "test",
      ENABLE_TEST_AUTH_BYPASS: "true",
    }).NODE_ENV).toBe("test");
  });
});
