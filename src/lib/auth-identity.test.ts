import { expect, it, vi } from 'vitest';
import { authUserView, sameAuthIdentity } from './auth-identity';
it('keeps business identity independent of credentials and reads tokens from the real user', async () => {
  const before = { uid: 'a', email: 'a@test.com', displayName: 'Ana', getIdToken: vi.fn(async () => 'old') };
  let current = { ...before, getIdToken: vi.fn(async () => 'new') };
  const view = authUserView(before, () => current);
  expect(sameAuthIdentity(view, current)).toBe(true);
  expect(await view.getIdToken()).toBe('new');
  expect(before.getIdToken).not.toHaveBeenCalled();
  current = { ...current, getIdToken: vi.fn(async () => 'renewed') };
  expect(await view.getIdToken()).toBe('renewed');
  expect(sameAuthIdentity(view, { ...current, displayName: 'Otro' })).toBe(false);
  expect(sameAuthIdentity(view, { ...current, uid: 'b' })).toBe(false);
});
