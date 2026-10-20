import { describe, expect, it } from 'vitest';
import { createWedgeBuffer } from './keyboard-wedge';

function burst(text: string, gap = 10) {
  const wedge = createWedgeBuffer();
  let now = 1_000;
  for (const key of text) {
    now += gap;
    wedge.push(key, now);
  }
  return wedge.push('Enter', now + gap);
}

describe('keyboard wedge', () => {
  it('treats a fast IMEI or box label as a scan', () => {
    expect(burst('352098117744522')).toEqual({ type: 'scan', value: '352098117744522' });
    expect(burst('MLPF3LE/A F2LXK9POQ1 352098117744522')).toEqual({
      type: 'scan',
      value: 'MLPF3LE/A F2LXK9POQ1 352098117744522',
    });
  });

  it('lets a human press Enter after typing slowly', () => {
    const wedge = createWedgeBuffer();
    let now = 1_000;
    for (const key of '352098117744522') {
      now += 200;
      expect(wedge.push(key, now).type).toBe('char');
    }
    expect(wedge.push('Enter', now + 200)).toEqual({ type: 'enter' });
  });

  it('does not steal Enter from a short model name', () => {
    expect(burst('iPhone')).toEqual({ type: 'enter' });
  });
});
