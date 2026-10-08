import { expect, type APIRequestContext, type APIResponse, type Page, type TestInfo } from '@playwright/test';

const DEFAULT_PASSWORD = process.env.VITE_E2E_TEST_PASSWORD?.trim() || 'test123456';
const DEFAULT_API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL?.trim() || 'http://127.0.0.1:3100';

type InventorySeedInput = {
  imei: string;
  model: string;
  price?: number;
  cost?: number;
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

function authHeaders(email: string) {
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
  await page.goto('/');
  await expect(page.getByTestId('login-email')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click({ noWaitAfter: true });
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

export async function bootstrapStoreViaApi(
  page: Page,
  request: APIRequestContext,
  email: string,
  storeName: string,
) {
  await loginViaUi(page, email);

  const currentSession = await fetchSessionEventually(request, email);
  if (currentSession.onboardingRequired) {
    const response = await request.post(`${DEFAULT_API_BASE_URL}/api/onboarding`, {
      headers: {
        ...authHeaders(email),
        'Content-Type': 'application/json',
      },
      data: { storeName },
    });
    await assertOk(response, 'Complete onboarding');
  }

  await waitForSessionReady(request, email);
  await page.reload();
  await expect(page.getByTestId('sidebar-tab-inventory')).toBeVisible();
}

export async function bootstrapStore(
  page: Page,
  request: APIRequestContext,
  email: string,
  storeName: string,
) {
  await loginViaUi(page, email);
  const onboardingStoreName = page.getByTestId('onboarding-store-name');
  const sidebarInventory = page.getByTestId('sidebar-tab-inventory');

  await Promise.any([
    onboardingStoreName.waitFor({ state: 'visible', timeout: 15_000 }),
    sidebarInventory.waitFor({ state: 'visible', timeout: 15_000 }),
  ]);

  const onboardingVisible = await onboardingStoreName.isVisible().catch(() => false);

  if (onboardingVisible) {
    const onboardingSubmit = page.getByTestId('onboarding-submit');
    await onboardingStoreName.fill(storeName);
    await expect(onboardingSubmit).toBeEnabled();
    const onboardingRequest = page.waitForResponse(
      (response) =>
        response.url().includes('/api/onboarding') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 15_000 },
    );
    await onboardingSubmit.click({ noWaitAfter: true });
    await onboardingRequest;
    const skipContact = page.getByRole('button', { name: 'Ahora no' });
    const contactShown = await skipContact.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (contactShown) await skipContact.click();
  }

  await waitForSessionReady(request, email);
  await expect(sidebarInventory).toBeVisible();
}

export async function fetchInventory(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/inventory`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch inventory');
  return JSON.parse(body) as { inventory: Array<{ id: string; imei: string; model: string; capacity: string; color: string; condition: string; grade: string; batteryHealth: string; status: string; cost: number; price: number; pendingSaleRegistration?: boolean }> };
}

export async function fetchClients(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/clients`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch clients');
  return JSON.parse(body) as { clients: Array<{ id: string; name: string; dni: string }> };
}

export async function fetchSales(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/sales`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch sales');
  return JSON.parse(body) as {
    sales: Array<{ id: string; clientId: string; productId: string; deviceLabel?: string; status: string; amount: number }>;
  };
}

export async function fetchTradeIns(request: APIRequestContext, email: string) {
  const response = await request.get(`${DEFAULT_API_BASE_URL}/api/trade-ins`, {
    headers: authHeaders(email),
  });
  const body = await assertOk(response, 'Fetch trade-ins');
  return JSON.parse(body) as {
    tradeIns: Array<{ id: string; clientId: string; clientName: string; deviceReceived: string; deviceGiven?: string; status: string; confirmationStatus?: string | null; differencePaid: number }>;
  };
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
      capacity: '128GB',
      color: 'Black',
      condition: 'NUEVO',
      grade: 'A+',
      batteryHealth: '100%',
      cost: input.cost ?? 900,
      price: input.price ?? 1500,
      status: 'DISPONIBLE',
      categoryId: null,
      customFields: null,
    },
  });

  const body = await assertOk(response, 'Create inventory item');
  return JSON.parse(body) as {
    inventoryItem: { id: string; imei: string; model: string; status: string; price: number };
  };
}
