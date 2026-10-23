import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { keepIfEqual, useStableState } from './stable-state';

describe('structural sharing', () => {
  it('retains equal nested JSON and empty lists without serialization', () => {
    const previous = { rows: [{ id: 'a', value: 1, nested: [null, true, 'text'] }], empty: [] };
    expect(keepIfEqual(previous, structuredClone(previous))).toBe(previous);
    expect(keepIfEqual(null, null)).toBeNull();
    expect(keepIfEqual(1, 2)).toBe(2);
    expect(keepIfEqual({ a: undefined }, {})).toEqual({});
    expect(keepIfEqual([], {})).toEqual({});
  });
  it('shares unchanged rows across edits, additions, removals and reorderings', () => {
    const before = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
    const next = keepIfEqual(before, [{ id: 'b', value: 2 }, { id: 'a', value: 3 }, { id: 'c', value: 4 }]);
    expect(next).not.toBe(before);
    expect(next[0]).toBe(before[1]);
    expect(next[1]).not.toBe(before[0]);
    expect(keepIfEqual(next, [before[1]])[0]).toBe(before[1]);
  });
  it('supports functional updates and preserves the reference after equal refetches', () => {
    const { result } = renderHook(() => useStableState([{ id: 'a', n: 1 }]));
    const before = result.current[0], setter = result.current[1];
    act(() => setter([{ id: 'a', n: 1 }]));
    expect(result.current[0]).toBe(before);
    act(() => setter(old => old.map(row => ({ ...row, n: 2 }))));
    expect(result.current[0][0].n).toBe(2);
    expect(result.current[1]).toBe(setter);
  });
});
