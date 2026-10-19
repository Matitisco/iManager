import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { PeriodicReportForm, periodicReportSubtitle } from './periodic-report';

const api = vi.hoisted(() => ({
  fetchPeriodicReport: vi.fn(),
  savePeriodicReport: vi.fn(),
}));
const context = vi.hoisted(() => ({
  user: { getIdToken: async () => 'token' },
  appSession: { user: { email: 'dueno@tienda.test' }, store: { email: 'casa@tienda.test' }, membership: { role: 'OWNER' } },
}));

vi.mock('../../services/periodic-report-api', () => api);
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));

const close = vi.fn();

function renderForm(run = vi.fn(async (action: () => Promise<unknown>) => { await action(); })) {
  render(
    <DeskProvider value={{ tab: 'settings', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}>
      <PeriodicReportForm run={run} busy={false} error={null} />
    </DeskProvider>,
  );
  return run;
}

describe('reporte automático en Configuración', () => {
  beforeEach(() => {
    api.fetchPeriodicReport.mockReset();
    api.savePeriodicReport.mockReset();
    api.fetchPeriodicReport.mockResolvedValue({ enabled: false, frequency: 'MONTHLY', recipients: [], lastSentAt: null, lastPeriodLabel: null, lastError: null });
    api.savePeriodicReport.mockResolvedValue({ enabled: true, frequency: 'BIWEEKLY', recipients: ['natan@tienda.test'], lastSentAt: null, lastPeriodLabel: null, lastError: null });
  });

  it('resume el estado para la fila', () => {
    expect(periodicReportSubtitle(false, 'MONTHLY', [])).toBe('Apagado');
    expect(periodicReportSubtitle(true, 'BIWEEKLY', ['a@b.test'])).toBe('Cada 15 días · a@b.test');
    expect(periodicReportSubtitle(true, 'MONTHLY', ['a@b.test', 'c@b.test'])).toBe('Cada mes · 2 correos');
  });

  it('el dueño lo prende, elige cada 15 días y guarda los correos', async () => {
    const user = userEvent.setup();
    const run = renderForm();
    await waitFor(() => expect(screen.getByTestId('periodic-report-recipients')).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Encendido' }));
    await user.click(screen.getByRole('button', { name: 'Cada 15 días' }));
    await user.clear(screen.getByTestId('periodic-report-recipients'));
    await user.type(screen.getByTestId('periodic-report-recipients'), 'natan@tienda.test, otro@tienda.test');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.savePeriodicReport).toHaveBeenCalledWith(expect.anything(), {
      enabled: true,
      frequency: 'BIWEEKLY',
      recipients: ['natan@tienda.test', 'otro@tienda.test'],
    }));
    expect(run).toHaveBeenCalled();
  });

  it('apagado se puede guardar y prendido sin correo no', async () => {
    api.fetchPeriodicReport.mockResolvedValue({ enabled: true, frequency: 'MONTHLY', recipients: [], lastSentAt: null, lastPeriodLabel: null, lastError: 'El servidor todavía no puede enviar correos.' });
    const user = userEvent.setup();
    const run = renderForm();
    expect(await screen.findByRole('status')).toHaveTextContent('El servidor todavía no puede enviar correos.');
    await user.clear(screen.getByTestId('periodic-report-recipients'));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Agregá al menos un correo.')).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Apagado' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(api.savePeriodicReport).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ enabled: false, recipients: [] })));
  });
});
