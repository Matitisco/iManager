import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client, Product, Sale, TradeIn } from '../../types';
import type { RecordVersion, SectionChanges, ViewSection } from '../../services/section-views-api';
import { DeskProvider } from '../ui';
import { InventoryScreen } from './InventoryScreen';
import { SalesScreen } from './SalesScreen';
import { TradeInsScreen } from './TradeInsScreen';
import { ClientsScreen } from './ClientsScreen';

const context = vi.hoisted(() => ({
  inventory: [] as Product[], sales: [] as Sale[], tradeIns: [] as TradeIn[], clients: [] as Client[],
  sectionChanges: {} as SectionChanges,
  viewSection: vi.fn(async (_section: ViewSection, _versions: RecordVersion[]) => undefined),
  operationDrafts: [], listsLoaded: true,
}));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => context }));
const views = { inventory: InventoryScreen, sales: SalesScreen, tradeins: TradeInsScreen, clients: ClientsScreen };
const originalMedia = window.matchMedia;
const versions = ['1', '2'].map(id => ({ id, updatedAt: '2026-10-22T12:00:00.000Z' }));
const day = '2026-10-22';

beforeEach(() => {
  // Keep records in the local period even after UTC has rolled over to tomorrow.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${day}T21:30:00-03:00`));
  vi.clearAllMocks();
  const numbers = Array.from({ length: 12 }, (_, i) => 12 - i);
  context.inventory = numbers.map(n => ({ id: String(n), model: `Equipo ${n}`, capacity: '128GB', color: 'Negro', condition: 'USADO', grade: 'A', imei: String(n).padStart(15, '0'), batteryHealth: '90%', price: n * 100, cost: 10, status: n === 2 ? 'ARCHIVADO' : 'DISPONIBLE', ...(n === 2 ? { archivedAt: day } : {}) }));
  context.sales = numbers.map(n => ({ id: String(n), saleNumber: n, date: day, clientId: '', productId: '', deviceLabel: `Equipo ${n}`, clientName: `Persona ${n}`, amount: n * 100, paymentMethod: 'EFECTIVO', status: n === 2 ? 'CANCELADA' : 'COMPLETADA' }));
  context.tradeIns = numbers.map(n => ({ id: String(n), tradeNumber: n, date: n <= 2 ? day.slice(0, 8) + '01' : day, clientId: '', clientName: `Persona ${n}`, deviceReceived: `Equipo ${n}`, deviceReceivedImei: '', deviceGiven: 'Otro', takeValue: n * 100, differencePaid: 0, status: n === 2 ? 'CANCELADO' : 'LISTO', confirmationStatus: n === 2 ? 'CANCELLED' : 'CONFIRMED' }));
  context.clients = numbers.map(n => ({ id: String(n), name: `Persona ${n}`, dni: String(n), phone: '', email: '', totalSpent: n * 100, pendingBalance: n * 100, lastPurchaseDate: day, ...(n === 2 ? { archivedAt: day } : {}) }));
});
afterEach(() => { vi.useRealTimers(); window.matchMedia = originalMedia; context.sectionChanges = {}; });

describe.each([390, 1440])('section novelty rows at %spx', width => {
  it.each(['inventory', 'sales', 'tradeins', 'clients'] as ViewSection[])('prioritizes %s before pagination, keeps cancelled marks, and acknowledges the section without reason text', async section => {
    window.matchMedia = vi.fn().mockImplementation(query => ({ matches: width === 390 && query.includes('760'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    context.sectionChanges = { [section]: versions };
    const Screen = views[section];
    const renderScreen = () => <DeskProvider value={{ tab: section, go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}><Screen /></DeskProvider>;
    const view = render(renderScreen());
    await waitFor(() => expect(context.viewSection).toHaveBeenCalledWith(section, versions));
    const records = () => width === 1440
      ? within(screen.getByRole('table')).getAllByRole('row').slice(1)
      : Array.from(document.querySelectorAll<HTMLElement>('.phone-row'));
    expect(records()).toHaveLength(8);
    const voidsLast = section === 'inventory' || section === 'sales';
    const visibleNotices = voidsLast ? 1 : 2;
    expect(records()[0]).toHaveClass('novedad');
    if (voidsLast) expect(records()[1]).not.toHaveClass('novedad');
    else expect(records()[1]).toHaveClass('novedad');
    expect(records()[2]).not.toHaveClass('novedad');
    expect(screen.getAllByTestId('notice-dot')).toHaveLength(visibleNotices);
    expect(screen.queryByTestId('notice-reason')).not.toBeInTheDocument();
    expect(screen.queryByTestId('section-notices')).not.toBeInTheDocument();
    if (voidsLast) expect(document.querySelector('.is-void.novedad')).not.toBeInTheDocument();
    else expect(document.querySelector('.is-void.novedad')).toBeInTheDocument();
    if (section === 'sales') {
      fireEvent.click(screen.getByRole('button', { name: 'Página 2' }));
      expect(records().at(-1)).toHaveClass('is-void', 'novedad');
      fireEvent.click(screen.getByRole('button', { name: 'Página 1' }));
    }
    // Acknowledgment clears backend pending versions while the current visit remains marked.
    context.sectionChanges = { [section]: [] };
    await act(async () => { view.rerender(renderScreen()); });
    expect(screen.getAllByTestId('notice-dot')).toHaveLength(visibleNotices);
    expect(records()[0]).toHaveClass('novedad');
    context.sectionChanges = { [section]: [{ id: '1', updatedAt: '2026-10-23T12:00:00.000Z' }, { id: '3', updatedAt: '2026-10-23T12:00:00.000Z' }] };
    await act(async () => { view.rerender(renderScreen()); });
    expect(context.viewSection).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('notice-dot')).toHaveLength(visibleNotices);
    expect(context.sectionChanges[section]).toHaveLength(2);
    view.unmount();
    render(renderScreen());
    await waitFor(() => expect(context.viewSection).toHaveBeenCalledTimes(2));
    expect(context.viewSection).toHaveBeenLastCalledWith(section, context.sectionChanges[section]);
    expect(records()[0]).toHaveClass('novedad');
  });
});
