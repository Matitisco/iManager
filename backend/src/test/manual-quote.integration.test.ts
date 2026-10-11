import { describe, expect, it } from "vitest";
import { MANUAL_QUOTE_ORDER_ERROR } from "../lib/manual-quote.js";
import { buildAuthHeaders, seedStoreContext } from "./db.js";
import { useIntegrationApp } from "./integration-helpers.js";

const { getApp } = useIntegrationApp();

describe("manual quote order", () => {
  it("rejects compra above venta on the store and on onboarding", async () => {
    const app = getApp();
    const owner = await seedStoreContext({
      firebaseUid: "manual-quote-owner",
      email: "manual-quote@imanager.test",
      displayName: "Manual Quote",
    });
    const headers = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: owner.user.firebaseUid,
        email: owner.user.email ?? undefined,
        name: owner.user.displayName ?? undefined,
      }),
    };

    const inverted = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers,
      payload: { exchangeMode: "manual", manualBuy: 1400, manualSell: 1300 },
    });
    expect(inverted.statusCode).toBe(400);
    expect(inverted.json()).toEqual({ error: MANUAL_QUOTE_ORDER_ERROR });

    const equal = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers,
      payload: { exchangeMode: "manual", manualBuy: 1400, manualSell: 1400 },
    });
    expect(equal.statusCode).toBe(200);
    expect(equal.json().store).toMatchObject({ exchangeMode: "manual", manualBuy: 1400, manualSell: 1400 });

    const raised = await app.inject({
      method: "PATCH",
      url: "/api/stores/current",
      headers,
      payload: { manualBuy: 1500 },
    });
    expect(raised.statusCode).toBe(400);
    expect(raised.json()).toEqual({ error: MANUAL_QUOTE_ORDER_ERROR });

    const fresh = await seedStoreContext({
      firebaseUid: "manual-quote-new",
      email: "manual-quote-new@imanager.test",
      displayName: "Manual Quote New",
      createStore: false,
    });
    const freshHeaders = {
      "content-type": "application/json",
      ...buildAuthHeaders({
        uid: fresh.user.firebaseUid,
        email: fresh.user.email ?? undefined,
        name: fresh.user.displayName ?? undefined,
      }),
    };
    const onboarded = await app.inject({
      method: "POST",
      url: "/api/onboarding",
      headers: freshHeaders,
      payload: {
        storeName: "Casa Invertida",
        instagram: "@invertida",
        exchangeMode: "manual",
        manualBuy: 1400,
        manualSell: 1300,
      },
    });
    expect(onboarded.statusCode).toBe(400);
    expect(onboarded.json()).toEqual({ error: MANUAL_QUOTE_ORDER_ERROR });
  });
});
