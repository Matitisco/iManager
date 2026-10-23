import { getAuthAdapter } from '../services/auth-adapter';
import type { BootSession } from './boot-cache';
import type { AuthUserLike } from '../types/auth-user';

export function cachedAuthUser(boot: BootSession): AuthUserLike {
  return {
    uid: boot.uid,
    email: boot.email,
    displayName: boot.displayName,
    photoURL: boot.photoURL,
    get providerData() { return getAuthAdapter().getCurrentUser()?.providerData; },
    get emailVerified() { return getAuthAdapter().getCurrentUser()?.emailVerified; },
    getIdToken: async () => {
      const current = getAuthAdapter().getCurrentUser();
      const restored = current?.uid === boot.uid
        ? current
        : await new Promise<AuthUserLike | null>((resolve) => {
          const stop = getAuthAdapter().onAuthStateChanged((next) => {
            stop();
            resolve(next);
          });
        });
      if (!restored || restored.uid !== boot.uid) {
        throw Object.assign(new Error('Invalid token'), { code: 'auth/invalid-user-token' });
      }
      return restored.getIdToken();
    },
  };
}
