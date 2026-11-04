import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSession } from '../../types/app-session';
import { groupBalance, groupSession } from '../../test/store-group-fixtures';
import { fetchStoreGroupBalance } from '../../services/store-group-api';
import { DeskProvider } from '../ui';
import { BalanceScreen, shortBalanceMoney } from './BalanceScreen';
const ctx = vi.hoisted(() => ({ appSession: null as AppSession | null, user: { uid: 'firebase-test' } }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/store-group-api', () => ({ fetchStoreGroupBalance: vi.fn() }));
function wrap() { return render(<DeskProvider value={{ tab: 'balance', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><BalanceScreen /></DeskProvider>); }
beforeEach(() => { vi.clearAllMocks(); ctx.appSession = groupSession(); vi.mocked(fetchStoreGroupBalance).mockResolvedValue(groupBalance()); });

describe('Balance', () => {
  it('muestra el período y las tres tarjetas con ganancia neta', async () => {
    wrap(); expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    await screen.findByRole('article', { name: 'General' });
    expect(screen.getByRole('article', { name: 'Mayorista' })).toHaveTextContent('$ 48,2M');
    expect(screen.getByRole('article', { name: 'Mayorista' })).toHaveTextContent('ganancia $ 6,9M');
    expect(screen.getByRole('article', { name: 'Minorista' })).toHaveTextContent('ganancia $ 3,1M');
    expect(screen.getByRole('article', { name: 'General' })).toHaveTextContent('$ 60,8M');
    expect(screen.getByRole('combobox', { name: 'Período del balance' })).toHaveTextContent('Últimos 6 meses');
    expect(fetchStoreGroupBalance).toHaveBeenCalledWith(ctx.user, 6);
  });
  it('elige por defecto el último mes; elegir otra barra actualiza el detalle', async () => {
    wrap(); await screen.findByRole('article', { name: 'General' });
    expect(screen.getByRole('button', { name: '2026-06' })).toHaveAttribute('aria-pressed', 'true');
    const detail = screen.getByRole('region', { name: 'Detalle Mayorista' });
    expect(detail).toHaveTextContent('junio'); expect(detail).toHaveTextContent('$ 200'); expect(detail).toHaveTextContent('$ 80');
    fireEvent.click(screen.getByRole('button', { name: '2026-05' }));
    expect(detail).toHaveTextContent('mayo'); expect(detail).toHaveTextContent('$ 100'); expect(detail).toHaveTextContent('$ 30');
  });
  it('cambia a 3/12 meses y recarga los importes', async () => {
    wrap(); await screen.findByRole('article', { name: 'General' });
    for (const months of [3, 12]) {
      fireEvent.click(screen.getByRole('combobox')); fireEvent.click(screen.getByRole('option', { name: `Últimos ${months} meses` }));
      await waitFor(() => expect(fetchStoreGroupBalance).toHaveBeenLastCalledWith(ctx.user, months));
      await screen.findByRole('article', { name: 'General' });
    }
  });
  it('avisa monedas diferentes y oculta General', async () => {
    vi.mocked(fetchStoreGroupBalance).mockResolvedValue({ ...groupBalance(), mixedCurrency: true, combined: null });
    wrap(); await screen.findByRole('article', { name: 'Mayorista' });
    expect(screen.getByRole('status')).toHaveTextContent('monedas distintas');
    expect(screen.queryByRole('article', { name: 'General' })).not.toBeInTheDocument();
  });
  it('muestra error y permite reintentar', async () => {
    vi.mocked(fetchStoreGroupBalance).mockRejectedValueOnce(new Error('Revisá la cotización.'));
    wrap(); expect(await screen.findByRole('alert')).toHaveTextContent('Revisá la cotización.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('article', { name: 'General' });
  });
  it('maneja un período sin movimientos', async () => {
    const empty = groupBalance(); empty.months = []; empty.stores = []; empty.combined = null;
    vi.mocked(fetchStoreGroupBalance).mockResolvedValue(empty);
    wrap(); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Todavía no hay movimientos'));
  });
  it.each(['STAFF', 'MANAGER', 'single', 'partial-owner'])('deniega Balance y no consulta datos para %s', role => {
    if (role === 'single') ctx.appSession!.stores = [{ ...ctx.appSession!.stores![0], groupId: null }];
    else if (role === 'partial-owner') ctx.appSession!.stores![1].role = 'MANAGER';
    else ctx.appSession!.membership!.role = role as 'STAFF' | 'MANAGER';
    wrap(); expect(screen.getByTestId('no-section-access')).toBeVisible(); expect(fetchStoreGroupBalance).not.toHaveBeenCalled();
  });
  it('a 390 conserva los meses en un gráfico con columnas flexibles y sin ancho fijo', async () => {
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation(query => ({ matches: String(query).includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    try {
      wrap(); await screen.findByRole('article', { name: 'General' });
      const chart = screen.getByRole('group', { name: 'Elegí un mes' });
      expect(chart.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
      expect(chart.style.width).toBe('');
      expect(within(chart).getAllByRole('button')).toHaveLength(2);
      expect(screen.getByRole('combobox')).toBeVisible();
    } finally { window.matchMedia = original; }
  });
});
it('formatea importes cortos y negativos sin perder el signo', () => {
  expect(shortBalanceMoney(48200000)).toBe('$ 48,2M'); expect(shortBalanceMoney(-6900000)).toBe('$ -6,9M'); expect(shortBalanceMoney(0)).toBe('$ 0');
});
