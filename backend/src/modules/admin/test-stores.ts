/** Shared with the frontend; accepts raw or masked owner email. */
export function isTestStore(store: { name: string; ownerEmail: string | null }): boolean {
  if (/qa-|demo|test|smoke/i.test(store.name)) return true;
  const at = store.ownerEmail?.lastIndexOf('@') ?? -1;
  return at >= 0 && store.ownerEmail!.slice(at + 1).toLowerCase() === 'example.com';
}
