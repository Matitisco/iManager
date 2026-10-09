import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { findOrCreateUserFromFirebase } from "../modules/users/users.service.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("concurrent first login", () => {
  it("creates a single user when findOrCreateUserFromFirebase runs in parallel", async () => {
    const firebaseUid = `race-service-${crypto.randomUUID()}`;
    const auth = {
      firebaseUid,
      email: "race-service@imanager.test",
      name: "Race Service",
      picture: "https://example.com/race.png",
    };

    const users = await Promise.all(
      Array.from({ length: 8 }, () => findOrCreateUserFromFirebase(auth))
    );

    expect(new Set(users.map((user) => user.id)).size).toBe(1);
    expect(users.every((user) => user.email === auth.email)).toBe(true);
    expect(users.every((user) => user.displayName === auth.name)).toBe(true);

    const stored = await prisma.user.findMany({ where: { firebaseUid } });
    expect(stored).toHaveLength(1);
  });

  it("answers every simultaneous /api/me with 200 and a single user", async () => {
    const app = getApp();
    const firebaseUid = `race-me-${crypto.randomUUID()}`;
    const headers = buildAuthHeaders({
      uid: firebaseUid,
      email: "race-me@imanager.test",
      name: "Race Me",
    });

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({
          method: "GET",
          url: "/api/me",
          headers,
        })
      )
    );

    expect(responses.map((response) => response.statusCode)).toEqual(Array.from({ length: 8 }, () => 200));

    const bodies = responses.map((response) => response.json());
    expect(bodies.every((body) => body.onboardingRequired === true)).toBe(true);
    expect(bodies.every((body) => body.user.firebaseUid === firebaseUid)).toBe(true);
    expect(new Set(bodies.map((body) => body.user.id)).size).toBe(1);

    const stored = await prisma.user.findMany({ where: { firebaseUid } });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(bodies[0].user.id);
  });

  it("creates a single store and owner membership when onboarding races", async () => {
    const app = getApp();
    const firebaseUid = `race-onboarding-${crypto.randomUUID()}`;
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: firebaseUid,
        email: "race-onboarding@imanager.test",
        name: "Race Owner",
      }),
    };

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: "POST",
          url: "/api/onboarding",
          headers,
          payload: { storeName: "Tienda Única" },
        })
      )
    );

    expect(responses.map((response) => response.statusCode)).toEqual(Array.from({ length: 6 }, () => 200));
    for (const response of responses) {
      expect(response.json()).toMatchObject({
        session: {
          onboardingRequired: false,
          store: { name: "Tienda Única" },
          membership: { role: "OWNER", isDefault: true },
        },
      });
    }

    const users = await prisma.user.findMany({ where: { firebaseUid } });
    expect(users).toHaveLength(1);

    const memberships = await prisma.storeMember.findMany({
      where: { userId: users[0]?.id },
      include: { store: true },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ role: "OWNER", isDefault: true });
    expect(memberships[0]?.store.name).toBe("Tienda Única");
    expect(await prisma.store.count({ where: { name: "Tienda Única" } })).toBe(1);
  });

  it("accepts one invitation when the same new user races the link", async () => {
    const app = getApp();
    const owner = await seedStoreContext({ firebaseUid: `race-owner-${crypto.randomUUID()}` });
    const ownerHeaders = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: owner.user.firebaseUid,
        email: owner.user.email ?? undefined,
        name: owner.user.displayName ?? undefined,
      }),
    };

    const created = await app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: ownerHeaders,
      payload: { role: "STAFF" },
    });
    expect(created.statusCode).toBe(201);
    const token = created.json().token as string;

    const firebaseUid = `race-invitee-${crypto.randomUUID()}`;
    const inviteeHeaders = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: firebaseUid,
        email: "race-invitee@imanager.test",
        name: "Race Invitee",
      }),
    };

    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({
          method: "POST",
          url: "/api/invitations/accept",
          headers: inviteeHeaders,
          payload: { token },
        })
      )
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.every((status) => status === 200 || status === 409 || status === 410)).toBe(true);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses).not.toContain(500);

    const users = await prisma.user.findMany({ where: { firebaseUid } });
    expect(users).toHaveLength(1);

    const memberships = await prisma.storeMember.findMany({
      where: { userId: users[0]?.id, storeId: owner.store?.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe("STAFF");

    const invitation = await prisma.storeInvitation.findUniqueOrThrow({ where: { token } });
    expect(invitation.status).toBe("ACCEPTED");
  });
});
