import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { HelpScreen } from './HelpScreen';
import { dismissInstall, installDismissedForever } from '../../lib/pwa';

vi.mock('../../context/AppContext', () => ({ useAppContext: () => ({ appSession: { membership: { role: 'OWNER' } } }) }));
vi.mock('../ui', () => ({ useDesk: () => ({ open: vi.fn(), back: vi.fn() }), ScreenTitle: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock('../first-steps-island', () => ({ FirstStepsHelp: () => null }));

it('keeps installation help available after permanent dismissal without resetting it', () => {
  dismissInstall(); render(<HelpScreen />);
  expect(screen.getByText('Siempre disponible, aunque hayas ocultado la invitación')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Instalar la app en el celular/ }));
  expect(screen.getByRole('dialog', { name: 'Instalá iManager' })).toBeVisible();
  expect(installDismissedForever()).toBe(true);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull(); expect(installDismissedForever()).toBe(true);
});
