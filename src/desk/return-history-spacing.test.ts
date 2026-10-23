import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, 'desk.css'), 'utf8');
const tokens = readFileSync(resolve(__dirname, 'sheet-detail.css'), 'utf8');

describe('RMA history sheet spacing', () => {
  it('adds the shared 20px top spacing only to the mobile history body', () => {
    const mobileBlocks = [...css.matchAll(/@media\s*\(max-width:\s*760px\)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)];
    const rules = mobileBlocks.flatMap(block => [...block[1].matchAll(/\.return-history-sheet \.sheet-scroll\s*\{([^}]*)\}/g)]);

    expect(rules).toHaveLength(1);
    expect(rules[0][1].trim()).toBe('padding-top: var(--space-5);');
    const padding = Number(tokens.match(/--space-5:\s*(\d+)px;/)?.[1]);
    expect(padding).toBe(20);
    expect(padding).toBeGreaterThan(4);
  });

  it('preserves the desktop history width and top spacing', () => {
    expect(css).toMatch(/@media \(min-width: 761px\) \{\s*\.sheet\.return-history-sheet \{ width: 480px; \}\s*\.return-history-sheet \.sheet-scroll \{ padding-top: 22px; \}\s*\}/);
  });
});
