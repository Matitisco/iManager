import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'desk.css'), 'utf8');

describe('avatares en sheets de filtro', () => {
  it('el nombre del vendedor ocupa el espacio sin estirar el avatar', () => {
    expect(css).toMatch(/\.seller-opt > span:not\(\.av-c\) \{ flex: 1;/);
    expect(css).not.toMatch(/\.seller-opt span \{/);
  });

  it('el avatar del filtro Vendedor es un círculo fijo', () => {
    const rule = css.match(/\.seller-opt \.av-c \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('width: 36px');
    expect(rule).toContain('height: 36px');
    expect(rule).toContain('aspect-ratio: 1');
    expect(rule).toContain('flex: 0 0 36px');
  });
});
