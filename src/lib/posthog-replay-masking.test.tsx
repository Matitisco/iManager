import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';
import { EventType, record, takeFullSnapshot } from 'posthog-js/rrweb';
import { ImportPreviewList } from '../components/ImportPreviewList';
import { ClientField } from '../desk/ClientField';
import { PasswordForm } from '../desk/overlays/account';
import { BillingScreen } from '../desk/screens/BillingScreen';
import { DeskProvider } from '../desk/ui';
import { AuthActionPage } from '../pages/AuthActionPage';
import { Login } from '../pages/Login';

vi.mock('posthog-js', () => ({ default: { init: vi.fn(), capture: vi.fn() } }));
vi.mock('../services/auth-adapter', () => ({
  getAuthAdapter: () => ({ completeGoogleRedirect: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../hooks/useInvitationPreview', () => ({
  useInvitationPreview: () => ({ preview: null, invalid: false, error: null, isLoading: false }),
}));
vi.mock('../services/auth-action', () => ({ verifyResetCode: vi.fn().mockResolvedValue('owner@example.test') }));

const state = vi.hoisted(() => {
  const summary = { plan: 'TRIAL', status: 'TRIAL', period: null, trialEndsAt: '2099-01-01T00:00:00Z', paidThrough: null, trialDaysLeft: 7, readOnly: false, memberLimit: 3, members: 1, overLimit: false, canCancel: false };
  const offer = { key: 'BASIC_MONTHLY', name: 'Básico', plan: 'BASIC', period: 'MONTHLY', usd: 22, months: 1, users: 3, amountArs: 22000, exchangeRate: 1000 };
  return {
    login: vi.fn(), loginWithEmail: vi.fn(), registerWithEmail: vi.fn(),
    user: { providerData: [{ providerId: 'password' }] },
    appSession: { user: { email: 'payer@example.test' }, store: { id: 's' }, membership: { role: 'OWNER' }, billing: summary },
    billingDetails: { ...summary, plans: [offer] },
    loadBilling: vi.fn().mockResolvedValue({ ...summary, plans: [offer] }),
    quoteSubscription: vi.fn().mockResolvedValue({ id: 'q', key: 'BASIC_MONTHLY', usd: 22, amountArs: 22000, exchangeRate: 1000, payerEmail: 'payer@example.test', expiresAt: '2099-01-01' }),
  };
});
vi.mock('../context/AppContext', () => ({ useAppContext: () => state }));

let replayConfig: NonNullable<NonNullable<Parameters<typeof posthog.init>[1]>['session_recording']>;

beforeAll(async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('MODE', 'production'); vi.stubEnv('VITEST', '');
  vi.stubEnv('VITE_TEST_AUTH_MODE', ''); vi.stubEnv('VITE_E2E', '');
  vi.stubEnv('VITE_POSTHOG_DISABLED', ''); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  const listeners: Array<[string, EventListener]> = [];
  const add = window.addEventListener.bind(window);
  const spy = vi.spyOn(window, 'addEventListener').mockImplementation((name, listener, options) => {
    if (name === 'hashchange' || name === 'popstate') listeners.push([name, listener as EventListener]);
    add(name, listener, options);
  });
  try {
    (await import('./posthog-analytics')).initAnalytics();
    replayConfig = vi.mocked(posthog.init).mock.calls[0][1]!.session_recording!;
  } finally {
    for (const [name, listener] of listeners) window.removeEventListener(name, listener);
    history.pushState = pushState; history.replaceState = replaceState;
    spy.mockRestore(); vi.unstubAllEnvs();
  }
});

// Exercise PostHog's bundled recorder instead of imitating masking in a test helper.
function replaySnapshot() {
  let snapshot = '';
  const stop = record({
    maskAllInputs: replayConfig.maskAllInputs,
    maskInputOptions: replayConfig.maskInputOptions,
    maskTextSelector: replayConfig.maskTextSelector,
    // Native PostHog recorder defaults; no custom text selector is needed.
    blockClass: 'ph-no-capture', maskTextClass: 'ph-mask', inlineStylesheet: false,
    emit: event => { if (event.type === EventType.FullSnapshot) snapshot = JSON.stringify(event.data.node); },
  });
  try {
    takeFullSnapshot();
    expect(snapshot).not.toBe('');
    return snapshot;
  } finally { stop?.(); }
}

function desk(children: React.ReactNode) {
  return render(<DeskProvider value={{ tab: 'billing', go: vi.fn(), open: vi.fn(), close: vi.fn(), openRecord: vi.fn(), toast: vi.fn(), isStaff: false }}>{children}</DeskProvider>);
}

describe('open replay policy', () => {
  it('disables blanket input and text masking while keeping password masking', () => {
    expect(replayConfig.maskAllInputs).toBe(false);
    expect(replayConfig).not.toHaveProperty('maskTextSelector');
    expect(replayConfig.maskInputOptions).toEqual({ password: true });
  });

  it.each(['table', 'cards'] as const)('records import headings and data despite legacy markers in %s previews', layout => {
    render(<ImportPreviewList rows={[{ name: 'Ana visible', phone: '1122334455', email: 'ana@example.test', dni: '30123456' }]}
      columns={[{ key: 'name', label: 'Nombre' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Email' }, { key: 'dni', label: 'DNI' }]}
      currency="ARS" nouns={{ one: 'cliente', many: 'clientes' }} layout={layout} />);
    expect(screen.getByText('Ana visible').closest('[data-ph-mask]')).not.toBeNull();
    const snapshot = replaySnapshot();
    for (const text of ['Clientes a importar', 'Ana visible', '1122334455', 'ana@example.test', '30123456']) expect(snapshot).toContain(text);
  });

  it('records ordinary input values and changes', () => {
    function ClientInput() {
      const [value, setValue] = useState('Cliente visible');
      return <ClientField clients={[]} value={value} linked={false} onValue={setValue} onPick={vi.fn()} />;
    }
    render(<ClientInput />);
    expect(replaySnapshot()).toContain('Cliente visible');
    fireEvent.change(screen.getByRole('combobox', { name: 'Cliente' }), { target: { value: 'Texto actualizado' } });
    expect(replaySnapshot()).toContain('Texto actualizado');
  });

  it.each([false, true])('blocks login/registration passwords even when revealed (registration=%s)', async registration => {
    const { container } = render(<Login initialRegisterMode={registration} />);
    const password = await screen.findByTestId('login-password');
    fireEvent.change(password, { target: { value: 'secret-login-password' } });
    const confirmation = registration ? screen.getByPlaceholderText('Confirmar contraseña') : null;
    if (confirmation) fireEvent.change(confirmation, { target: { value: 'secret-confirmation' } });
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveClass('ph-no-capture');
    expect(replaySnapshot()).not.toContain('secret-login-password');
    fireEvent.click(container.querySelector('svg.lucide-eye')!.closest('button')!);
    expect(password).toHaveAttribute('type', 'text');
    const snapshot = replaySnapshot();
    expect(snapshot).not.toContain('secret-login-password');
    if (confirmation) {
      expect(confirmation).toHaveAttribute('type', 'text');
      expect(confirmation).toHaveClass('ph-no-capture');
      expect(snapshot).not.toContain('secret-confirmation');
    }
    expect(snapshot).toContain('Correo electrónico');
  });

  it('blocks both reset passwords before and after the visibility toggle', async () => {
    render(<AuthActionPage link={{ mode: 'resetPassword', oobCode: 'test-code', apiKey: 'key', continueUrl: null, lang: 'es' }} onDone={vi.fn()} />);
    const password = await screen.findByTestId('reset-password');
    const confirmation = screen.getByTestId('reset-password-confirm');
    fireEvent.change(password, { target: { value: 'secret-reset-password' } });
    fireEvent.change(confirmation, { target: { value: 'secret-reset-confirmation' } });
    for (const input of [password, confirmation]) {
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveClass('ph-no-capture');
    }
    expect(replaySnapshot()).not.toContain('secret-reset-');
    fireEvent.click(screen.getByTestId('reset-password-toggle'));
    for (const input of [password, confirmation]) expect(input).toHaveAttribute('type', 'text');
    expect(replaySnapshot()).not.toContain('secret-reset-');
  });

  it('masks account passwords through the configured SDK password option', () => {
    desk(<PasswordForm run={vi.fn()} busy={false} error="" />);
    for (const label of ['Contraseña actual', 'Nueva contraseña', 'Repetir nueva']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('type', 'password');
      fireEvent.change(input, { target: { value: 'secret-account-password' } });
    }
    const snapshot = replaySnapshot();
    expect(snapshot).not.toContain('secret-account-password');
    expect(snapshot).toContain('*'.repeat('secret-account-password'.length));
  });

  it('blocks the existing payment email in display and edit modes with the native class', async () => {
    desk(<BillingScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Suscribirme a Básico' }));
    const payer = await screen.findByText('payer@example.test');
    expect(payer).toHaveClass('ph-no-capture');
    expect(replaySnapshot()).not.toContain('payer@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    const input = screen.getByRole('textbox', { name: 'Email del pagador' });
    expect(input).toHaveClass('ph-no-capture');
    fireEvent.change(input, { target: { value: 'secret-payer@example.test' } });
    const snapshot = replaySnapshot();
    expect(snapshot).not.toContain('secret-payer@example.test');
    expect(snapshot).toContain('Email del pago');
  });
});
