import { expect, type APIRequestContext, type APIResponse, type Page, type Locator, type TestInfo } from '@playwright/test';

const DEFAULT_PASSWORD = process.env.VITE_E2E_TEST_PASSWORD?.trim() || 'test123456';
const DEFAULT_API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

type InventorySeedInput = {
  imei: string;
  model: string;
  price?: number;
  cost?: number;
  capacity?: string;
  color?: string;
  condition?: string;
  grade?: string;
  batteryHealth?: string;
  status?: string;
};

type AppSessionResponse = {
  store: { id: string; name: string; phone?: string | null; email?: string | null; instagram?: string | null } | null;
  membership: { role: 'OWNER' | 'MANAGER' | 'STAFF'; isDefault: boolean } | null;
  onboardingRequired: boolean;
};

function buildDisplayName(email: string) {
  return (
    email
      .trim()
      .toLowerCase()
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]!.toUpperCase() + part.slice(1))
      .join(' ') || 'Test User'
  );
}

function createTestToken(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = {
    uid: `test-${normalizedEmail.replace(/[^a-z0-9]+/gi, '-')}`,
    email: normalizedEmail,
    name: buildDisplayName(normalizedEmail),
    picture: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80',
    emailVerified: true,
  };

  return `test.${encodeURIComponent(JSON.stringify(payload))}`;
}

async function assertOk(response: APIResponse, action: string) {
  const body = await response.text();
  expect(response.ok(), `${action} failed with ${response.status()}: ${body}`).toBeTruthy();
  return body;
}

export function authHeaders(email: string) {
  return {
    Authorization: `Bearer ${createTestToken(email)}`,
  };
}

export function buildTestEmail(testInfo: TestInfo, slug: string) {
  const normalizedSlug = slug.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const normalizedTitle = testInfo.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `${normalizedSlug}-${normalizedTitle}-${testInfo.parallelIndex}-${Date.now()}@imanager.test`;
}

export async function loginViaUi(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await submitLoginViaUi(page, email, password);
}

async function submitLoginViaUi(page: Page, email: string, password = DEFAULT_PASSWORD) {
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click({ noWaitAfter: true });
}

export async function acceptInvitationViaUi(page: Page, email: string, token: string, storeName: string) {
  await page.goto(`/invite/${token}`);
  await expect(page.getByRole('heading', { name: `Sumate a ${storeName}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Iniciá sesión', exact: true }).click();
  await submitLoginViaUi(page, email);
  await page.getByRole('button', { name: 'Aceptar invitación', exact: true }).click();
  await expect(page.getByTestId('accept-invitation-screen')).toBeHidden();
}

export async function fetchSession(request: APIRequestContext, email: string): Promise<AppSessionResponse> {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/me`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch session');
  return JSON.parse(body) as AppSessionResponse;
}

async function fetchSessionEventually(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      return await fetchSession(request, email);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('P2002') && !message.includes('firebaseUid')) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return fetchSession(request, email);
}

async function waitForSessionReady(request: APIRequestContext, email: string) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const session = await fetchSessionEventually(request, email);
    if (!session.onboardingRequired && session.store) {
      return session;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for store membership for ${email}`);
}

export async function createStoreViaApi(request: APIRequestContext, email: string, storeName: string) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/stores`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: { name: storeName },
  });
  await assertOk(response, 'Create store');
}

export async function bootstrapStoreViaApi(
  page: Page,
  request: APIRequestContext,
  email: string,
  storeName: string,
) {
  await loginViaUi(page, email);

  const currentSession = await fetchSessionEventually(request, email);
  if (currentSession.onboardingRequired) {
    const response = await request.post(`${DEFAULT_API_BASE_URL}/api/stores`, {
      headers: {
        ...authHeaders(email),
        'Content-Type': 'application/json',
      },
      data: { name: storeName },
    });
    await assertOk(response, 'Create existing-store fixture');
  }

  const seededSession = await fetchSessionEventually(request, email);
  if (currentSession.onboardingRequired && seededSession.store) {
    const contact = await request.patch(`${DEFAULT_API_BASE_URL}/api/stores/current`, { headers: authHeaders(email), data: { instagram: 'e2etienda' } });
    await assertOk(contact, 'Set fixture store contact');
  }
  await waitForSessionReady(request, email);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();
}

