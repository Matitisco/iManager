import posthog from 'posthog-js';
import { sanitizeImportEvent, type ImportEventProperties } from './import-diagnostics';
import { ROUTE, tabFromHash } from '../desk/hash-route';
import type { AppMembershipRole } from '../types/app-session';

export type SaleCreatedProps = {
  quantity?: number;
  unit_price?: number;
  total?: number;
  currency?: 'ARS' | 'USD';
  model?: string;
  capacity?: string;
  stock_deducted?: boolean;
  stock_left?: number;
  sale_id?: string;
  status?: 'COMPLETADA' | 'PENDIENTE';
};

type EventProps = {
  import_analysis_completed: ImportEventProperties;
  import_result: ImportEventProperties;
  signup_completed: undefined;
  onboarding_step_completed: { step: 'store' | 'stock' };
  onboarding_step_skipped: { step: 'stock' };
  first_device_added: undefined;
  excel_import_succeeded: { rows: number };
  excel_import_failed: { rows: number };
  sale_created: SaleCreatedProps;
  trade_in_created: undefined;
  employee_invite_sent: undefined;
  employee_invite_accepted: undefined;
};

let initialized = false;
let identity: string | null = null;
let store: string | null = null;
let identityKey = '';
let lastPage = '';
const emptyStores = new Set<string>();
const addedStores = new Set<string>();

function disabled(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'test' || Boolean(import.meta.env.VITEST)
    || import.meta.env.VITE_TEST_AUTH_MODE === 'e2e'
    || ['1', 'true'].includes(import.meta.env.VITE_E2E ?? '')
    || ['1', 'true'].includes(import.meta.env.VITE_POSTHOG_DISABLED ?? '')
    || typeof window === 'undefined' || navigator.webdriver === true
    || !(import.meta.env.VITE_POSTHOG_KEY ?? 'phc_yusUYUHJ7W28DSuYBW6v6n7te8VbzkZZcXnracPnXaeo').trim();
}

/** Only fixed route labels leave the browser. Never queries, record IDs or invite tokens. */
function pageUrl(): string {
  const path = window.location.pathname;
  const section = path.startsWith('/invite/') ? '/invite'
    : path.startsWith('/c/') ? '/catalog'
    : path !== '/' ? '/account'
    : window.location.hash ? `/#/${ROUTE[tabFromHash(window.location.hash)]}` : '/';
  return `${window.location.origin}${section}`;
}

function pageview(): void {
  try {
    if (disabled() || !initialized) return;
    const url = pageUrl();
    if (url === lastPage) return;
    lastPage = url;
    posthog.capture('$pageview', { $current_url: url });
  } catch { /* Analytics never controls navigation. */ }
}

function stripUrls(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const object = value as Record<string, unknown>;
    if (/url|pathname|referrer|\butm_|\bgclid|\bfbclid/i.test(key)) delete object[key];
    else stripUrls(object[key]);
  }
}

export function initAnalytics(): void {
  try {
    if (disabled() || initialized) return;
    posthog.init(import.meta.env.VITE_POSTHOG_KEY ?? 'phc_yusUYUHJ7W28DSuYBW6v6n7te8VbzkZZcXnracPnXaeo', {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: false,
      mask_all_element_attributes: false,
      save_campaign_params: false,
      save_referrer: false,
      ip: false,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      disable_web_experiments: true,
      capture_exceptions: false,
      enable_heatmaps: false,
      capture_dead_clicks: false,
      capture_performance: false,
      enable_recording_console_log: false,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: false,
        maskInputOptions: { password: true },
        maskAllElementAttributes: false,
        recordHeaders: false,
        recordBody: false,
        recordCrossOriginIframes: false,
        captureCanvas: { recordCanvas: false },
        captureJsonLd: false,
        maskCapturedNetworkRequestFn: () => null,
      },
      // SDK-generated URLs can contain reset codes, invitation tokens and filters.
      before_send: event => {
        if (!event) return null;
        stripUrls(event.properties);
        if (event.event === 'import_analysis_completed' || event.event === 'import_result') {
          // Registered SDK superproperties are merged after capture's allowlist.
          for (const key of ['name', 'email', 'store_name']) delete event.properties[key];
        }
        event.properties.$current_url = pageUrl();
        event.properties.$pathname = new URL(pageUrl()).pathname;
        return event;
      },
    });
    initialized = true;
    window.addEventListener('hashchange', pageview);
    window.addEventListener('popstate', pageview);
    // replaceState is also used when leaving onboarding without a hashchange.
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = window.history[method];
      window.history[method] = function (...args: Parameters<History[typeof method]>) {
        original.apply(this, args);
        pageview();
      };
    }
    pageview();
  } catch { /* SDK, storage and browser failures must not break the app. */ }
}

