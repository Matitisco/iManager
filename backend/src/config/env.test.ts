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


describe("authentication safety", () => {
  it.each(["production", "development"])("rejects the Firebase auth emulator in %s", (mode) => {
    expect(() => parseEnv({ ...productionEnv, NODE_ENV: mode, FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:29099" })).toThrow();
  });

  it("requires explicit test bypass opt-in for the emulator", () => {
    expect(() => parseEnv({ ...productionEnv, NODE_ENV: "test", ENABLE_TEST_AUTH_BYPASS: "false", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:29099" })).toThrow();
    expect(() => parseEnv({ ...productionEnv, NODE_ENV: "test", ENABLE_TEST_AUTH_BYPASS: "true", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:29099" })).not.toThrow();
  });
});


describe("trusted proxy boundaries", () => {
  it("ignores forwarding headers by default", () => {
    expect(parseEnv(productionEnv).TRUST_PROXY_CIDRS).toEqual([]);
  });
  it("accepts explicit addresses and networks", () => {
    expect(parseEnv({ ...productionEnv, TRUST_PROXY_CIDRS: ' 127.0.0.1, 10.42.0.0/16, ::1 ' }).TRUST_PROXY_CIDRS).toEqual(['127.0.0.1', '10.42.0.0/16', '::1']);
  });
  it.each(['true', '*', '0.0.0.0/0', '::/0', '127.0.0.1/no', '10.0.0.0/33', '10.0.0.0/8/9', 'localhost'])('rejects broad or invalid proxy configuration %s', value => {
    expect(() => parseEnv({ ...productionEnv, TRUST_PROXY_CIDRS: value })).toThrow();
  });
});
