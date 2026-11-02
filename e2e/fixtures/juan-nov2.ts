import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { authHeaders } from '../utils';

export const api = process.env.PLAYWRIGHT_API_BASE_URL || 'http://127.0.0.1:3196';
export const adminEmail = 'platform-admin@imanager.test';
export const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
export const dayAgo = (days: number) => new Date(new Date(`${today}T15:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);

export async function call(request: APIRequestContext, email: string, method: string, path: string, data?: unknown) {
  const response = await request.fetch(`${api}${path}`, { method, headers: authHeaders(email), data });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.status() === 204 ? null : response.json();
}

export async function signIn(page: Page, email: string, path = '/') {
  await page.addInitScript(email => localStorage.setItem('imanager:test-auth-user', JSON.stringify({ email })), email);
  await page.goto(path);
}

export async function seedWholesale(request: APIRequestContext, width: number) {
  const email = `qa-wholesale-${width}-${Date.now()}@imanager.test`;
  await call(request, email, 'GET', '/api/me');
  await call(request, email, 'POST', '/api/stores', { name: `Mayorista QA ${width}` });
  await call(request, email, 'PATCH', '/api/stores/current', { instagram: 'mayorista.ficticio', currency: 'USD', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1000 });
  const { store } = await call(request, email, 'GET', '/api/me');
  const { client } = await call(request, email, 'POST', '/api/clients', { name: 'Cliente siete compras', phone: '1100000000' });
  const { client: returnClient } = await call(request, email, 'POST', '/api/clients', { name: 'Cliente devolución ficticio' });
  const { inventoryItem: product } = await call(request, email, 'POST', '/api/inventory', {
    model: 'Equipo mayorista QA', capacity: '128GB', imei: '', color: 'Negro', condition: 'NUEVO', grade: 'A+', batteryHealth: '100%', cost: 60, price: 100, currency: 'USD', cantidad: 100, status: 'DISPONIBLE',
  });
  const sales: Array<{ id: string; saleNumber: number; cantidad: number }> = [];
  for (const cantidad of [2, 3, 5, 2, 3, 5, 2]) {
    const result = await call(request, email, 'POST', '/api/operations/sales', {
      clientId: client.id, productId: product.id, date: today, cantidad, amount: cantidad * 100, unitPrice: 100,
      currency: 'USD', paymentMethod: 'EFECTIVO', warrantyDays: 90, status: 'COMPLETADA',
    });
    sales.push(result.sale);
  }
  const { sale: partialSale } = await call(request, email, 'POST', '/api/operations/sales', {
    clientId: returnClient.id, productId: product.id, date: today, cantidad: 10, amount: 1000, unitPrice: 100,
    currency: 'USD', paymentMethod: 'EFECTIVO', warrantyDays: 90, status: 'COMPLETADA',
  });
  // Yesterday, last week and last month guarantee a nonzero oracle in each preset.
  for (const [days, cantidad] of [[1, 2], [5, 3], [32, 5]]) {
    await call(request, email, 'POST', '/api/operations/sales', {
      clientName: `Cliente histórico ficticio ${days}`, productId: product.id, date: dayAgo(days), cantidad,
      amount: cantidad * 100, unitPrice: 100, currency: 'USD', status: 'COMPLETADA',
    });
  }
  await call(request, email, 'POST', '/api/trade-ins', {
    date: today, clientName: 'Cliente canje ficticio', deviceReceived: 'Equipo canje QA', deviceGiven: 'Equipo salida QA', takeValue: 20,
    differencePaid: 0, status: 'PERITAJE TÉC.', currency: 'USD', draft: true,
  });
  await call(request, email, 'POST', '/api/repairs', { clientName: 'Cliente reparación ficticio', device: 'Equipo reparación QA', fault: 'Pantalla', estimate: 50, currency: 'USD' });
  const staffEmail = email.replace('qa-wholesale', 'qa-staff');
  const invitation = await call(request, email, 'POST', '/api/invitations', { email: staffEmail, role: 'STAFF' });
  await call(request, staffEmail, 'GET', '/api/me');
  await call(request, staffEmail, 'POST', '/api/invitations/accept', { token: invitation.token });
  const { members } = await call(request, email, 'GET', `/api/stores/${store.id}/members`);
  const staff = members.find((member: { user: { email: string } }) => member.user.email === staffEmail);
  await call(request, email, 'PATCH', `/api/stores/${store.id}/members/${staff.id}/sections`, {
    sections: ['dashboard', 'inventory', 'sales', 'clients', 'tradeins', 'service', 'notifications'],
  });
  return { email, staffEmail, store, client, returnClient, product, sales, partialSale };
}
