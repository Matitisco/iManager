import { beforeEach, expect, it, vi } from 'vitest';
import config from '../firebase-applet-config.json';

const initializeApp = vi.hoisted(() => vi.fn(() => ({ name: 'test' })));
const environment = vi.hoisted(() => ({ ios: false, standalone: false }));
vi.mock('firebase/app', () => ({ initializeApp }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(), GoogleAuthProvider: class {} }));
vi.mock('./lib/pwa', () => ({ isIOS: () => environment.ios, isStandalone: () => environment.standalone }));
beforeEach(() => { vi.resetModules(); initializeApp.mockClear(); environment.ios = false; environment.standalone = false; });

it('keeps the existing auth domain for browser login', async () => {
  await import('./firebase');
  expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ authDomain: config.authDomain }));
});
it('uses the app origin for standalone iOS Firebase helpers', async () => {
  environment.ios = true; environment.standalone = true;
  await import('./firebase');
  expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({ authDomain: window.location.host }));
});
