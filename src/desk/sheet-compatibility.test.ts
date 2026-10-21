import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from 'playwright';

const css = readFileSync(path.resolve(process.cwd(), 'src/desk/desk.css'), 'utf8');
let browser: Browser;
beforeAll(async () => { browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });

describe('manual sheet compatibility', () => {
  it.each([{ width: 1440, height: 900 }, { width: 1536, height: 640 }])('keeps direct content scrollable and the final action reachable at $width×$height', async viewport => {
    const page = await browser.newPage({ viewport });
    try {
      // Invitation permissions and password reset still render .sheet directly,
      // without the shared Sheet component's header/body/footer wrappers.
      await page.setContent(`<style>${css}</style><div class="desk-app"><div class="ov">
        <div class="sheet wide fresh-perms" role="dialog" aria-label="Permisos">
          <div>${Array.from({ length: 30 }, (_, i) => `<p style="margin:0;height:44px">Permiso sintético ${i}</p>`).join('')}
            <button type="button" class="btn2 p">Guardar permisos</button>
          </div>
        </div>
      </div></div>`);
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
      const sheet = page.getByRole('dialog', { name: 'Permisos' });
      const before = await sheet.evaluate(node => ({ overflow: getComputedStyle(node).overflowY, padding: parseFloat(getComputedStyle(node).paddingLeft), extra: node.scrollHeight - node.clientHeight }));
      expect(before.overflow).toBe('auto');
      expect(before.padding).toBeGreaterThan(0);
      expect(before.extra).toBeGreaterThan(0);
      await sheet.evaluate(node => { node.scrollTop = node.scrollHeight; });
      const reachable = await sheet.getByRole('button', { name: 'Guardar permisos' }).evaluate(node => {
        const box = node.getBoundingClientRect();
        const sheet = node.closest('.sheet')!.getBoundingClientRect();
        return box.top >= sheet.top && box.bottom <= sheet.bottom && box.bottom <= innerHeight;
      });
      expect(reachable).toBe(true);
    } finally { await page.close(); }
  });

  it('does not add shared-frame padding to the desktop dollar calculator wrappers', async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await page.setContent(`<style>${css}</style><div class="desk-app"><div class="ov">
        <div class="sheet dolar-sheet" role="dialog"><div class="sheet-scroll"><h3>Dólar</h3><p>Calculadora</p></div>
          <div class="sheet-foot"><div class="dolar-acts"><button class="btn2 p">Listo</button></div></div>
        </div></div></div>`);
      await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => undefined))); });
      const inset = await page.getByRole('heading', { name: 'Dólar' }).evaluate(node => node.getBoundingClientRect().left - node.closest('.sheet')!.getBoundingClientRect().left);
      expect(inset).toBe(22);
    } finally { await page.close(); }
  });
});

describe('shared sheet action targets', () => {
  it.each([
    { width: 1440, height: 900 }, { width: 1536, height: 640 },
    { width: 390, height: 844 }, { width: 320, height: 844 },
  ])('keeps footer targets at least 48px throughout opening at $width×$height', async viewport => {
    const page = await browser.newPage({ viewport });
    try {
      await page.setContent(`<style>${css}</style><div class="desk-app"><div class="ov">
        <div class="sheet sheet-frame acct-sheet" role="dialog" aria-label="Registrar pago">
          <div class="sheet-h"><h3>Registrar pago</h3></div>
          <div class="sheet-scroll"><label class="fl">Monto<input value="500"></label></div>
          <div class="sheet-foot"><div class="sacts sheet-actions">
            <button class="btn2 s sheet-secondary">Cancelar</button>
            <details class="sheet-action-menu"><summary>Más acciones</summary><button>Otra acción</button></details>
            <button class="btn2 p sheet-primary">Registrar pago</button>
          </div></div>
        </div>
      </div></div>`);
      // CI caught a real target-size regression during the existing pop animation:
      // 48 CSS px become only 45.12 rendered px at its initial desktop scale.
      const samples = await page.getByRole('dialog').evaluate(node => {
        // setContent may finish after the 200ms opening animation (fonts/load).
        // Restart the real CSS animation and pause in the same browser task.
        const sheet = node as HTMLElement;
        sheet.style.animation = 'none';
        void sheet.offsetWidth;
        sheet.style.animation = '';
        const animation = node.getAnimations()[0];
        animation.pause();
        return [0, 50, 100, 200].map(time => {
          animation.currentTime = time;
          return { time, targets: [...node.querySelectorAll('.sheet-actions > button, .sheet-actions > details > summary')].map(target => {
            const box = target.getBoundingClientRect();
            return { height: box.height, inside: box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth };
          }) };
        });
      });
      for (const sample of samples) for (const target of sample.targets) {
        expect(target.height).toBeGreaterThanOrEqual(48);
        // Mobile translates up from below the viewport instead of scaling.
        if (viewport.width > 760 || sample.time === 200) expect(target.inside).toBe(true);
      }
    } finally { await page.close(); }
  });
});
