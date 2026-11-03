import { expect, it } from 'vitest';
import { clearSessionCaches } from './boot-cache';

it('removes orphaned business data on logout without clearing unrelated preferences', () => {
  localStorage.setItem('imanager.boot.lists.orphaned-store', JSON.stringify({ clients: [{ name: 'qa-sec-1@example.com' }] }));
  localStorage.setItem('imanager-theme', 'dark');
  localStorage.setItem('unrelated-app', 'keep');
  localStorage.setItem('imanager.boot.list-ids', 'invalid-json');
  clearSessionCaches();
  expect(localStorage.getItem('imanager.boot.lists.orphaned-store')).toBeNull();
  expect(localStorage.getItem('imanager-theme')).toBe('dark');
  expect(localStorage.getItem('unrelated-app')).toBe('keep');
});
