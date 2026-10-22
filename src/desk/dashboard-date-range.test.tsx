import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardDateRange } from './dashboard-date-range';
const apply = vi.fn();
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T12:00:00-03:00')); });
afterEach(() => vi.useRealTimers());
const setup = () => render(<DashboardDateRange range={{ start: '2026-10-01', end: '2026-10-22' }} onApply={apply} phone={false} />);
describe('selector de rango Dashboard', () => {
  it('selecciona extremos invertidos, confirma explícitamente y deshabilita futuro', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '23 de octubre de 2026' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: '20 de octubre de 2026' }));
    await user.click(within(dialog).getByRole('button', { name: '10 de octubre de 2026' }));
    expect(apply).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: '15 de octubre de 2026' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Aplicar' }));
    expect(apply).toHaveBeenCalledWith({ start: '2026-10-10', end: '2026-10-20' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('descarta borrador al cerrar con Escape y restaura el foco', async () => {
    const user = userEvent.setup(); setup();
    const trigger = screen.getByRole('button', { name: /Elegir período/ });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Hoy' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(apply).not.toHaveBeenCalled();
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('presets y cierre externo mantienen el período aplicado', async () => {
    const user = userEvent.setup(); setup();
    await user.click(screen.getByRole('button', { name: /Elegir período/ }));
    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByText('Septiembre 2026')).toBeVisible();
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(apply).not.toHaveBeenCalled();
  });
});
