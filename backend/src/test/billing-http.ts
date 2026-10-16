import { vi } from 'vitest';

export function mockMercadoPago() {
  const plans = new Map<string, Record<string, unknown>>();
  const subscriptions = new Map<string, Record<string, unknown>>();
  const invoices = new Map<string, string>();
  const calls: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  let fail = '';
  let failStatus = 503;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://api.mercadopago.com') throw new Error('Unexpected external HTTP');
    const path = url.pathname; const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ path, method, body });
    const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
    if (fail === `${method} ${path}`) return json({ message: 'mock failure' }, failStatus);
    if (path === '/users/me') return json({ id: 123 });
    if (path === '/preapproval_plan/search') return json({ results: [...plans.values()].filter(plan => plan.reason === url.searchParams.get('q')) });
    if (path === '/preapproval_plan' && method === 'POST') {
      const id = `plan-${plans.size + 1}`;
      const remote = { ...body, id, init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${id}` };
      plans.set(id, remote); return json(remote);
    }
    if (path.startsWith('/preapproval_plan/')) {
      const id = path.split('/').at(-1)!; const remote = plans.get(id);
      if (!remote) return json({}, 404);
      if (method === 'PUT') plans.set(id, { ...remote, ...body, auto_recurring: { ...(remote.auto_recurring as object), ...(body.auto_recurring as object) } });
      return json(plans.get(id));
    }
    if (path === '/preapproval' && method === 'POST') {
      const id = `created-${subscriptions.size + 1}`;
      const plan = plans.get(String(body.preapproval_plan_id));
      if (!plan) return json({ message: 'missing plan', cause: [{ code: 'plan' }] }, 400);
      const remote = { id, init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}`, external_reference: body.external_reference, preapproval_plan_id: body.preapproval_plan_id, payer_email: body.payer_email ?? null, status: body.status ?? 'pending', last_modified: new Date().toISOString(), date_created: new Date().toISOString(), auto_recurring: plan.auto_recurring, back_url: body.back_url };
      subscriptions.set(id, remote); return json(remote, 201);
    }
    if (path === '/preapproval/search') return json({ results: [...subscriptions.values()].filter(subscription => subscription.external_reference === url.searchParams.get('external_reference')) });
    if (path.startsWith('/authorized_payments/')) return json({ preapproval_id: invoices.get(path.split('/').at(-1)!) });
    if (path.startsWith('/preapproval/')) {
      const id = path.split('/').at(-1)!; const remote = subscriptions.get(id);
      if (!remote) return json({}, 404);
      if (method === 'PUT') subscriptions.set(id, { ...remote, ...body, last_modified: new Date().toISOString(), auto_recurring: { ...(remote.auto_recurring as object), ...(body.auto_recurring as object) } });
      return json(subscriptions.get(id));
    }
    throw new Error(`Unexpected MP endpoint ${method} ${path}`);
  });
  vi.stubEnv('MP_ACCESS_TOKEN', 'test-placeholder');
  vi.stubEnv('MP_WEBHOOK_SECRET', '');
  vi.stubEnv('MP_PUBLIC_KEY', 'public-key-placeholder');
  vi.stubGlobal('fetch', fetchMock);
  return { plans, subscriptions, invoices, calls, fetchMock, failOn: (value: string, status = 503) => { fail = value; failStatus = status; } };
}
