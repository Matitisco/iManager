/** Shared suggestion catalog for equipment forms and server-side import normalization. */
export const INVENTORY_MODELS = [
  'iPhone SE', 'iPhone X', 'iPhone XR', 'iPhone XS', 'iPhone XS Max',
  ...Array.from({ length: 7 }, (_, i) => i + 11).flatMap((n) => [
    `iPhone ${n}`, `iPhone ${n} Pro`, `iPhone ${n} Pro Max`,
    ...([12, 13].includes(n) ? [`iPhone ${n} mini`] : []),
    ...([14, 15, 16].includes(n) ? [`iPhone ${n} Plus`] : []),
  ]),
];
