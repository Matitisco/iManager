import type { AuthUserLike } from '../types/auth-user';

export function sameAuthIdentity(previous: AuthUserLike | null, next: AuthUserLike) {
  return previous?.uid === next.uid && previous.email === next.email
    && previous.displayName === next.displayName && (previous.photoURL ?? null) === (next.photoURL ?? null);
}

/** Business identity stays stable; credentials/provider metadata follow Firebase. */
export function authUserView(user: AuthUserLike, current: () => AuthUserLike | null): AuthUserLike {
  const resolved = () => {
    const latest = current();
    return latest?.uid === user.uid ? latest : user;
  };
  return {
    uid: user.uid, email: user.email, displayName: user.displayName, photoURL: user.photoURL,
    get providerData() { return resolved().providerData; },
    get emailVerified() { return resolved().emailVerified; },
    get isAnonymous() { return resolved().isAnonymous; },
    get tenantId() { return resolved().tenantId; },
    getIdToken: async () => {
      const latest = current();
      if (latest && latest.uid !== user.uid) throw Object.assign(new Error('Invalid token'), { code: 'auth/invalid-user-token' });
      return (latest ?? user).getIdToken();
    },
  };
}
