import { describe, expect, it } from "vitest";
import { prisma } from "../plugins/prisma.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("management and collaboration integrations", () => {
  it("updates the current user profile, the store, member roles and security flags", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const staffUser = await prisma.user.create({
      data: {
        firebaseUid: "staff-1",
        email: "staff@imanager.test",
        displayName: "Staff Member",
        twoFactorEnabled: true,
      },
    });
    const staffMembership = await prisma.storeMember.create({
      data: {
        storeId: context.store!.id,
        userId: staffUser.id,
        role: "STAFF",
        isDefault: false,
      },
    });

    const ownerHeaders = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const userResponse = await app.inject({
      method: "PATCH",
      url: "/api/users/me",
      headers: ownerHeaders,
      payload: { displayName: "Owner Updated" },
    });
    expect(userResponse.statusCode).toBe(200);
    expect(userResponse.json()).toMatchObject({
      user: {
        displayName: "Owner Updated",
      },
    });

    const storeResponse = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers: ownerHeaders,
      payload: {
        name: "Flagship",
        phone: "2614999999",
      },
    });
    expect(storeResponse.statusCode).toBe(200);
    expect(storeResponse.json()).toMatchObject({
      store: {
        id: context.store!.id,
        name: "Flagship",
        phone: "2614999999",
      },
    });

    const membersResponse = await app.inject({
      method: "GET",
      url: `/api/stores/${context.store!.id}/members`,
      headers: ownerHeaders,
    });
    expect(membersResponse.statusCode).toBe(200);
    expect(membersResponse.json().members).toHaveLength(2);

    const roleResponse = await app.inject({
      method: "PATCH",
      url: `/api/stores/${context.store!.id}/members/${staffMembership.id}`,
      headers: ownerHeaders,
      payload: { role: "MANAGER" },
    });
    expect(roleResponse.statusCode).toBe(200);
    expect(roleResponse.json()).toMatchObject({
      member: {
        id: staffMembership.id,
        role: "MANAGER",
      },
    });

    const securityResponse = await app.inject({
      method: "DELETE",
      url: "/api/security/2fa",
      headers: buildAuthHeaders({
        uid: staffUser.firebaseUid,
        email: staffUser.email ?? undefined,
        name: staffUser.displayName ?? undefined,
      }),
    });
    expect(securityResponse.statusCode).toBe(200);
    expect(securityResponse.json()).toEqual({ ok: true });

    const staffAfterSecurity = await prisma.user.findUniqueOrThrow({
      where: { id: staffUser.id },
    });
    expect(staffAfterSecurity.twoFactorEnabled).toBe(false);

    const deleteMemberResponse = await app.inject({
      method: "DELETE",
      url: `/api/stores/${context.store!.id}/members/${staffMembership.id}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(deleteMemberResponse.statusCode).toBe(200);
    expect(deleteMemberResponse.json()).toEqual({ ok: true });
  });

  it("creates, previews, accepts, lists and revokes invitations", async () => {
    const app = getApp();
    const context = await seedStoreContext();
    const ownerHeaders = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    };

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: ownerHeaders,
      payload: {
        email: "invitee@imanager.test",
        role: "MANAGER",
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const createdInvitation = createResponse.json();

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/invitations",
      headers: ownerHeaders,
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().invitations).toHaveLength(1);

    const previewResponse = await app.inject({
      method: "GET",
      url: `/api/invitations/preview/${createdInvitation.token}`,
    });
    expect(previewResponse.statusCode).toBe(200);
    expect(previewResponse.json()).toMatchObject({
      storeName: context.store!.name,
      role: "MANAGER",
    });

    await prisma.user.create({
      data: {
        firebaseUid: "invitee-user",
        email: "invitee@imanager.test",
        displayName: "Invitee User",
      },
    });

    const acceptResponse = await app.inject({
      method: "POST",
      url: "/api/invitations/accept",
      headers: {
        "content-type": "application/json",
        ...buildAuthHeaders({
          uid: "invitee-user",
          email: "invitee@imanager.test",
          name: "Invitee User",
        }),
      },
      payload: {
        token: createdInvitation.token,
      },
    });
    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json()).toMatchObject({
      session: {
        onboardingRequired: false,
        store: {
          id: context.store!.id,
        },
        membership: {
          role: "MANAGER",
        },
      },
    });

    const revokeCandidate = await app.inject({
      method: "POST",
      url: "/api/invitations",
      headers: ownerHeaders,
      payload: {
        email: "second@imanager.test",
        role: "STAFF",
      },
    });
    expect(revokeCandidate.statusCode).toBe(201);

    const revokeResponse = await app.inject({
      method: "DELETE",
      url: `/api/invitations/${revokeCandidate.json().id}`,
      headers: buildAuthHeaders({
        uid: context.user.firebaseUid,
        email: context.user.email ?? undefined,
        name: context.user.displayName ?? undefined,
      }),
    });
    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json()).toEqual({ ok: true });
  });
});
