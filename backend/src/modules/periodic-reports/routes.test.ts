import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticateMock, resolveAppUserMock, getMock, saveMock, testMock } = vi.hoisted(() => ({
  authenticateMock: vi.fn(),
  resolveAppUserMock: vi.fn(),
  getMock: vi.fn(),
  saveMock: vi.fn(),
  testMock: vi.fn(),
}));

vi.mock("../../middleware/authenticate.js", () => ({ authenticate: authenticateMock }));
vi.mock("../../middleware/resolve-app-user.js", () => ({ resolveAppUser: resolveAppUserMock }));
vi.mock("./service.js", () => ({
  getPeriodicReportSettings: getMock,
  savePeriodicReportSettings: saveMock,
  sendTestReport: testMock,
}));

import { DomainError } from "../../lib/domain-error.js";
import { periodicReportRoutes } from "./routes.js";

function appFor(role: "OWNER" | "MANAGER" | "STAFF") {
  authenticateMock.mockImplementation(async () => undefined);
  resolveAppUserMock.mockImplementation(async (request: { appUser?: unknown }) => {
    request.appUser = { userId: "user-1", storeId: "store-1", role };
  });
  const app = Fastify();
  return app;
}

describe("permisos del reporte automático", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMock.mockResolvedValue({ enabled: false, frequency: "MONTHLY", recipients: [], lastSentAt: null, lastPeriodLabel: null, lastError: null });
    saveMock.mockResolvedValue({ enabled: true, frequency: "MONTHLY", recipients: ["ana@tienda.test"], lastSentAt: null, lastPeriodLabel: null, lastError: null });
  });

  it.each(["MANAGER", "STAFF"] as const)("un %s no lee ni guarda", async (role) => {
    const app = appFor(role);
    await app.register(periodicReportRoutes);
    const read = await app.inject({ method: "GET", url: "/current/periodic-report" });
    const write = await app.inject({ method: "PUT", url: "/current/periodic-report", payload: { enabled: true, frequency: "MONTHLY", recipients: ["ana@tienda.test"] } });
    const test = await app.inject({ method: 'POST', url: '/current/periodic-report/test', payload: { enabled: true, frequency: 'WEEKLY', recipients: ['a@test.local'] } });
    expect(test.statusCode).toBe(403); expect(testMock).not.toHaveBeenCalled();
    expect(read.statusCode).toBe(403);
    expect(write.statusCode).toBe(403);
    expect(getMock).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("el dueño lee y guarda", async () => {
    const app = appFor("OWNER");
    await app.register(periodicReportRoutes);
    const read = await app.inject({ method: "GET", url: "/current/periodic-report" });
    const write = await app.inject({ method: "PUT", url: "/current/periodic-report", payload: { enabled: true, frequency: "BIWEEKLY", recipients: ["ana@tienda.test"] } });
    expect(read.statusCode).toBe(200);
    expect(write.statusCode).toBe(200);
    expect(saveMock).toHaveBeenCalledWith("store-1", { enabled: true, frequency: "BIWEEKLY", recipients: ["ana@tienda.test"] });
  });

  it("un correo inválido vuelve como error visible", async () => {
    saveMock.mockRejectedValue(new DomainError("Revisá los correos. Hay uno que no es válido."));
    const app = appFor("OWNER");
    await app.register(periodicReportRoutes);
    const write = await app.inject({ method: "PUT", url: "/current/periodic-report", payload: { enabled: true, frequency: "MONTHLY", recipients: ["mal"] } });
    expect(write.statusCode).toBe(400);
    expect(write.json()).toEqual({ error: "Revisá los correos. Hay uno que no es válido." });
  });
  it('owner can test the active store, invalid times rejected and throttle visible', async () => {
    const app = appFor('OWNER'); await app.register(periodicReportRoutes);
    const payload = { enabled: false, frequency: 'WEEKLY', sendDay: 1, sendTime: '09:00', recipients: ['a@test.local'] };
    testMock.mockResolvedValue({ sent: true });
    expect((await app.inject({ method: 'POST', url: '/current/periodic-report/test', payload })).statusCode).toBe(200);
    expect(testMock).toHaveBeenCalledWith('store-1', payload, expect.anything());
    expect((await app.inject({ method: 'POST', url: '/current/periodic-report/test', payload: { ...payload, sendTime: '24:00' } })).statusCode).toBe(400);
    testMock.mockRejectedValue(new DomainError('Esperá un minuto', 429));
    expect((await app.inject({ method: 'POST', url: '/current/periodic-report/test', payload })).statusCode).toBe(429);
    await app.close();
  });

});
