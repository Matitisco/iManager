import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebase = vi.hoisted(() => ({
  signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), getRedirectResult: vi.fn(),
  signInWithEmailAndPassword: vi.fn(), createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(), onAuthStateChanged: vi.fn(),
}));
vi.mock('firebase/auth', () => firebase);
vi.mock('../firebase', () => ({ auth: { currentUser: null }, googleProvider: { providerId: 'google.com' } }));
const environment = vi.hoisted(() => ({ ios: false, standalone: false }));
vi.mock('../lib/pwa', () => ({ isIOS: () => environment.ios, isStandalone: () => environment.standalone }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  environment.ios = false; environment.standalone = false;
  firebase.getRedirectResult.mockResolvedValue(null);
});
describe('Firebase authentication in installed apps', () => {
  it('uses redirect on iOS standalone', async () => {
    environment.ios = true; environment.standalone = true;
    const { getAuthAdapter } = await import('./auth-adapter');
    await getAuthAdapter().loginWithGoogle();
    expect(firebase.signInWithRedirect).toHaveBeenCalledOnce();
    expect(firebase.signInWithPopup).not.toHaveBeenCalled();
  });
  it.each([[true, false], [false, true], [false, false]])('keeps popup for ios=%s standalone=%s', async (ios, standalone) => {
    environment.ios = ios; environment.standalone = standalone;
    const { getAuthAdapter } = await import('./auth-adapter');
    await getAuthAdapter().loginWithGoogle();
    expect(firebase.signInWithPopup).toHaveBeenCalledOnce();
    expect(firebase.signInWithRedirect).not.toHaveBeenCalled();
  });
  it('processes a redirect return once across repeated callers', async () => {
    const { getAuthAdapter } = await import('./auth-adapter');
    await Promise.all([getAuthAdapter().completeGoogleRedirect!(), getAuthAdapter().completeGoogleRedirect!()]);
    expect(firebase.getRedirectResult).toHaveBeenCalledOnce();
  });
  it('propagates redirect return errors for Login to display', async () => {
    firebase.getRedirectResult.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
    const { getAuthAdapter } = await import('./auth-adapter');
    await expect(getAuthAdapter().completeGoogleRedirect!()).rejects.toMatchObject({ code: 'auth/network-request-failed' });
  });
  it('keeps email/password authentication in standalone', async () => {
    environment.ios = true; environment.standalone = true;
    const { getAuthAdapter } = await import('./auth-adapter');
    await getAuthAdapter().loginWithEmail('owner@test.com', 'secret123');
    expect(firebase.signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'owner@test.com', 'secret123');
  });
});
