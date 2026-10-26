import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import posthog from 'posthog-js';
import { ImportPreviewList } from '../components/ImportPreviewList';
import { ClientField } from '../desk/ClientField';
import { SaleDetailMoney } from '../desk/sale-detail-money';
import { DeskSelect } from '../desk/select';
import { Sheet } from '../desk/ui';
import { maskReplayHistoryValue } from '../desk/replay-privacy';

vi.mock('posthog-js', () => ({ default: { init: vi.fn() } }));

// Exercise the selector actually passed to the SDK against rendered product DOM.
let selector: string | undefined;
async function replaySelector() {
  if (selector) return selector;
  vi.stubEnv('DEV', false); vi.stubEnv('MODE', 'production'); vi.stubEnv('VITEST', '');
  vi.stubEnv('VITE_TEST_AUTH_MODE', ''); vi.stubEnv('VITE_E2E', '');
  vi.stubEnv('VITE_POSTHOG_DISABLED', ''); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  (await import('./posthog-analytics')).initAnalytics();
  selector = vi.mocked(posthog.init).mock.calls[0][1]!.session_recording!.maskTextSelector!;
  return selector;
}

afterEach(() => vi.unstubAllEnvs());

function isMasked(text: string, selector: string) {
  return Boolean(screen.getByText(text, { exact: true }).closest(selector));
}

describe('selective replay boundaries', () => {
  it('keeps importer headings readable while masking every data cell in desktop and mobile previews', async () => {
    const selector = await replaySelector();
    const columns = [{ key: 'name', label: 'Nombre' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Email' }, { key: 'dni', label: 'DNI' }];
    const props = { rows: [{ name: 'Ana privada', phone: '1122334455', email: 'ana@private.test', dni: '30123456' }], columns, currency: 'ARS', nouns: { one: 'cliente', many: 'clientes' } };
    const { rerender } = render(<ImportPreviewList {...props} layout="table" />);
    for (const label of ['Clientes a importar', 'Nombre', 'Teléfono', 'Email', 'DNI', '1 cliente']) expect(isMasked(label, selector)).toBe(false);
    for (const value of Object.values(props.rows[0])) expect(isMasked(value, selector)).toBe(true);
    rerender(<ImportPreviewList {...props} layout="cards" />);
    expect(isMasked('Ana privada', selector)).toBe(true);
    expect(screen.getByText(/1122334455/).closest(selector)).not.toBeNull();
    expect(isMasked('Clientes a importar', selector)).toBe(false);
  });

  it('masks equipment preview values and scan identifiers without hiding its edit action', async () => {
    const selector = await replaySelector();
    render(<ImportPreviewList rows={[{ model: 'Equipo privado', price: '1234', imei: '123456789012345', serial: 'PRIVATE-SERIAL' }]}
      columns={[{ key: 'model', label: 'Modelo' }, { key: 'price', label: 'Precio' }]} currency="USD" layout="table" nouns={{ one: 'equipo', many: 'equipos' }} onEdit={vi.fn()} />);
    for (const text of ['Equipo privado', '1.234', ' · IMEI 123456789012345', ' · Serie PRIVATE-SERIAL']) {
      expect(screen.getByText(text.trim()).closest(selector)).not.toBeNull();
    }
    expect(isMasked('Precio', selector)).toBe(false);
    expect(isMasked('Revisar / editar', selector)).toBe(false);
  });

  it('masks customer suggestions, detail title and monetary equivalents while leaving labels readable', async () => {
    const selector = await replaySelector();
    render(<Sheet title="Ana privada" maskTitle onClose={vi.fn()}>
      <ClientField clients={[{ id: 'c', name: 'Cliente privado', phone: '1122334455', dni: '30123456' }]} value="Cliente" linked={false} onValue={vi.fn()} onPick={vi.fn()} />
      <SaleDetailMoney amount={10} source="USD" display="USD" secondary="ARS" rate={1000} />
      <button type="button">Guardar</button>
    </Sheet>);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Cliente' }));
    for (const text of ['Ana privada', 'Cliente privado', 'US$ 10', '$ 10.000']) expect(isMasked(text, selector)).toBe(true);
    expect(screen.getByText(/1122334455/).closest(selector)).not.toBeNull();
    for (const text of ['Cliente', 'Guardar']) expect(isMasked(text, selector)).toBe(false);
  });

  it('masks select values in the trigger and opened portal while preserving the field name', async () => {
    const selector = await replaySelector();
    const { container } = render(<DeskSelect label="Equipo a reservar" maskValues value="p" options={[{ value: 'p', label: 'Equipo IMEI privado' }]} onChange={vi.fn()} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger.closest(selector)).toBeNull();
    expect(trigger.querySelector('span')!.matches(selector)).toBe(true);
    fireEvent.click(trigger);
    expect(screen.getByRole('option').querySelector('span')!.matches(selector)).toBe(true);
    expect(container.querySelector('option[value="p"]')!.matches(selector)).toBe(true);
  });

  it('masks sensitive history values without hiding status, dates or equipment descriptions', () => {
    for (const label of ['Precio de venta', 'Costo', 'Total', 'Saldo', 'IMEI', 'Serie', 'Cliente', 'Teléfono', 'Email', 'DNI', 'Presupuesto', 'Seña']) {
      expect(maskReplayHistoryValue(label, 'sale')).toBe(true);
    }
    expect(maskReplayHistoryValue('Nombre', 'client')).toBe(true);
    for (const label of ['Estado', 'Modelo', 'Color', 'Fecha', 'Garantía', 'Batería']) expect(maskReplayHistoryValue(label, 'client')).toBeUndefined();
    expect(maskReplayHistoryValue('Nombre', 'supplier')).toBeUndefined();
  });
});