export async function bootstrapStore(page: Page, request: APIRequestContext, email: string, storeName: string) {
  await bootstrapStoreViaApi(page, request, email, storeName);
}

export async function fetchInventory(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/inventory`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch inventory');
  return JSON.parse(body) as { inventory: Array<{ id: string; imei: string; model: string; capacity: string; color: string; condition: string; grade: string; batteryHealth: string; status: string; cost: number; price: number; soldAt?: string | null; pendingSaleRegistration?: boolean; needsCompletion?: boolean; customFields?: Record<string, unknown> }> };
}

export async function fetchClients(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/clients`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch clients');
  return JSON.parse(body) as { clients: Array<{ id: string; name: string; dni: string; phone: string; pendingBalance: number; creditBalance?: number; totalSpent: number }> };
}

export async function createClientViaApi(
  request: APIRequestContext,
  email: string,
  input: {
    name: string;
    dni?: string;
    phone?: string;
    email?: string;
    pendingBalance?: number;
    totalSpent?: number;
    lastPurchaseDate?: string;
    balanceCurrency?: 'ARS' | 'USD';
  },
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/clients`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: input,
  });
  const body = await assertOk(response, 'Create client');
  return JSON.parse(body) as { client: { id: string; name: string } };
}

export async function fetchSales(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/sales`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch sales');
  return JSON.parse(body) as {
    sales: Array<{ id: string; saleNumber: number; clientId: string; productId: string; deviceLabel?: string; status: string; amount: number; integratedOperation: boolean; tradeInId?: string | null }>;
  };
}

export async function fetchTradeIns(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/trade-ins`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch trade-ins');
  return JSON.parse(body) as {
    tradeIns: Array<{ id: string; tradeNumber?: number; clientId: string; clientName: string; saleId?: string | null; deviceReceived: string; deviceGiven?: string; status: string; confirmationStatus?: string | null; differencePaid: number; removedFromSaleNumber?: number | null }>;
  };
}

export async function importInventoryViaApi(
  request: APIRequestContext,
  email: string,
  input: { imei: string; model: string; price: number; cost?: number },
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/inventory/import`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: {
      rows: [{
        imei: input.imei,
        model: input.model,
        capacity: '128GB',
        color: 'Negro',
        condition: 'USADO',
        grade: 'A',
        batteryHealth: '90%',
        cost: input.cost ?? 0,
        price: input.price,
        status: 'DISPONIBLE',
      }],
    },
  });
  const body = await assertOk(response, 'Import inventory');
  return JSON.parse(body) as { imported: number; updated: number; errors: Array<{ message: string }> };
}

export async function acceptInvitationViaApi(request: APIRequestContext, email: string, token: string) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/invitations/accept`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: { token },
  });
  const body = await assertOk(response, 'Accept invitation');
  return JSON.parse(body) as { session: { store: { id: string; name: string } | null } };
}

export async function createInvitationViaApi(
  request: APIRequestContext,
  ownerEmail: string,
  role: 'MANAGER' | 'STAFF',
  email?: string,
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/invitations`, {
    headers: {
      ...authHeaders(ownerEmail),
      'Content-Type': 'application/json',
    },
    data: email ? { role, email } : { role },
  });
  const body = await assertOk(response, 'Create invitation');
  return JSON.parse(body) as { id: string; token: string; inviteUrl: string; role: string };
}

