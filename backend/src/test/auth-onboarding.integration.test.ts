import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("auth and onboarding integration", () => {
  it("serves health and protects the app session endpoint", async () => {
    const app = getApp();

    const health = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });

    const unauthorized = await app.inject({
      method: "GET",
      url: "/api/me",
    });

    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toEqual({ error: "Missing bearer token" });
  });

  it("returns a ready session for members and onboardingRequired for users without store context", async () => {
    const app = getApp();

    const ownerContext = await seedStoreContext();
    const readyResponse = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: buildAuthHeaders({
        uid: ownerContext.user.firebaseUid,
        email: ownerContext.user.email ?? undefined,
        name: ownerContext.user.displayName ?? undefined,
      }),
    });

    expect(readyResponse.statusCode).toBe(200);
    expect(readyResponse.json()).toMatchObject({
      onboardingRequired: false,
      store: {
        id: ownerContext.store?.id,
        name: ownerContext.store?.name,
      },
      membership: {
        role: "OWNER",
      },
      user: {
        id: ownerContext.user.id,
        email: ownerContext.user.email,
      },
    });

    const invitedUser = await seedStoreContext({
      firebaseUid: "onboarding-user",
      email: "onboarding@imanager.test",
      displayName: "Onboarding User",
      createStore: false,
    });

    const onboardingResponse = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: buildAuthHeaders({
        uid: invitedUser.user.firebaseUid,
        email: invitedUser.user.email ?? undefined,
        name: invitedUser.user.displayName ?? undefined,
      }),
    });

    expect(onboardingResponse.statusCode).toBe(200);
    expect(onboardingResponse.json()).toMatchObject({
      onboardingRequired: true,
      store: null,
      membership: null,
      user: {
        id: invitedUser.user.id,
        email: invitedUser.user.email,
      },
    });
  });

  it("completes onboarding by creating the store and owner membership", async () => {
    const app = getApp();
    const newUser = await seedStoreContext({
      firebaseUid: "new-owner",
      email: "new-owner@imanager.test",
      displayName: "New Owner",
      createStore: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      headers: {
        "content-type": "application/json",
        ...buildAuthHeaders({
          uid: newUser.user.firebaseUid,
          email: newUser.user.email ?? undefined,
          name: newUser.user.displayName ?? undefined,
        }),
      },
      payload: {
        storeName: "Sucursal Centro",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      session: {
        onboardingRequired: false,
        store: {
          name: "Sucursal Centro",
        },
        membership: {
          role: "OWNER",
        },
        user: {
          id: newUser.user.id,
        },
      },
    });

    const membership = await prisma.storeMember.findFirstOrThrow({
      where: { userId: newUser.user.id },
      include: { store: true },
    });

    expect(membership.role).toBe("OWNER");
    expect(membership.isDefault).toBe(true);
    expect(membership.store.name).toBe("Sucursal Centro");
  });
});
