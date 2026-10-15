import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
import { acceptInvitationViaApi, authHeaders, bootstrapStoreViaApi, buildTestEmail, createInvitationViaApi, fetchSession, loginViaUi, selectDeskOption } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
async function cashApi(request: APIRequestContext, email: string, path = '', data?: object) {
  const response = data ? await request.post(`${api}/api/cash${path}`, { headers: authHeaders(email), data }) : await request.get(`${api}/api/cash${path}`, { headers: authHeaders(email) });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function openCash(page: Page) {
  const target = page.getByTestId('sidebar-tab-cash');
  const more = page.getByTestId('sidebar-tab-more');
  await expect(target.or(more).first()).toBeVisible();
  if (!(await target.isVisible())) await more.click();
  await target.click();
  await expect(page.getByTestId('cash-screen')).toBeVisible();
}
async function chooseBox(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
async function save(page: Page, title: string, primary = 'Guardar') {
  const sheet = page.getByRole('dialog', { name: title, exact: true });
  await sheet.getByRole('button', { name: primary, exact: true }).click();
  await expect(sheet).toHaveCount(0);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

export function registerCashTests(device: string) {
  test(`empleado registra y cuenta sin acceso a saldos ni historial · ${device}`, async ({ page, request }, info) => {
    const owner = buildTestEmail(info, `cash-owner-${device}`), staff = buildTestEmail(info, `cash-staff-${device}`);
    await bootstrapStoreViaApi(page, request, owner, 'Caja protegida');
    const box = await cashApi(request, owner, '', { name: 'Efectivo protegido', currency: 'USD', method: 'EFECTIVO', opening: 100 });
    expect((await request.post(`${api}/api/cash/${box.id}/open`, { headers: authHeaders(owner) })).ok()).toBeTruthy();
    const invite = await createInvitationViaApi(request, owner, 'STAFF');
    await acceptInvitationViaApi(request, staff, invite.token);
    const session = await fetchSession(request, owner);
    const members = await request.get(`${api}/api/stores/${session.store!.id}/members`, { headers: authHeaders(owner) });
    const member = (await members.json()).members.find((row: { user: { email: string } }) => row.user.email === staff);
    const saved = await request.patch(`${api}/api/stores/${session.store!.id}/members/${member.id}/sections`, { headers: authHeaders(owner), data: { sections: ['cash'] } });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    await page.evaluate(() => localStorage.clear());
    await loginViaUi(page, staff);
    await openCash(page); await chooseBox(page, 'Efectivo protegido');
    await expect(page.locator('.cash-overview strong')).toHaveText('Saldo protegido');
    await expect(page.getByRole('heading', { name: 'Movimientos', exact: true })).toHaveCount(0);
    const balances = await cashApi(request, staff);
    expect(balances.registers[0]).not.toHaveProperty('balance');
    const forbidden = await request.get(`${api}/api/cash/${box.id}/movements`, { headers: authHeaders(staff) });
    expect(forbidden.status()).toBe(403);
    await page.getByRole('button', { name: 'Ingreso', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Monto · USD').fill('10');
    await save(page, 'Registrar ingreso');
    await page.getByRole('button', { name: 'Contar y cerrar', exact: true }).click();
    const count = page.getByRole('dialog');
    await expect(count.getByText('Esperado', { exact: true })).toHaveCount(0);
    await count.getByLabel('Cantidad de 100', { exact: true }).fill('1');
    await count.getByLabel('Cantidad de 10', { exact: true }).fill('1');
    await save(page, 'Contar y cerrar', 'Guardar conteo');
    await expect(page.getByTestId('cash-close-result')).toContainText('USD 110,00');
    await expect(page.getByRole('button', { name: 'Aprobar cierre' })).toHaveCount(0);
    await noOverflow(page);
  });

  test(`fondos, ingresos, egresos y cierres independientes en ARS/USD · ${device}`, async ({ page, request }, info) => {
    test.setTimeout(120000);
    const email = buildTestEmail(info, `cash-${device}`);
    await bootstrapStoreViaApi(page, request, email, 'Caja diaria');
    await openCash(page);
    for (const [name, currency, opening] of [['Pesos efectivo', 'ARS', '10000'], ['Dólares efectivo', 'USD', '100']]) {
      await page.getByRole('button', { name: 'Nueva caja', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Nueva caja', exact: true });
      await sheet.getByLabel('Nombre', { exact: true }).fill(name);
      await selectDeskOption(page, sheet.getByRole('combobox', { name: 'Moneda de la caja' }), currency === 'USD' ? 'USD · Dólares' : 'ARS · Pesos');
      await sheet.getByLabel('Saldo inicial').fill(opening);
      await save(page, 'Nueva caja');
      await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
    }
    await chooseBox(page, 'Pesos efectivo');
    await page.getByRole('button', { name: 'Abrir día', exact: true }).click();
    await page.getByRole('button', { name: 'Ingreso', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Monto · ARS').fill('2000');
    await save(page, 'Registrar ingreso');
    await page.getByRole('button', { name: 'Egreso', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Monto · ARS').fill('500');
    await page.getByRole('dialog').getByLabel('Categoría (obligatoria)').fill('Proveedores');
    await save(page, 'Registrar egreso');
    await expect(page.locator('.cash-overview strong')).toHaveText('ARS 11.500,00');
    await page.getByRole('button', { name: 'Contar y cerrar', exact: true }).click();
    const count = page.getByRole('dialog', { name: 'Contar y cerrar', exact: true });
    await expect(count.getByText('Esperado', { exact: true })).toHaveCount(0);
    await count.getByLabel('Cantidad de 10000', { exact: true }).fill('1');
    await count.getByLabel('Cantidad de 1000', { exact: true }).fill('1');
    await count.getByLabel('Cantidad de 500', { exact: true }).fill('1');
    await noOverflow(page);
    await save(page, 'Contar y cerrar', 'Guardar conteo');
    await expect(page.getByTestId('cash-close-result')).toContainText('ARS 11.500,00');
    await page.getByRole('button', { name: 'Aprobar cierre' }).click();
    await expect(page.getByTestId('cash-close-result')).toContainText('Cierre aprobado');
    await page.getByRole('button', { name: 'Todas las cajas' }).click();
    await chooseBox(page, 'Dólares efectivo');
    await expect(page.locator('.cash-overview strong')).toHaveText('USD 100,00');
    await page.getByRole('button', { name: 'Abrir día', exact: true }).click();
    await page.getByRole('button', { name: 'Ingreso', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Monto · USD').fill('20');
    await save(page, 'Registrar ingreso');
    await page.getByRole('button', { name: 'Contar y cerrar', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Cantidad de 100', { exact: true }).fill('1');
    await page.getByRole('dialog').getByLabel('Cantidad de 20', { exact: true }).fill('1');
    await save(page, 'Contar y cerrar', 'Guardar conteo');
    await page.getByRole('button', { name: 'Aprobar cierre' }).click();
    await expect(page.getByTestId('cash-close-result')).toContainText('Cierre aprobado');
    await noOverflow(page);
    await page.screenshot({ path: `docs/pr-shots/issue-307-${device}-cierre.png`, fullPage: true });
    await page.reload();
    await chooseBox(page, 'Dólares efectivo');
    await expect(page.locator('.cash-overview strong')).toHaveText('USD 120,00');
    const rows = await cashApi(request, email);
    expect(rows.registers.map((r: { balance: number }) => r.balance)).toEqual([11500, 120]);
  });

  test(`diferencia visible, error persistente y reconteo a ciegas · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-count-${device}`);
    await bootstrapStoreViaApi(page, request, email, 'Arqueo');
    const row = await cashApi(request, email, '', { name: 'Banco pesos', currency: 'ARS', method: 'TRANSFERENCIA', opening: 1000 });
    await request.post(`${api}/api/cash/${row.id}/open`, { headers: authHeaders(email) });
    await openCash(page); await chooseBox(page, 'Banco pesos');
    await page.getByRole('button', { name: 'Contar y cerrar', exact: true }).click();
    let sheet = page.getByRole('dialog', { name: 'Contar y cerrar', exact: true });
    await sheet.getByLabel('Total contado en la cuenta').fill('900');
    await sheet.getByRole('button', { name: 'Guardar conteo' }).click();
    await expect(sheet.getByRole('alert')).toContainText('Explicá la diferencia');
    await sheet.getByLabel('Nota', { exact: true }).fill('Transferencia pendiente');
    await save(page, 'Contar y cerrar', 'Guardar conteo');
    await expect(page.getByTestId('cash-close-result')).toContainText('ARS -100,00');
    await expect(page.getByRole('button', { name: 'Ingreso', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Pedir reconteo' }).click();
    await page.getByRole('dialog').getByLabel('Motivo del reconteo').fill('Revisar banco');
    await save(page, 'Pedir reconteo');
    await page.getByRole('button', { name: 'Recontar caja' }).click();
    sheet = page.getByRole('dialog', { name: 'Contar y cerrar', exact: true });
    await expect(sheet.getByText('Esperado', { exact: true })).toHaveCount(0);
    await expect(sheet.getByLabel('Total contado en la cuenta')).toHaveValue('');
    await sheet.getByLabel('Total contado en la cuenta').fill('1000');
    await save(page, 'Contar y cerrar', 'Guardar conteo');
    await page.getByRole('button', { name: 'Aprobar cierre' }).click();
    await expect(page.getByTestId('cash-close-result')).toContainText('Conteo 2');
    await noOverflow(page);
  });

  test(`conversión explícita con cotización editable y anulación de ambas cajas · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-transfer-${device}`);
    await bootstrapStoreViaApi(page, request, email, 'Conversión');
    for (const [name, currency, opening] of [['Dólares', 'USD', 100], ['Pesos', 'ARS', 0]] as const) {
      const box = await cashApi(request, email, '', { name, currency, opening, method: 'EFECTIVO' });
      const response = await request.post(`${api}/api/cash/${box.id}/open`, { headers: authHeaders(email) }); expect(response.ok()).toBeTruthy();
    }
    await openCash(page); await chooseBox(page, 'Dólares');
    await page.getByRole('button', { name: 'Convertir fondos' }).click();
    const sheet = page.getByRole('dialog', { name: 'Convertir fondos', exact: true });
    await sheet.getByLabel('Monto · USD').fill('20');
    await selectDeskOption(page, sheet.getByRole('combobox', { name: 'Caja destino' }), 'Pesos · ARS · Efectivo');
    await sheet.getByLabel('Cotización · ARS por USD').fill('1500');
    await expect(sheet).toContainText('Destino: ARS 30.000,00');
    await save(page, 'Convertir fondos');
    await expect(page.locator('.cash-overview strong')).toHaveText('USD 80,00');
    await expect(page.locator('.cash-history')).toContainText('Cotización guardada: ARS 1500 por USD');
    await page.getByRole('button', { name: 'Anular Transferencia / conversión', exact: true }).click();
    await save(page, 'Anular movimiento', 'Anular movimiento');
    await expect(page.locator('.cash-overview strong')).toHaveText('USD 100,00');
    const result = await cashApi(request, email);
    expect(result.registers.map((r: { balance: number }) => r.balance)).toEqual([100, 0]);
    await noOverflow(page);
  });
}
