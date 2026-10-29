import assert from 'node:assert/strict';
import { launchBrowser, loadPage } from './browser.mjs';

const url = process.env.LANDING_URL || 'http://localhost:4181/';
const browser = await launchBrowser();
try {
  for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await loadPage(page, url);
    const issues = await page.evaluate(() => {
      const problems = [];
      if (document.documentElement.scrollWidth > innerWidth) problems.push('scroll horizontal');
      for (const selector of ['.nav', '.pro', '.bento', '.st3', '.duo', '.foot']) {
        const parent = document.querySelector(selector);
        const boxes = [...parent.children].map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.width && rect.height);
        for (let i = 0; i < boxes.length; i++) {
          const a = boxes[i].rect;
          if (a.left < -1 || a.right > innerWidth + 1) problems.push(`${selector}: fuera del viewport`);
          for (let j = i + 1; j < boxes.length; j++) {
            const b = boxes[j].rect;
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) problems.push(`${selector}: solape`);
          }
        }
      }
      // El recorte de capturas y las ilustraciones es intencional; el texto visible debe entrar.
      for (const element of document.querySelectorAll('h1, h2, h3, p, .btn, .seg')) {
        const box = element.getBoundingClientRect();
        if (box.left < -1 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1) {
          problems.push(`texto desbordado: ${element.textContent}`);
        }
      }
      if ([...document.images].some((image) => !image.complete || !image.naturalWidth)) problems.push('imagen sin cargar');
      return problems;
    });
    assert.deepEqual([...issues, ...errors], [], `${width}px`);
    assert.equal(await page.locator('h1').count(), 1);
    const stock = page.getByRole('tab', { name: 'Stock', exact: true });
    await stock.focus();
    for (const [key, name] of [['ArrowRight', 'Ventas'], ['End', 'Reportes'], ['ArrowRight', 'Stock'], ['ArrowLeft', 'Reportes'], ['Home', 'Stock']]) {
      await page.keyboard.press(key);
      assert.equal(await page.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('tabpanel').count(), 1);
    }
    await page.getByRole('tab', { name: 'Ventas', exact: true }).click();
    assert.equal(await page.getByRole('tabpanel').getAttribute('id'), 'panel-ventas');
    await context.close();
    console.log(`${width}px: sin desbordes ni solapes; pestañas y teclado OK`);
  }
} finally {
  await browser.close();
}
