import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReportMailSettings } from './ReportMailSettings';
const api = vi.hoisted(() => ({ fetchPeriodicReport: vi.fn(), savePeriodicReport: vi.fn(), sendPeriodicReportTest: vi.fn() }));
const context = vi.hoisted(() => ({ user: { uid: 'u' }, backendStatus: 'ready', appSession: { store: { id: 's' }, membership: { role: 'OWNER' }, onboardingRequired: false } }));
vi.mock('../section-notices', () => ({ usePhoneLayout: () => false }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
vi.mock('../../services/periodic-report-api', () => api);
beforeEach(() => {
  vi.resetAllMocks(); context.appSession.membership.role = 'OWNER';
  api.fetchPeriodicReport.mockResolvedValue({ enabled: false, frequency: 'WEEKLY', sendDay: 1, sendTime: '09:00', recipients: ['owner@test.local'], timezone: 'America/Argentina/Buenos_Aires' });
  api.savePeriodicReport.mockResolvedValue({}); api.sendPeriodicReportTest.mockResolvedValue({ sent: true, message: 'Mail de prueba enviado' });
});
it('loads owner default, submits a draft and preserves errors visibly', async () => {
  render(<ReportMailSettings />);
  const recipient = await screen.findByRole('textbox', { name: 'Mail destinatario' });
  await waitFor(() => expect(recipient).toHaveValue('owner@test.local'));
  await userEvent.click(screen.getByRole('switch'));
  await userEvent.clear(recipient); await userEvent.type(recipient, 'nuevo@test.local');
  fireEvent.submit(recipient.closest('form')!);
  await screen.findByText('Configuración guardada');
  expect(api.savePeriodicReport).toHaveBeenCalledWith(context.user, expect.objectContaining({ enabled: true, recipients: ['nuevo@test.local'], sendDay: 1, sendTime: '09:00' }));
  api.savePeriodicReport.mockRejectedValue(new Error('No se pudo guardar'));
  fireEvent.submit(recipient.closest('form')!);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar');
  expect(recipient).toHaveValue('nuevo@test.local');
});
it('test uses unsaved settings without saving or enabling automatic reports', async () => {
  render(<ReportMailSettings />);
  const button = screen.getByRole('button', { name: 'Enviar mail de prueba' });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
  expect(await screen.findByRole('status')).toHaveTextContent('Mail de prueba enviado');
  expect(api.sendPeriodicReportTest).toHaveBeenCalledWith(context.user, expect.objectContaining({ enabled: false, frequency: 'WEEKLY' }));
  expect(api.savePeriodicReport).not.toHaveBeenCalled();
  api.sendPeriodicReportTest.mockResolvedValue({ sent: false, message: 'El servidor todavía no puede enviar correos.' });
  await userEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('El servidor todavía no puede enviar correos.');
});
it('does not load settings for staff', () => {
  context.appSession.membership.role = 'STAFF'; render(<ReportMailSettings />);
  expect(api.fetchPeriodicReport).not.toHaveBeenCalled(); expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});
