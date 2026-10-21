import { sheetAction } from './sheet-actions';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { authHeaders, bootstrapStoreViaApi, buildTestEmail, createClientViaApi, createInventoryItemViaApi, fetchInventory, fetchSales } from './utils';

const api = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
async function post(request: APIRequestContext, email: string, path: string, data?: object) {
  const response = await request.post(`${api}/api${path}`, { headers: authHeaders(email), ...(data ? { data } : {}) });
  expect(response.ok(), `POST ${path} returned ${response.status()}: ${await response.text()}`).toBeTruthy();
  return response.json();
}
async function get(request: APIRequestContext, email: string, path: string) {
  const response = await request.get(`${api}/api${path}`, { headers: authHeaders(email) });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
async function setup(page: Page, request: APIRequestContext, email: string) {
  await page.route('https://dolarapi.com/**', route => route.fulfill({ json: { compra: 1280, venta: 1300 } }));
  await bootstrapStoreViaApi(page, request, email, 'Caja opcional');
  const saved = await request.patch(`${api}/api/stores/current`, { headers: authHeaders(email), data: { currency: 'USD' } });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  const { inventoryItem } = await createInventoryItemViaApi(request, email, { imei: '359123456789012', model: 'iPhone 14', price: 100 });
  const box = await post(request, email, '/cash', { name: 'Dólares efectivo', currency: 'USD', method: 'EFECTIVO', opening: 0 });
  return { product: inventoryItem, boxId: box.id as string };
}
async function close(request: APIRequestContext, email: string, boxId: string, amount: number) {
  const { id } = await post(request, email, `/cash/${boxId}/open`);
  await post(request, email, `/cash/sessions/${id}/count`, { denominations: { '100': amount / 100 } });
  await post(request, email, `/cash/sessions/${id}/review`, { action: 'APPROVE' });
  return id as string;
}
async function sell(page: Page, phone: boolean, method: string) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('sidebar-tab-sales').click();
  const sales = page.getByTestId('sales-screen');
  await expect(sales).toBeVisible();
  await (phone ? sales.getByTestId('mobile-dock') : sales).getByRole('button', { name: 'Registrar venta', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Registrar venta' });
  await form.getByLabel('Cliente').fill('Ana Caja');
  await form.getByRole('combobox', { name: 'Equipo', exact: true }).fill('iPhone 14');
  await form.getByRole('option', { name: /iPhone 14/ }).click();
  await form.getByRole('button', { name: method, exact: true }).click();
  await form.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
  await expect(form).toBeHidden();
}
async function detail(page: Page, phone: boolean) {
  await page.getByTestId('sidebar-tab-sales').click();
  const sales = page.getByTestId('sales-screen');
  await expect(sales).toBeVisible();
  await sales.locator(phone ? '.phone-row' : 'tbody tr').filter({ hasText: 'iPhone 14' }).click();
  const sheet = page.getByRole('dialog', { name: /V-/ });
  await expect(sheet).toBeVisible();
  return sheet;
}
async function cancelSale(page: Page, phone: boolean) {
  const sheet = await detail(page, phone);
  await (await sheetAction(sheet, 'Cancelar operación')).click();
  const confirm = page.getByRole('dialog', { name: 'Cancelar operación', exact: true });
  await confirm.getByRole('button', { name: 'Cancelar operación', exact: true }).click();
  await expect(confirm).toBeHidden();
}
async function editPrice(page: Page, phone: boolean, amount: number) {
  const sheet = await detail(page, phone);
  await (await sheetAction(sheet, 'Editar')).click();
  const editor = page.getByRole('dialog', { name: 'Editar operación' });
  await editor.getByLabel('Precio completo de salida').fill(String(amount));
  await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(editor).toBeHidden();
}
async function closeEmptyInUi(page: Page, request: APIRequestContext, email: string, boxId: string) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const tab = page.getByTestId('sidebar-tab-cash');
  const more = page.getByTestId('sidebar-tab-more');
  await expect(tab.or(more).first()).toBeVisible();
  if (!(await tab.isVisible())) await more.click();
  await tab.click();
  await page.getByTestId('cash-screen').getByRole('button', { name: /Caja C/ }).click();
  await expect(page.locator('.cash-overview strong')).toHaveText('USD 0,00');
  await page.getByRole('button', { name: 'Contar y cerrar', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Contar y cerrar', exact: true });
  await form.getByLabel('Cantidad de 100', { exact: true }).fill('0');
  await form.getByRole('button', { name: 'Guardar conteo', exact: true }).click();
  await expect(form).toBeHidden();
  await page.getByRole('button', { name: 'Aprobar cierre', exact: true }).click();
  await expect(page.getByTestId('cash-close-result')).toContainText('Cierre aprobado');
  const history = await get(request, email, `/cash/${boxId}/sessions`);
  expect(history.sessions[0].counts[0]).toMatchObject({ expected: 0, counted: 0, difference: 0 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByTestId('cash-screen').getByRole('button', { name: /Caja C/ }).click();
  await expect(page.getByTestId('cash-close-result')).toContainText('Cierre aprobado');
  await expect(page.locator('.cash-overview strong')).toHaveText('USD 0,00');
}
export function registerCashOperationTests(device: 'desktop' | 'iphone') {
  const phone = device === 'iphone';
  for (const closed of [false, true]) {
    test(`vende en efectivo con caja ${closed ? 'cerrada' : 'sin abrir'} · ${device}`, async ({ page, request }, info) => {
      const email = buildTestEmail(info, `cash-sale-${device}`);
      const { product, boxId } = await setup(page, request, email);
      if (closed) await close(request, email, boxId, 0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'En stock 1 equipo 1 disponible', exact: true })).toBeVisible();
      await page.getByTestId('sidebar-tab-inventory').click();
      await expect(page.getByText(phone ? '1 equipo · 1 disponible' : '1 equipo · 1 disponible · 0 en catálogo', { exact: true })).toBeVisible();
      await sell(page, phone, 'Efectivo');
      expect((await fetchSales(request, email)).sales).toEqual([expect.objectContaining({ productId: product.id, amount: 100, status: 'COMPLETADA' })]);
      expect((await fetchInventory(request, email)).inventory.find(row => row.id === product.id)?.status).toBe('VENDIDO');
      expect((await get(request, email, '/cash')).registers[0].balance).toBe(0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(await detail(page, phone)).toContainText('US$ 100');
    });
  }

  test(`vende por transferencia sin caja configurada para ese medio · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-transfer-${device}`);
    const { boxId } = await setup(page, request, email);
    await post(request, email, `/cash/${boxId}/open`);
    await sell(page, phone, 'Transferencia');
    expect((await fetchSales(request, email)).sales[0]).toMatchObject({ paymentMethod: 'TRANSFERENCIA', status: 'COMPLETADA', amountCurrency: 'USD' });
    expect((await get(request, email, `/cash/${boxId}/movements`)).movements).toHaveLength(0);
    expect((await get(request, email, '/cash')).registers[0].balance).toBe(0);
  });

  test(`cancela después del cierre y conserva el arqueo · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-cancel-${device}`);
    const { product, boxId } = await setup(page, request, email);
    await post(request, email, `/cash/${boxId}/open`);
    await sell(page, phone, 'Efectivo');
    await close(request, email, boxId, 100);
    const before = await get(request, email, `/cash/${boxId}/sessions`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const sheet = await detail(page, phone);
    await (await sheetAction(sheet, 'Cancelar operación')).click();
    const confirm = page.getByRole('dialog', { name: 'Cancelar operación', exact: true });
    await confirm.getByRole('button', { name: 'Cancelar operación', exact: true }).click();
    await expect(confirm).toBeHidden();
    expect((await fetchSales(request, email)).sales[0].status).toBe('CANCELADA');
    expect((await fetchInventory(request, email)).inventory.find(row => row.id === product.id)?.status).toBe('DISPONIBLE');
    expect(await get(request, email, `/cash/${boxId}/sessions`)).toEqual(before);
    expect((await get(request, email, '/cash')).registers[0].balance).toBe(100);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(await detail(page, phone)).toContainText('Cancelada');
  });

  for (const state of ['sin abrir', 'cerrada', 'sin configuración']) {
    test(`cancela un cobro ${state} y deja Caja C en cero · ${device}`, async ({ page, request }, info) => {
      const email = buildTestEmail(info, `cash-unassigned-${device}`);
      const { product, boxId } = await setup(page, request, email);
      if (state === 'cerrada') await close(request, email, boxId, 0);
      // Transferencia exercises a currency/method with no configured register at payment time.
      const method = state === 'sin configuración' ? 'TRANSFERENCIA' : 'EFECTIVO';
      const { sale } = await post(request, email, '/operations/sales', { exchangeRate: 1300, clientName: 'Ana Caja', productId: product.id, amount: 100, currency: 'USD', paymentMethod: method });
      const before = await get(request, email, `/cash/${boxId}/sessions`);
      const current = await post(request, email, '/cash', { name: 'Caja C', currency: 'USD', method, opening: 0 });
      await post(request, email, `/cash/${current.id}/open`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await cancelSale(page, phone);
      expect((await fetchSales(request, email)).sales.find(row => row.id === sale.id)?.status).toBe('CANCELADA');
      expect((await fetchInventory(request, email)).inventory.find(row => row.id === product.id)?.status).toBe('DISPONIBLE');
      expect((await get(request, email, '/cash')).registers.map((row: { balance: number }) => row.balance)).toEqual([0, 0]);
      expect((await get(request, email, `/cash/${current.id}/movements`)).movements).toHaveLength(0);
      expect(await get(request, email, `/cash/${boxId}/sessions`)).toEqual(before);
      // Bank counts use a total; cash counts use denominations.
      if (method === 'TRANSFERENCIA') {
        const registers = await get(request, email, '/cash');
        const sessionId = registers.registers.find((row: { id: string }) => row.id === current.id).session.id;
        expect(await post(request, email, `/cash/sessions/${sessionId}/count`, { counted: 0 })).toMatchObject({ expected: 0, counted: 0, difference: 0 });
        await post(request, email, `/cash/sessions/${sessionId}/review`, { action: 'APPROVE' });
      } else await closeEmptyInUi(page, request, email, current.id);
    });
  }

  for (const amount of [80, 130]) {
    test(`ajusta a ${amount} y cancela un cobro fuera de cajas · ${device}`, async ({ page, request }, info) => {
      const email = buildTestEmail(info, `cash-price-outside-${device}`);
      const { product, boxId } = await setup(page, request, email);
      const { client } = await createClientViaApi(request, email, { name: 'Ana Caja', dni: '30111999' });
      await post(request, email, '/operations/sales', { exchangeRate: 1300, clientId: client.id, productId: product.id, amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO' });
      await close(request, email, boxId, 0);
      const before = await get(request, email, `/cash/${boxId}/sessions`);
      const current = await post(request, email, '/cash', { name: 'Caja C', currency: 'USD', method: 'EFECTIVO', opening: 0 });
      await post(request, email, `/cash/${current.id}/open`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await editPrice(page, phone, amount);
      expect((await fetchSales(request, email)).sales[0]).toMatchObject({ amount, status: 'COMPLETADA' });
      expect((await get(request, email, `/cash/${current.id}/movements`)).movements).toHaveLength(0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await cancelSale(page, phone);
      expect((await get(request, email, '/cash')).registers.map((row: { balance: number }) => row.balance)).toEqual([0, 0]);
      expect((await get(request, email, `/cash/${current.id}/movements`)).movements).toHaveLength(0);
      expect(await get(request, email, `/cash/${boxId}/sessions`)).toEqual(before);
      await closeEmptyInUi(page, request, email, current.id);
    });
  }

  test(`cancela sólo la diferencia cobrada en caja y reintegra el original fuera · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-price-mixed-${device}`);
    const { product, boxId } = await setup(page, request, email);
    const { client } = await createClientViaApi(request, email, { name: 'Ana Caja', dni: '30111999' });
    const { sale } = await post(request, email, '/operations/sales', { exchangeRate: 1300, clientId: client.id, productId: product.id, amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO' });
    await close(request, email, boxId, 0);
    const current = await post(request, email, '/cash', { name: 'Caja C', currency: 'USD', method: 'EFECTIVO', opening: 0 });
    await post(request, email, `/cash/${current.id}/open`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await editPrice(page, phone, 130);
    expect((await fetchSales(request, email)).sales[0]).toMatchObject({ amount: 130, openBalance: 30 });
    await post(request, email, '/accounts/collections', { clientId: client.id, saleId: sale.id, amount: 30, currency: 'USD', method: 'EFECTIVO' });
    expect((await get(request, email, '/cash')).registers.find((row: { id: string }) => row.id === current.id).balance).toBe(30);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await cancelSale(page, phone);
    const movements = (await get(request, email, `/cash/${current.id}/movements`)).movements;
    expect(movements).toHaveLength(2);
    expect(movements.map((row: { amount: number }) => row.amount).sort((a: number, b: number) => a - b)).toEqual([-30, 30]);
    await closeEmptyInUi(page, request, email, current.id);
  });

  test(`sube el precio pagado y cobra la diferencia después del cierre · ${device}`, async ({ page, request }, info) => {
    const email = buildTestEmail(info, `cash-price-${device}`);
    const { product, boxId } = await setup(page, request, email);
    const { client } = await createClientViaApi(request, email, { name: 'Ana Caja', dni: '30111999' });
    await post(request, email, `/cash/${boxId}/open`);
    const { sale } = await post(request, email, '/operations/sales', { exchangeRate: 1300, clientId: client.id, productId: product.id, amount: 100, currency: 'USD', paymentMethod: 'EFECTIVO' });
    await close(request, email, boxId, 100);
    const before = await get(request, email, `/cash/${boxId}/sessions`);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const sheet = await detail(page, phone);
    await (await sheetAction(sheet, 'Editar')).click();
    const editor = page.getByRole('dialog', { name: 'Editar operación' });
    await editor.getByLabel('Precio completo de salida').fill('130');
    await editor.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
    await expect(editor).toBeHidden();
    expect((await fetchSales(request, email)).sales[0]).toMatchObject({ amount: 130, status: 'COMPLETADA', openBalance: 30 });
    const debtors = await get(request, email, '/accounts/debtors');
    expect(debtors.debtors.find((row: { clientId: string }) => row.clientId === client.id).lines[0].amount).toBe(30);
    expect((await get(request, email, `/cash/${boxId}/movements`)).movements).toHaveLength(1);
    await post(request, email, '/accounts/collections', { clientId: client.id, saleId: sale.id, amount: 30, currency: 'USD', method: 'EFECTIVO' });
    expect((await fetchSales(request, email)).sales[0]).toMatchObject({ openBalance: 0 });
    expect((await get(request, email, '/cash')).registers[0].balance).toBe(100);
    expect(await get(request, email, `/cash/${boxId}/sessions`)).toEqual(before);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(await detail(page, phone)).toContainText('US$ 130');
  });
}
