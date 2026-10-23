import { apiRequest } from '../../services/api-client';
import { setTacReportUser } from '../../lib/report-unknown-tac';
import type { AuthUserLike } from '../../types/auth-user';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, TradeIn } from '../../types';
import { parseDeviceCode } from '../../lib/device-scan';
import { IMEI_LUHN_MESSAGE } from '../../lib/imei';
import { testImei } from '../../test/imei-fixture';
import { createBackendInventoryBatch } from '../../services/inventory-api';
import { DeskProvider } from '../ui';
import { draftFromImei } from '../scan/draft';
import { EquipmentForm } from './equipment';
import { TradeForm } from './trade';
import { SaleForm } from './operation';
import { BatchLoad } from './batch-load';
import { ScanReviewSheet } from './scan-review';

const ctx = vi.hoisted(() => ({
  user: { uid: 'test-owner' }, appSession: { store: { id: 'test-store' }, membership: { role: 'OWNER' } },
  inventory: [] as Product[], suppliers: [], sales: [], clients: [], tradeIns: [] as TradeIn[],
  operationDrafts: [], operationOptions: {}, commissionSellers: [],
  addProduct: vi.fn(), updateProduct: vi.fn(), updateTradeIn: vi.fn(), reloadInventory: vi.fn(),
  loadOperationOptions: vi.fn(async () => undefined), fetchTradeOperation: vi.fn(async () => ({})),
}));
const camera = vi.hoisted(() => ({ raw: '353893101224013' }));
vi.mock('../../services/api-client', () => ({ apiRequest: vi.fn(async () => undefined) }));
vi.mock('../../context/AppContext', () => ({ useAppContext: () => ctx }));
vi.mock('../../services/inventory-api', () => ({
  fetchArchivedInventory: vi.fn(async () => []), createBackendInventoryBatch: vi.fn(async () => ({ created: [], errors: [] })),
}));
vi.mock('../scan/beep', () => ({ confirmScan: vi.fn() }));
vi.mock('../scan/use-camera', () => ({ useCameraAvailable: () => true }));
vi.mock('../scan/CameraScanner', () => ({
  CameraScanner: ({ onUse }: { onUse: (parsed: ReturnType<typeof parseDeviceCode>) => void }) => <button onClick={() => onUse(parseDeviceCode(camera.raw))}>Usar lectura de prueba</button>,
}));
const props = { run: vi.fn(), busy: false, error: null };
const known = '353893101224013';
const other = testImei('35011042');
const unknown = testImei('00000000');
const change = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
function mount(child: ReactNode) {
  return render(<div className="desk-app"><DeskProvider value={{ tab: 'inventory', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close: vi.fn(), toast: vi.fn(), isStaff: false }}>{child}</DeskProvider></div>);
}
function wedge(input: HTMLElement, raw = known) {
  input.focus();
  for (const key of raw) fireEvent.keyDown(input, { key });
  fireEvent.keyDown(input, { key: 'Enter' });
}
beforeEach(() => {
  vi.mocked(apiRequest).mockClear();
  setTacReportUser(ctx.user as unknown as AuthUserLike);
  ctx.inventory = [];
  ctx.tradeIns = [];
  camera.raw = known;
});

