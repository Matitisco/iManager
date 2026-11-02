import { expect, type Locator } from '@playwright/test';

// Browser CSS coverage: jsdom cannot detect generated chevrons on field wrappers.
export async function expectSingleSelectChevrons(scope: Locator) {
  const violations = await scope.locator('.ds-select:visible').evaluateAll(selects => selects.flatMap(select => {
    const trigger = select.querySelector('.ds-select-trigger')!;
    const native = select.querySelector('select')!;
    const box = native.getBoundingClientRect();
    const errors: string[] = [];
    if (trigger.querySelectorAll('svg.lucide-chevron-down').length !== 1) errors.push('expected one SVG chevron');
    if (box.width > 1 || box.height > 1 || getComputedStyle(native).clipPath !== 'inset(50%)') errors.push('native select is not clipped');
    const field = select.closest('.fl');
    for (const node of [select, trigger, ...(field ? [field] : [])]) {
      for (const pseudo of ['::before', '::after']) {
        const style = getComputedStyle(node, pseudo);
        if (style.content !== 'none' && style.content !== 'normal' && style.display !== 'none') errors.push(`extra decoration on ${node.className}${pseudo}`);
      }
    }
    return errors.length ? [{ label: trigger.getAttribute('aria-label'), errors }] : [];
  }));
  expect(violations, 'Each DeskSelect must show only its own chevron').toEqual([]);
}
