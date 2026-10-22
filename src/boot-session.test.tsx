import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { AppProvider, useAppContext } from './context/AppContext';
import { readBootSession, readStoreLists, writeBootSession, writeStoreLists } from './lib/boot-cache';
import * as commissionsApi from './services/commissions-api';
import type { AppSession } from './types/app-session';

const auth = vi.hoisted(() => ({
  user: null as null | { uid: string; email: string; displayName: string; photoURL: null; getIdToken: () => Promise<string> },
  listener: null as null | ((user: unknown) => void),
}));

vi.mock('./firebase', () => ({ auth: {}, googleProvider: {} }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {},
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  applyActionCode: vi.fn(),
  checkActionCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  verifyPasswordResetCode: vi.fn(),
}));
vi.mock('./services/auth-adapter', () => ({
  getAuthAdapter: () => ({
    mode: 'e2e' as const,
    getCurrentUser: () => auth.user,
    onAuthStateChanged: (callback: (user: unknown) => void) => {
      auth.listener = callback;
      callback(auth.user);
      return () => { if (auth.listener === callback) auth.listener = null; };
    },
    loginWithGoogle: vi.fn(),
    loginWithEmail: vi.fn(),
    registerWithEmail: vi.fn(),
    logout: async () => {
      auth.user = null;
      auth.listener?.(null);
    },
  }),
}));

const sessionFetch = vi.hoisted(() => vi.fn());
vi.mock('./services/backend-session', () => ({
  getBackendBaseUrl: () => 'https://api.test',
  fetchBackendSession: (...args: unknown[]) => sessionFetch(...args),
}));
vi.mock('./services/inventory-api', () => ({ fetchBackendInventory: () => new Promise(() => {}) }));
vi.mock('./services/sales-api', () => ({ fetchBackendSales: () => new Promise(() => {}) }));
vi.mock('./services/clients-api', () => ({
  fetchBackendClients: () => new Promise(() => {}),
  fetchClientCategoriesApi: () => new Promise(() => {}),
}));
vi.mock('./services/trade-ins-api', () => ({ fetchBackendTradeIns: () => new Promise(() => {}) }));
vi.mock('./services/repairs-api', () => ({ fetchBackendRepairs: () => new Promise(() => {}) }));
vi.mock('./services/operations-api', () => ({
  fetchNotifications: () => new Promise(() => {}),
  fetchOperationDrafts: () => new Promise(() => {}),
}));

const session = {
  user: { id: 'app-user', firebaseUid: 'user-1', email: 'ana@test.com', displayName: 'Ana', avatarUrl: null },
  store: { id: 'store-1', name: 'Casa', currency: 'ARS', exchangeMode: 'manual', manualBuy: 1000, manualSell: 1100 },
  membership: { role: 'OWNER', isDefault: true },
  onboardingRequired: false,
} as AppSession;

function signedIn() {
  auth.user = {
    uid: 'user-1',
    email: 'ana@test.com',
    displayName: 'Ana',
    photoURL: null,
    getIdToken: async () => 'token',
  };
  writeBootSession({ uid: 'user-1', email: 'ana@test.com', displayName: 'Ana', photoURL: null, session });
  writeStoreLists('store-1', {
    inventory: [],
    sales: [{
      id: 'sale-1', saleNumber: 4, date: '2026-10-02', clientId: '', clientName: 'Venta guardada',
      productId: '', deviceLabel: 'Pixel', amount: 1000, paymentMethod: 'EFECTIVO', status: 'COMPLETADA',
    }],
    tradeIns: [{
      id: 'trade-1', tradeNumber: 2, date: '2026-10-04', clientId: '', clientName: 'Canje guardado',
      deviceReceived: 'iPhone 13', deviceReceivedImei: '', takeValue: 1000, deviceGiven: 'Pixel',
      differencePaid: 200, status: 'EN REVISIÓN',
    }],
    clients: [],
    clientCategories: [],
    savedAt: 1,
  });
}

beforeEach(() => {
  auth.user = null;
  auth.listener = null;
  sessionFetch.mockReset();
});

describe('apertura de sesión', () => {
  it('abre el shell con la caché y sin la pantalla de sesión segura', async () => {
    signedIn();
    sessionFetch.mockReturnValue(new Promise(() => undefined));
    render(<App />);
    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();
    expect(screen.getByText('Venta guardada')).toBeInTheDocument();
    expect(screen.getByText(/Canje guardado/)).toBeInTheDocument();
    expect(screen.queryByText('Resolviendo sesión segura')).not.toBeInTheDocument();
    expect(screen.queryByText('Todavía no registraste ventas')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin canjes en curso')).not.toBeInTheDocument();
  });

  it('manda al login cuando el token no es válido y borra la caché', async () => {
    signedIn();
    sessionFetch.mockResolvedValue({ status: 'unauthorized', session: null, message: 'La sesión venció. Volvé a entrar.' });
    render(<App />);
    expect(await screen.findByTestId('login-email')).toBeInTheDocument();
    expect(screen.queryByText('Resolviendo sesión segura')).not.toBeInTheDocument();
    expect(readBootSession()).toBeNull();
    expect(readStoreLists('store-1')).toBeNull();
  });

  it('no pide comisiones de dueño con el rol cacheado', async () => {
    signedIn();
    const summary = vi.spyOn(commissionsApi, 'fetchCommissionSummary').mockResolvedValue({ people: [], summary: { salesCount: 0 }, period: { key: '2026-10' } } as never);
    const rules = vi.spyOn(commissionsApi, 'fetchCommissionRules').mockResolvedValue([]);
    const mine = vi.spyOn(commissionsApi, 'fetchMyCommissions').mockResolvedValue({ period: { key: '2026-10' }, person: { pending: { ARS: 0, USD: 0 } } } as never);
    sessionFetch.mockResolvedValue({
      status: 'ready',
      session: {
        ...session,
        user: { ...session.user, displayName: 'Sofía' },
        membership: { role: 'STAFF', isDefault: true, sections: ['dashboard', 'inventory', 'sales', 'tradeins', 'clients', 'notifications'] },
      },
      message: null,
    });
    render(<App />);
    await waitFor(() => expect(screen.getByText('Hola, Sofía')).toBeInTheDocument());
    await waitFor(() => expect(mine).toHaveBeenCalled());
    expect(summary).not.toHaveBeenCalled();
    expect(rules).not.toHaveBeenCalled();
    summary.mockRestore();
    rules.mockRestore();
    mine.mockRestore();
  });

  it('borra la caché al cerrar sesión', async () => {
    signedIn();
    sessionFetch.mockReturnValue(new Promise(() => undefined));
    function Salir() {
      const { logout } = useAppContext();
      return <button type="button" onClick={() => void logout()}>Salir</button>;
    }
    render(<AppProvider><Salir /></AppProvider>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Salir' }));
    expect(readBootSession()).toBeNull();
    expect(readStoreLists('store-1')).toBeNull();
  });
});