describe('equipment model from TAC', () => {
  it('fills while typing, keeps focus and leaves unit details blank', async () => {
    mount(<EquipmentForm {...props} />);
    const imei = screen.getByLabelText('IMEI (opcional)');
    await userEvent.type(imei, known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 11 Pro Max');
    expect(imei).toHaveFocus();
    for (const label of ['Color', 'Batería %', 'Costo', 'Precio de venta']) expect(screen.getByLabelText(label)).toHaveValue('');
    expect(document.querySelectorAll('.sg.on')).toHaveLength(1); // Only existing inventory status.
    change(imei, other);
    expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 12');
  });
  it('pastes a Samsung IMEI with only model filled and preserves manual edits', async () => {
    mount(<EquipmentForm {...props} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('IMEI (opcional)'));
    await user.paste(testImei('35001772'));
    expect(screen.getByLabelText('Modelo')).toHaveValue('Samsung Galaxy S24 Ultra');
    for (const label of ['Color', 'Batería %', 'Costo', 'Precio de venta']) expect(screen.getByLabelText(label)).toHaveValue('');
    expect(document.querySelectorAll('.sg.on')).toHaveLength(1);
    change(screen.getByLabelText('Modelo'), 'Modelo elegido');
    change(screen.getByLabelText('IMEI (opcional)'), known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('Modelo elegido');
    expect(apiRequest).not.toHaveBeenCalled();
  });
  it('reports only an unknown TAC once even after a manual model edit', () => {
    mount(<EquipmentForm {...props} />);
    change(screen.getByLabelText('Modelo'), 'Modelo elegido');
    const imei = screen.getByLabelText('IMEI (opcional)');
    change(imei, testImei('00000021'));
    change(imei, testImei('00000021', '654321'));
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith(ctx.user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac: '00000021' } }));
    expect(screen.getByLabelText('Modelo')).toHaveValue('Modelo elegido');
    expect(document.querySelector('.ferr, .err')).toBeNull();
  });
  it('fills a pasted IMEI and preserves capacity and color choices', async () => {
    mount(<EquipmentForm {...props} />);
    const user = userEvent.setup();
    change(screen.getByLabelText('Color'), 'Azul elegido');
    await user.click(screen.getByRole('button', { name: '256GB' }));
    await user.click(screen.getByLabelText('IMEI (opcional)'));
    await user.paste(known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 11 Pro Max');
    expect(screen.getByLabelText('Color')).toHaveValue('Azul elegido');
    expect(screen.getByRole('button', { name: '256GB' })).toHaveClass('on');
  });
  it.each(['Modelo propio', ''])('respects a manually edited or cleared model (%s)', model => {
    mount(<EquipmentForm {...props} />);
    change(screen.getByLabelText('IMEI (opcional)'), known);
    change(screen.getByLabelText('Modelo'), model);
    change(screen.getByLabelText('IMEI (opcional)'), other);
    expect(screen.getByLabelText('Modelo')).toHaveValue(model);
  });
  it('does not overwrite a pretyped model', () => {
    mount(<EquipmentForm {...props} />);
    change(screen.getByLabelText('Modelo'), 'Modelo propio');
    change(screen.getByLabelText('IMEI (opcional)'), known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('Modelo propio');
  });
  it('ignores unknown TAC silently and retains the existing Luhn feedback on Enter', () => {
    mount(<EquipmentForm {...props} />);
    const imei = screen.getByLabelText('IMEI (opcional)');
    change(imei, unknown);
    expect(screen.getByLabelText('Modelo')).toHaveValue('');
    expect(document.querySelector('.ferr, .err')).toBeNull();
    change(imei, '353893101224014');
    expect(screen.getByLabelText('Modelo')).toHaveValue('');
    fireEvent.keyDown(imei, { key: 'Enter' });
    expect(screen.getByText(IMEI_LUHN_MESSAGE)).toBeInTheDocument();
  });
  it('keeps the existing next-control focus behavior after a wedge scan', async () => {
    mount(<EquipmentForm {...props} />);
    const rect = new DOMRect(0, 0, 100, 48);
    const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([rect] as unknown as DOMRectList);
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    try {
      wedge(screen.getByLabelText('IMEI (opcional)'));
      expect(screen.getByLabelText('IMEI (opcional)')).toHaveValue(known);
      expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 11 Pro Max');
      await waitFor(() => expect(screen.getByLabelText('Proveedor')).toHaveFocus());
      expect(scroll).toHaveBeenCalled();
    } finally { rects.mockRestore(); }
  });
  it('fills the simple camera result in the existing form', async () => {
    mount(<EquipmentForm {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Escanear con la cámara' }));
    await userEvent.click(screen.getByRole('button', { name: 'Usar lectura de prueba' }));
    expect(screen.getByRole('dialog', { name: 'Registrar equipo' })).toBeInTheDocument();
    expect(screen.getByLabelText('IMEI (opcional)')).toHaveValue(known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('iPhone 11 Pro Max');
  });
  it('keeps box scans on review with label model, capacity and color', () => {
    mount(<EquipmentForm {...props} />);
    wedge(screen.getByLabelText('IMEI (opcional)'), `MLPF3LE/A ${known}`);
    expect(screen.getByTestId('scan-review')).toHaveTextContent('iPhone 13 · 128GB');
    expect(screen.getByTestId('scan-review')).toHaveTextContent('Medianoche');
  });
  it('never fills in edit equipment, even if its original model is empty', () => {
    ctx.inventory = [{ id: 'old', model: '', imei: '', capacity: '', color: '', condition: '', grade: '', batteryHealth: '', price: 100, status: 'DISPONIBLE' }];
    mount(<EquipmentForm id="old" {...props} />);
    change(screen.getByLabelText('IMEI (opcional)'), known);
    expect(screen.getByLabelText('Modelo')).toHaveValue('');
  });
});

describe.each(['new-trade', 'legacy-trade', 'sale-trade'] as const)('received model: %s', mode => {
  function setup() {
    if (mode === 'legacy-trade') ctx.tradeIns = [{ id: 'old-trade', clientId: '', deviceReceivedImei: '', deviceReceived: '', deviceGiven: 'iPhone 14', date: '23/10/2026', takeValue: 0, differencePaid: 0, status: 'PENDIENTE' }];
    mount(mode === 'sale-trade' ? <SaleForm {...props} /> : <TradeForm id={mode === 'legacy-trade' ? 'old-trade' : undefined} {...props} />);
    if (mode === 'sale-trade') fireEvent.click(screen.getByLabelText('Tiene canje'));
    return { model: screen.getByLabelText(mode === 'legacy-trade' ? 'Equipo que recibís' : 'Equipo recibido'), imei: screen.getByLabelText('IMEI (opcional)') };
  }
  it('fills Samsung and reports only unknown TAC once', () => {
    const { model, imei } = setup();
    change(imei, testImei('35001772'));
    expect(model).toHaveValue('Samsung Galaxy S24 Ultra');
    expect(apiRequest).not.toHaveBeenCalled();
    const tac = { 'new-trade': '00000022', 'legacy-trade': '00000023', 'sale-trade': '00000024' }[mode];
    change(imei, testImei(tac));
    change(imei, testImei(tac, '654321'));
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith(ctx.user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac } }));
    expect(model).toHaveValue('Samsung Galaxy S24 Ultra');
  });
  it('fills an entered IMEI and preserves manual corrections', () => {
    const { model, imei } = setup();
    change(imei, known);
    expect(model).toHaveValue('iPhone 11 Pro Max');
    change(imei, other);
    expect(model).toHaveValue('iPhone 12');
    change(model, 'Recibido elegido');
    change(imei, known);
    expect(model).toHaveValue('Recibido elegido');
    change(model, '');
    change(imei, other);
    expect(model).toHaveValue('');
  });
  it('ignores unknown or invalid IMEI and does not overwrite an entered model', () => {
    const { model, imei } = setup();
    change(imei, unknown);
    expect(model).toHaveValue('');
    change(imei, '353893101224014');
    expect(model).toHaveValue('');
    change(model, 'Recibido elegido');
    wedge(imei);
    expect(model).toHaveValue('Recibido elegido');
  });
  it('fills wedge and camera scans and gives label data priority', async () => {
    const { model, imei } = setup();
    wedge(imei);
    expect(model).toHaveValue('iPhone 11 Pro Max');
    camera.raw = `MLPF3LE/A ${known}`;
    // Sale also has a camera for outgoing stock; the last is the received device.
    const buttons = screen.getAllByRole('button', { name: 'Escanear con la cámara' });
    await userEvent.click(buttons.at(-1)!);
    await userEvent.click(screen.getByRole('button', { name: 'Usar lectura de prueba' }));
    expect(model).toHaveValue('iPhone 13 128GB');
  });
});

describe('batch shared model', () => {
  it('fills Samsung and reports an unknown TAC once across repeat scans', async () => {
    mount(<BatchLoad />);
    wedge(screen.getByLabelText('IMEI'), testImei('35001772'));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Modelo de la serie')).toHaveValue('Samsung Galaxy S24 Ultra');
    expect(apiRequest).not.toHaveBeenCalled();
    wedge(screen.getByLabelText('IMEI'), testImei('00000025'));
    wedge(screen.getByLabelText('IMEI'), testImei('00000025', '654321'));
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith(ctx.user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac: '00000025' } }));
  });
  it('prefills the existing shared model and saves it without inventing capacity/color', async () => {
    mount(<BatchLoad />);
    wedge(screen.getByLabelText('IMEI'));
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Modelo de la serie')).toHaveValue('iPhone 11 Pro Max');
    expect(screen.getByLabelText('Color de la serie')).toHaveValue('');
    change(screen.getByLabelText('Precio de la serie'), '100');
    await userEvent.click(screen.getByRole('button', { name: 'Cargar 1 equipo' }));
    expect(createBackendInventoryBatch).toHaveBeenCalledWith(ctx.user, [expect.objectContaining({ imei: known, model: 'iPhone 11 Pro Max', capacity: '', color: '', batteryHealth: '', price: 100 })]);
  });
  it('keeps the shared model for subsequent rows and respects a manual clear', async () => {
    mount(<BatchLoad />);
    wedge(screen.getByLabelText('IMEI'));
    wedge(screen.getByLabelText('IMEI'), other);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Modelo de la serie')).toHaveValue('iPhone 11 Pro Max');
    change(screen.getByLabelText('Modelo de la serie'), '');
    wedge(screen.getByLabelText('IMEI'), testImei('35389310', '654321'));
    expect(screen.getByLabelText('Modelo de la serie')).toHaveValue('');
  });
  it('does not fill the shared model for unknown or invalid TAC', async () => {
    mount(<BatchLoad />);
    const input = screen.getByLabelText('IMEI');
    wedge(input, unknown);
    change(input, '353893101224014');
    fireEvent.keyDown(input, { key: 'Enter' });
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Modelo de la serie')).toHaveValue('');
  });
});