export function capture<Name extends keyof EventProps>(name: Name, ...args: EventProps[Name] extends undefined ? [] : [EventProps[Name]]): void {
  try {
    if (disabled() || !initialized) return;
    const input = args[0];
    if (name === 'sale_created') {
      const source = input as SaleCreatedProps | undefined;
      const props: SaleCreatedProps = {};
      for (const key of ['quantity', 'unit_price', 'total', 'stock_left'] as const) {
        const value = source?.[key];
        if (typeof value === 'number' && Number.isFinite(value)) props[key] = value;
      }
      for (const key of ['model', 'capacity', 'sale_id'] as const) {
        const value = source?.[key];
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) props[key] = key === 'sale_id' ? trimmed : trimmed.slice(0, 60);
      }
      if (source?.currency === 'ARS' || source?.currency === 'USD') props.currency = source.currency;
      if (typeof source?.stock_deducted === 'boolean') props.stock_deducted = source.stock_deducted;
      if (source?.status === 'COMPLETADA' || source?.status === 'PENDIENTE') props.status = source.status;
      posthog.capture(name, props);
      return;
    }
    if (name === 'import_analysis_completed' || name === 'import_result') {
      const props = sanitizeImportEvent(input as ImportEventProperties);
      if (props) posthog.capture(name, props);
      return;
    }
    let props: { rows?: number; step?: string } | undefined;
    if (name === 'excel_import_succeeded' || name === 'excel_import_failed') {
      const rows = input && 'rows' in input ? input.rows : 0;
      props = { rows: Number.isFinite(rows) ? Math.max(0, Math.trunc(rows)) : 0 };
    } else if (name === 'onboarding_step_completed' || name === 'onboarding_step_skipped') {
      const step = input && 'step' in input ? input.step : undefined;
      if (step !== 'stock' && !(name === 'onboarding_step_completed' && step === 'store')) return;
      props = { step };
    } else if (!['signup_completed', 'first_device_added', 'trade_in_created', 'employee_invite_sent', 'employee_invite_accepted'].includes(name)) return;
    posthog.capture(name, props);
  } catch { /* Best effort only. */ }
}

export type IdentityDetails = { email?: string | null; name?: string | null; storeName?: string | null };

/** Owner-requested identification: email, user name and store name so each account is recognisable. */
export function identify(userId: string, storeId: string | null, role: AppMembershipRole | null, details: IdentityDetails = {}): void {
  try {
    if (disabled() || !initialized || !userId) return;
    const email = details.email ?? null;
    const name = details.name ?? null;
    const storeName = details.storeName ?? null;
    const key = JSON.stringify([userId, storeId, role, email, name, storeName]);
    if (key === identityKey) return;
    if (identity && identity !== userId) reset();
    posthog.identify(userId, { store_id: storeId, role, email, name, store_name: storeName });
    posthog.register({ store_id: storeId, role, store_name: storeName });
    if (storeId) posthog.group('store', storeId, { name: storeName });
    identity = userId; store = storeId; identityKey = key;
  } catch { /* Never block session bootstrap. */ }
}

export function reset(): void {
  try {
    if (disabled() || !initialized) return;
    posthog.reset();
  } catch { /* Logout still succeeds if storage/SDK fails. */ }
  finally { identity = null; store = null; identityKey = ''; }
}

/** Baseline only after a successful inventory read; never infer an empty store from loading. */
export function observeInventory(count: number): void {
  try {
    if (disabled() || !initialized || !store) return;
    if (count === 0) emptyStores.add(store);
    else {
      emptyStores.delete(store);
      addedStores.add(store);
      try { localStorage.setItem(`imanager:posthog:first-device:${store}`, '1'); } catch { /* Memory still prevents duplicates. */ }
    }
  } catch { /* Best effort. */ }
}

/** Deduplicated per store/browser, across manual, batch and import writes. */
export function deviceAdded(): void {
  try {
    if (disabled() || !initialized || !store || !emptyStores.has(store) || addedStores.has(store)) return;
    const key = `imanager:posthog:first-device:${store}`;
    try { if (localStorage.getItem(key)) return; } catch { /* Use in-memory dedupe. */ }
    addedStores.add(store);
    emptyStores.delete(store);
    capture('first_device_added');
    try { localStorage.setItem(key, '1'); } catch { /* Use in-memory dedupe. */ }
  } catch { /* Best effort. */ }
}