// Imported historical sales have no integrated operation and expose fewer actions.
export async function importSalesViaApi(
  request: APIRequestContext,
  email: string,
  rows: Array<{ date: string; clientName: string; device: string; amount: string; status: 'COMPLETADA' | 'PENDIENTE'; exchangeRate?: number }>,
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/sales/import`, {
    headers: { ...authHeaders(email), 'Content-Type': 'application/json' },
    data: { rows },
  });
  const body = await assertOk(response, 'Import historical sales');
  return JSON.parse(body) as { imported: number; errors: Array<{ row: number; message: string }> };
}

export async function createSaleViaApi(
  request: APIRequestContext,
  email: string,
  input: { date: string; clientName: string; clientId?: string; deviceLabel: string; amount: number; amountCurrency?: 'ARS' | 'USD'; paymentMethod?: string; status?: 'COMPLETADA' | 'PENDIENTE' },
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/sales`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: {
      date: input.date,
      clientName: input.clientName,
      clientId: input.clientId,
      deviceLabel: input.deviceLabel,
      amount: input.amount,
      amountCurrency: input.amountCurrency,
      paymentMethod: input.paymentMethod ?? 'EFECTIVO',
      status: input.status ?? 'COMPLETADA',
    },
  });
  const body = await assertOk(response, 'Create sale');
  return JSON.parse(body) as { sale?: { id: string } };
}

export async function createTradeInViaApi(
  request: APIRequestContext,
  email: string,
  input: { date: string; clientName: string; deviceReceived: string; deviceGiven: string; takeValue: number; currency?: 'ARS' | 'USD' },
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/trade-ins`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: {
      date: input.date,
      clientName: input.clientName,
      deviceReceived: input.deviceReceived,
      deviceGiven: input.deviceGiven,
      takeValue: input.takeValue,
      differencePaid: 0,
      status: 'PERITAJE TÉC.',
      currency: input.currency,
      draft: true,
    },
  });
  const body = await assertOk(response, 'Create trade-in');
  return JSON.parse(body) as { tradeIn?: { id: string } };
}

export async function updateStoreViaApi(
  request: APIRequestContext,
  email: string,
  data: {
    currency?: 'ARS' | 'USD';
    exchangeMode?: 'auto' | 'manual';
    exchangeSource?: 'blue' | 'oficial' | 'mep';
    manualBuy?: number | null;
    manualSell?: number | null;
  },
) {
  const response = await request.patch(`${DEFAULT_API_BASE_URL}/api/stores/current`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data,
  });
  const body = await assertOk(response, 'Update store');
  return JSON.parse(body) as { store: { currency: string } };
}

export async function createRepairViaApi(
  request: APIRequestContext,
  email: string,
  input: {
    clientName?: string | null;
    clientId?: string | null;
    device: string;
    fault?: string;
    faultTags?: string[];
    estimate?: number | null;
    deposit?: number;
    currency?: 'ARS' | 'USD' | null;
    status?: string;
    estimatedDelivery?: string | null;
    technician?: string;
    imei?: string;
  },
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/repairs`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: input,
  });
  const body = await assertOk(response, 'Create repair');
  return JSON.parse(body) as { order: { id: string; code: string; status: string; whatsappUrl: string | null } };
}

export async function createInventoryItemViaApi(
  request: APIRequestContext,
  email: string,
  input: InventorySeedInput,
) {
  const response = await request.post(`${DEFAULT_API_BASE_URL}/api/inventory`, {
    headers: {
      ...authHeaders(email),
      'Content-Type': 'application/json',
    },
    data: {
      imei: input.imei,
      model: input.model,
      capacity: input.capacity ?? '128GB',
      color: input.color ?? 'Black',
      condition: input.condition ?? 'NUEVO',
      grade: input.grade ?? 'A+',
      batteryHealth: input.batteryHealth ?? '100%',
      cost: input.cost ?? 900,
      price: input.price ?? 1500,
      status: input.status ?? 'DISPONIBLE',
      categoryId: null,
      customFields: null,
    },
  });

  const body = await assertOk(response, 'Create inventory item');
  return JSON.parse(body) as {
    inventoryItem: { id: string; imei: string; model: string; status: string; price: number };
  };
}

/** Interact with the visible custom selector (its listbox is portaled). */
export async function selectDeskOption(page: Page, control: Locator, label: string) {
  await control.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
