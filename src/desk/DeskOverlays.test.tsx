import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeskOverlays } from './DeskOverlays';
import { placeMenu } from './menu-position';
import { DeskProvider } from './ui';
import type { Overlay } from './types';
import type { Sale } from '../types';
import { rememberVoidedSales } from './archive-cache';

const ctx = vi.hoisted(() => ({ sales: [{ id: 'sale', status: 'COMPLETADA', voidedAt: null as string | null }], returns: [] }));
const layout = vi.hoisted(() => ({ phone: false }));
const flags = vi.hoisted(() => ({ IMPORT_SALES_ENABLED: false }));
vi.mock('../config/featureFlags', () => flags);
vi.mock('./overlays/import', () => ({ ImportHost: ({ kind }: { kind: string }) => <div data-testid={`import-${kind}`} /> }));
vi.mock('../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('./section-notices', async original => ({ ...await original<typeof import('./section-notices')>(), usePhoneLayout: () => layout.phone }));
const close = vi.fn(); const open = vi.fn();
const overlay: Extract<Overlay, { type: 'ctx' }> = { type: 'ctx', kind: 'sale', id: 'sale', label: 'V-0001', x: 464, y: 580 };
let measuredHeight: number;
let resized: () => void;
const disconnect = vi.fn();

function mount(point = overlay) {
  return render(<DeskProvider value={{ tab: 'sales', go: vi.fn(), open, openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false, canManageSensitive: true }}>
    <DeskOverlays overlay={point} />
  </DeskProvider>);
}
function menu() { return document.querySelector<HTMLDivElement>('.ctx')!; }
function expectPlacement(anchor = overlay, viewport = { width: 1440, height: 620 }) {
  const expected = placeMenu({ anchor, size: { width: 220, height: measuredHeight }, viewport });
  expect(menu()).toHaveStyle({ left: `${expected.left}px`, top: `${expected.top}px`, visibility: 'visible', transformOrigin: expected.transformOrigin });
}

beforeEach(() => {
  layout.phone = false; measuredHeight = 187; ctx.sales = [{ id: 'sale', status: 'COMPLETADA', voidedAt: null }];
  vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 620);
  vi.stubGlobal('visualViewport', undefined);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(220);
  for (const key of ['offsetHeight', 'scrollHeight', 'clientHeight'] as const) {
    vi.spyOn(HTMLElement.prototype, key, 'get').mockImplementation(() => measuredHeight);
  }
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe = vi.fn(); disconnect = disconnect;
  });
});
afterEach(() => { rememberVoidedSales([]); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('measured context menu placement', () => {
  it.each(['COMPLETADA', 'CANCELADA'])('places a %s sale menu using its real dimensions before showing it', status => {
    ctx.sales[0].status = status;
    measuredHeight = status === 'CANCELADA' ? 100 : 187;
    mount();
    expectPlacement();
    expect(screen.getAllByRole('button')).toHaveLength(status === 'CANCELADA' ? 1 : 3);
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument();
    if (status === 'CANCELADA') {
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Devolver' })).not.toBeInTheDocument();
    }
  });

  it('keeps a button menu above the entire button at the bottom edge', () => {
    const point = { ...overlay, x: 500, anchorTop: 548, anchorBottom: 580, anchorRight: 532 };
    mount(point); expectPlacement(point);
    expect(parseFloat(menu().style.top) + measuredHeight).toBe(545);
  });

  it('uses the short menu for a sale annulled through voidedAt, as in the sales table', () => {
    ctx.sales[0].voidedAt = '2026-10-23T04:03:52.250Z'; measuredHeight = 100;
    mount(); expectPlacement();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument();
  });

  it('also resolves annulled sales from the existing archive cache', () => {
    rememberVoidedSales([{ ...ctx.sales[0], voidedAt: '2026-10-23T04:03:52.250Z' } as Sale]);
    ctx.sales = []; measuredHeight = 100;
    mount(); expectPlacement();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Anular' })).toBeInTheDocument();
  });

  it('repositions on content and window resize, and disconnects on close', () => {
    const view = mount();
    measuredHeight = 100; act(() => resized()); expectPlacement();
    vi.stubGlobal('innerHeight', 900); fireEvent.resize(window);
    expectPlacement(overlay, { width: 1440, height: 900 });
    view.unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });

  it('tracks the visual viewport including pan and resize', () => {
    const viewport = Object.assign(new EventTarget(), { width: 400, height: 300, offsetLeft: 300, offsetTop: 150 });
    vi.stubGlobal('visualViewport', viewport);
    mount(); expectPlacement(overlay, viewport);
    viewport.offsetTop = 300;
    act(() => { viewport.dispatchEvent(new Event('scroll')); }); expectPlacement(overlay, viewport);
    viewport.height = 500;
    act(() => { viewport.dispatchEvent(new Event('resize')); }); expectPlacement(overlay, viewport);
  });

  it('constrains oversized desktop menus to the viewport', () => {
    vi.stubGlobal('innerHeight', 150); mount();
    expect(menu()).toHaveStyle({ top: '12px' });
    expect(menu().style.getPropertyValue('--ctx-max-height')).toBe('126px');
  });

  it('preserves edit, return, cancellation, Escape and outside-click actions', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' })); expect(open).toHaveBeenLastCalledWith({ type: 'edit-sale', id: 'sale' });
    fireEvent.click(screen.getByRole('button', { name: 'Devolver' })); expect(open).toHaveBeenLastCalledWith({ type: 'new-return', saleId: 'sale' });
    fireEvent.click(screen.getByRole('button', { name: 'Anular' })); expect(open).toHaveBeenLastCalledWith({ type: 'del', kind: 'sale', id: 'sale', label: 'V-0001' });
    fireEvent.mouseDown(menu()); expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' }); expect(close).toHaveBeenCalledOnce();
    fireEvent.mouseDown(menu().parentElement!); expect(close).toHaveBeenCalledTimes(2);
  });

  it('leaves mobile placement to the bottom sheet and keeps selection available', () => {
    layout.phone = true; const onSelect = vi.fn(); mount({ ...overlay, onSelect });
    expect(menu()).not.toHaveAttribute('style');
    expect(menu().querySelector('.sheet-grab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar varios' }));
    expect(onSelect).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
});

describe('sales import feature flag', () => {
  afterEach(() => { flags.IMPORT_SALES_ENABLED = false; });

  it.each([false, true])('blocks direct sales import overlays (phone=%s)', phone => {
    layout.phone = phone;
    const view = render(<DeskOverlays overlay={{ type: 'import', kind: 'sale' }} />);
    expect(screen.queryByTestId('import-sale')).not.toBeInTheDocument();
    flags.IMPORT_SALES_ENABLED = true;
    view.rerender(<DeskOverlays overlay={{ type: 'import', kind: 'sale' }} />);
    expect(screen.getByTestId('import-sale')).toBeInTheDocument();
  });

  it.each(['inv', 'cl'] as const)('keeps the %s import available', kind => {
    render(<DeskOverlays overlay={{ type: 'import', kind }} />);
    expect(screen.getByTestId(`import-${kind}`)).toBeInTheDocument();
  });
});
