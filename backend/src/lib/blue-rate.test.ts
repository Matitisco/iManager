import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.unmock("./blue-rate.js");
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it("uses and caches the same blue sell source as the sale form", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ venta: 1250 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const { currentBlueRate } = await import("./blue-rate.js");
  expect(await currentBlueRate()).toBe(1250);
  expect(await currentBlueRate()).toBe(1250);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe("https://dolarapi.com/v1/dolares/blue");
});
it("accepts a client quote without a network request and rejects invalid rates", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const { saleExchangeRate } = await import("./blue-rate.js");
  expect(await saleExchangeRate(1400)).toBe(1400);
  await expect(saleExchangeRate(0)).rejects.toMatchObject({ statusCode: 400 });
  await expect(saleExchangeRate(NaN)).rejects.toMatchObject({ statusCode: 400 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("surfaces quote failures and allows retry without an invented fallback", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ venta: 1200 }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const { currentBlueRate } = await import("./blue-rate.js");
  await expect(currentBlueRate()).rejects.toMatchObject({ statusCode: 503 });
  expect(await currentBlueRate()).toBe(1200);
});
it("rejects malformed remote quotes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ venta: null }), { status: 200 })));
  const { currentBlueRate } = await import("./blue-rate.js");
  await expect(currentBlueRate()).rejects.toMatchObject({ statusCode: 503 });
});
