import { expect, test } from '@playwright/test';
import { openDeskSection } from './navigation';
import {
  authHeaders,
  bootstrapStoreViaApi,
  buildTestEmail,
  createClientViaApi,
  createInventoryItemViaApi,
  fetchSales,
  updateStoreViaApi,
} from './utils';
const api =
  process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';
for (const width of [1440, 390])
  for (const theme of ['light', 'dark']) {
    test.describe(`Consignaciones ${width} ${theme}`, () => {
      test.use({ viewport: { width, height: 1000 } });
      test('crea, conserva propiedad y registra el cobro total como venta', async ({
        page,
        request,
      }, info) => {
        await page.addInitScript(
          (value) => localStorage.setItem('imanager-theme', value),
          theme,
        );
        const email = buildTestEmail(info, `consignments-${width}-${theme}`);
        await bootstrapStoreViaApi(
          page,
          request,
          email,
          'Consignaciones ficticias',
        );
        await updateStoreViaApi(request, email, {
          currency: 'ARS',
          exchangeMode: 'manual',
          manualBuy: 1000,
          manualSell: 1000,
        });
        const { client } = await createClientViaApi(request, email, {
          name: 'Diego Paz ficticio',
          phone: '11 5555-0101',
        });
        const { inventoryItem } = await createInventoryItemViaApi(
          request,
          email,
          {
            imei: '359123456321201',
            model: 'iPhone 15',
            price: 950000,
            cost: 600000,
          },
        );
        await page.reload();
        await openDeskSection(page, 'consignments');
        const createButton =
          width === 390
            ? page
                .getByTestId('mobile-dock')
                .getByRole('button', { name: 'Nueva consignación' })
            : page.getByRole('button', {
                name: 'Nueva consignación',
                exact: true,
              });
        await createButton.click();
        const form = page.getByRole('dialog', { name: 'Nueva consignación' });
        await form
          .getByLabel('Cliente', { exact: true })
          .selectOption(client.id);
        await form.getByRole('checkbox').check();
        await form.getByLabel('Precio de iPhone 15').fill('940.000');
        await form.getByRole('button', { name: 'Crear consignación' }).click();
        await expect(form).toBeHidden();
        const card = page.getByRole('region', {
          name: `Consignaciones de ${client.name}`,
        });
        await expect(card).toContainText('$ 940.000');
        await expect(card).toContainText('iPhone 15');
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: `/tmp/imanager-763-${width}-${theme}.png`,
          fullPage: true,
        });
        const inventory = await request.get(`${api}/api/inventory`, {
          headers: authHeaders(email),
        });
        expect(
          (await inventory.json()).inventory.find(
            (item: { id: string }) => item.id === inventoryItem.id,
          ),
        ).toMatchObject({ status: 'EN_CONSIGNACION', cantidad: 1 });
        expect((await fetchSales(request, email)).sales).toHaveLength(0);
        await card.getByRole('button', { name: /Marcar pagada/ }).click();
        const payment = page.getByRole('dialog', {
          name: 'Marcar consignación pagada',
        });
        await payment.getByLabel('Medio de pago').selectOption('TRANSFERENCIA');
        await payment.getByRole('button', { name: 'Registrar cobro' }).click();
        await expect(payment).toBeHidden();
        await expect(
          page.getByText('No hay consignaciones pendientes.'),
        ).toBeVisible();
        expect((await fetchSales(request, email)).sales).toEqual([
          expect.objectContaining({
            clientId: client.id,
            productId: inventoryItem.id,
            amount: 940000,
            status: 'COMPLETADA',
            paymentMethod: 'TRANSFERENCIA',
            exchangeRate: 1000,
          }),
        ]);
        await page.reload();
        await expect(
          page.getByText('No hay consignaciones pendientes.'),
        ).toBeVisible();
      });
    });
  }