describe('review sheet TAC detection', () => {
  it('fills Samsung from camera parsing and reports edited unknown TAC once', async () => {
    const parsed = parseDeviceCode(testImei('35001772'));
    expect(parsed).toMatchObject({ model: 'Samsung Galaxy S24 Ultra', capacity: null, color: null });
    mount(<ScanReviewSheet initial={draftFromImei(parsed.imei!)} frequent={[]} onClose={vi.fn()} onRescan={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText('Samsung Galaxy S24 Ultra', { selector: 'b' })).toBeInTheDocument();
    expect(apiRequest).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    change(screen.getByLabelText('IMEI'), testImei('00000026'));
    change(screen.getByLabelText('IMEI'), testImei('00000026', '654321'));
    expect(apiRequest).toHaveBeenCalledOnce();
    expect(apiRequest).toHaveBeenCalledWith(ctx.user, '/api/imei-tac-misses', expect.objectContaining({ body: { tac: '00000026' } }));
    expect(screen.getByLabelText('Buscar modelo')).toHaveValue('Samsung Galaxy S24 Ultra');
  });
  it('shows the detected model and allows capacity/color and IMEI edits', async () => {
    mount(<ScanReviewSheet initial={draftFromImei(known)} frequent={[]} onClose={vi.fn()} onRescan={vi.fn()} onSave={vi.fn()} />);
    const detected = screen.getByText('Detectado del código').closest('section')!;
    expect(within(detected).getByText('iPhone 11 Pro Max', { selector: 'b' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '256GB' })).toBeInTheDocument();
    expect(screen.getByLabelText('Color')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    change(screen.getByLabelText('IMEI'), other);
    expect(screen.getByLabelText('Buscar modelo')).toHaveValue('iPhone 12');
    change(screen.getByLabelText('Buscar modelo'), 'Modelo propio');
    change(screen.getByLabelText('IMEI'), known);
    expect(screen.getByLabelText('Buscar modelo')).toHaveValue('Modelo propio');
    expect(within(detected).getByText('editado', { selector: 'em' })).toBeInTheDocument();
  });
  it('keeps the existing Luhn message when saving an invalid edited IMEI', async () => {
    const save = vi.fn();
    mount(<ScanReviewSheet initial={draftFromImei(known)} frequent={[]} onClose={vi.fn()} onRescan={vi.fn()} onSave={save} />);
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }));
    change(screen.getByLabelText('IMEI'), '353893101224014');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    expect(screen.getByText(IMEI_LUHN_MESSAGE)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
