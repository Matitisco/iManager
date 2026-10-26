/** Reviewable alternatives for the import flow. A is the default. */
export function importVariant(): 'a' | 'b' {
  return new URLSearchParams(window.location.search).get('importVariant') === 'b' ? 'b' : 'a';
}
