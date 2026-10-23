import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../services/api-client';
import { testImei } from '../test/imei-fixture';
import type { AuthUserLike } from '../types/auth-user';
vi.mock('../services/api-client', () => ({ apiRequest: vi.fn() }));
let reporting: typeof import('./report-unknown-tac');
const user = { uid: 'owner', getIdToken: vi.fn() } as unknown as AuthUserLike;
beforeEach(async () => {
  vi.resetModules();
  vi.mocked(apiRequest).mockReset().mockResolvedValue(undefined);
  reporting = await import('./report-unknown-tac');
  reporting.setTacReportUser(user);
});
describe('unknown TAC reporting', () => {
  it('only sends exactly eight digits and deduplicates for the session, across user changes', () => {
    for (const tac of ['1234567', '123456789', '123456781234567', 'abcd1234', ' 12345678', '12345678\n']) reporting.reportUnknownTac(tac);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(reporting.reportUnknownTac('00000001')).toBeUndefined();
    reporting.reportUnknownTac('00000001');
    reporting.setTacReportUser(null);
    reporting.setTacReportUser(user);
    reporting.reportUnknownTac('00000001');
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith(user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac: '00000001' }, method: 'POST' }));
  });
  it('contains network/token failures and synchronous exceptions without logging', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('offline'));
    expect(() => reporting.reportUnknownTac('00000002')).not.toThrow();
    await Promise.resolve();
    vi.mocked(apiRequest).mockImplementation(() => { throw new Error('token'); });
    expect(() => reporting.reportUnknownTac('00000003')).not.toThrow();
  });
  it('does not report known Apple/Samsung, invalid IMEI, partial or absent identity', () => {
    for (const imei of [testImei('35389310'), testImei('35001772'), '353893101224014', '00000000', '000000001234567', `${testImei('00000004')}\n`]) reporting.autofillImeiSpecs(imei);
    expect(apiRequest).not.toHaveBeenCalled();
    reporting.setTacReportUser(null);
    reporting.autofillImeiSpecs(testImei('00000004'));
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('derives only TAC from valid unknown IMEI and leaves the general parser silent', async () => {
    const { parseDeviceCode } = await import('./device-scan');
    parseDeviceCode(testImei('00000005'));
    expect(apiRequest).not.toHaveBeenCalled();
    reporting.autofillImeiSpecs(testImei('00000005'));
    reporting.autofillImeiSpecs(testImei('00000005', '654321'));
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith(user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac: '00000005' } }));
  });
});
