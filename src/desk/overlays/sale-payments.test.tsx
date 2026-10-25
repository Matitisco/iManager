import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SalePaymentsFields } from './sale-payments';

function mount(currency: 'ARS' | 'USD', due: number) {
  const onChange = vi.fn();
  render(<SalePaymentsFields clientId="qa-ventas" due={due} currency={currency} suggestedRate={1565} onChange={onChange} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Combinar pagos' }));
  return onChange;
}

describe('sale payment excess preview', () => {
  it('offers excess options for USD payments exceeding an ARS sale after conversion', () => {
    const onChange = mount('ARS', 100000);
    fireEvent.click(screen.getByRole('button', { name: 'USD' }));
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '100' } });
    expect(screen.getByRole('button', { name: 'Vuelto' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vuelto' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ error: null, payload: expect.objectContaining({ excess: 'CHANGE', changeMethod: 'EFECTIVO' }) }));
  });

  it('does not offer excess for an ARS payment below a USD sale after conversion', () => {
    mount('USD', 100);
    fireEvent.click(screen.getByRole('button', { name: 'ARS' }));
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '100000' } });
    expect(screen.queryByRole('button', { name: 'Vuelto' })).not.toBeInTheDocument();
  });

  it('sums mixed currencies and removes the preview when the rate is invalid', () => {
    mount('ARS', 100000);
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'USD' })[1]);
    fireEvent.change(screen.getByLabelText('Importe del pago 2'), { target: { value: '40' } });
    expect(screen.getByRole('button', { name: 'Vuelto' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cotización'), { target: { value: '0' } });
    expect(screen.queryByRole('button', { name: 'Vuelto' })).not.toBeInTheDocument();
    expect(screen.getByText('Revisá la cotización antes de confirmar')).toBeInTheDocument();
  });

  it('matches the settlement tolerance at the conversion boundary', () => {
    mount('USD', 100);
    fireEvent.click(screen.getByRole('button', { name: 'ARS' }));
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '156501' } });
    expect(screen.queryByRole('button', { name: 'Vuelto' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '156515' } });
    expect(screen.getByRole('button', { name: 'Vuelto' })).toBeInTheDocument();
  });
});

describe('removing additional sale and trade-in payments', () => {
  it('removes a middle payment, preserves the next control and values, and renumbers labels', () => {
    const onChange = mount('USD', 800);
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    fireEvent.change(screen.getByLabelText('Importe del pago 2'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const thirdAmount = screen.getByLabelText('Importe del pago 3');
    const thirdId = thirdAmount.id;
    const thirdRow = thirdAmount.closest('.acct-tender') as HTMLElement;
    fireEvent.change(thirdAmount, { target: { value: '156500' } });
    fireEvent.click(within(thirdRow).getByRole('button', { name: 'ARS' }));
    fireEvent.click(within(thirdRow).getByRole('button', { name: 'Tarjeta' }));

    fireEvent.click(screen.getByRole('button', { name: 'Quitar pago 2' }));

    expect(screen.queryByLabelText('Importe del pago 3')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Importe del pago 2')).toBe(thirdAmount);
    expect(thirdAmount).toHaveValue('156.500');
    expect(thirdAmount).toHaveAttribute('id', thirdId);
    expect(within(thirdRow).getByText('Pago 2', { selector: 'label' })).toHaveAttribute('for', thirdId);
    expect(within(thirdRow).getByRole('button', { name: 'ARS' })).toHaveClass('on');
    expect(within(thirdRow).getByRole('button', { name: 'Tarjeta' })).toHaveClass('on');
    expect(within(thirdRow).getByRole('button', { name: 'Quitar pago 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitar pago 3' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Importe del pago 1')).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith({
      active: true, error: null,
      payload: { tenders: [
        { amount: 300, currency: 'USD', method: 'EFECTIVO' },
        { amount: 156500, currency: 'ARS', method: 'TARJETA', exchangeRate: 1565 },
      ], excess: 'OMIT', exchangeRate: 1565 },
    });
    // A subsequent edit must still target the surviving payment, not its old index.
    fireEvent.change(thirdAmount, { target: { value: '313000' } });
    expect(onChange.mock.lastCall?.[0].payload.tenders[1].amount).toBe(313000);
  });

  it('recalculates converted totals and removes excess options after removing a payment', () => {
    const onChange = mount('USD', 100);
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'ARS' })[1]);
    fireEvent.change(screen.getByLabelText('Importe del pago 2'), { target: { value: '156500' } });
    expect(screen.getByRole('button', { name: 'Vuelto' })).toBeInTheDocument();
    const before = onChange.mock.lastCall?.[0].payload.tenders;
    expect(before.reduce((sum: number, tender: { amount: number; currency: string }) => sum + (tender.currency === 'USD' ? tender.amount : tender.amount / 1565), 0)).toBe(150);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar pago 2' }));

    expect(screen.queryByRole('button', { name: 'Vuelto' })).not.toBeInTheDocument();
    expect(screen.queryByText(/El pago supera el saldo/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cotización')).not.toBeInTheDocument();
    expect(onChange.mock.lastCall?.[0].payload.tenders).toEqual([{ amount: 50, currency: 'USD', method: 'EFECTIVO' }]);
  });

  it('recalculates the remaining balance available to finance', () => {
    const onChange = mount('USD', 100);
    fireEvent.change(screen.getByLabelText('Importe del pago 1'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    fireEvent.change(screen.getByLabelText('Importe del pago 2'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Financiar en cuotas' }));
    fireEvent.change(screen.getByLabelText('Primer vencimiento'), { target: { value: '2026-11-24' } });
    expect(screen.getByRole('alert')).toHaveTextContent('No queda saldo para financiar');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar pago 2' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ error: null, payload: expect.objectContaining({
      tenders: [{ amount: 50, currency: 'USD', method: 'EFECTIVO' }],
      installments: expect.objectContaining({ count: 3, firstDueDate: '2026-11-24' }),
    }) }));
  });

  it('preserves the first payment after removing every additional row', () => {
    mount('ARS', 1000);
    const firstAmount = screen.getByLabelText('Importe del pago 1');
    fireEvent.change(firstAmount, { target: { value: '500' } });
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar pago' }));
    expect(screen.queryByRole('button', { name: 'Agregar pago' })).not.toBeInTheDocument();
    for (const number of [4, 3, 2]) fireEvent.click(screen.getByRole('button', { name: `Quitar pago ${number}` }));

    expect(screen.queryByRole('button', { name: /Quitar pago/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Importe del pago 1')).toBe(firstAmount);
    expect(firstAmount).toHaveValue('500');
    expect(firstAmount).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Agregar pago' })).toBeInTheDocument();
  });

  it('supports keyboard removal at the limit and never reuses a removed payment id', async () => {
    const user = userEvent.setup();
    mount('USD', 800);
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Agregar pago' }));
    const fourthId = screen.getByLabelText('Importe del pago 4').id;
    screen.getByRole('button', { name: 'Quitar pago 4' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Importe del pago 3')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Agregar pago' }));
    expect(screen.getByLabelText('Importe del pago 4').id).not.toBe(fourthId);
    screen.getByRole('button', { name: 'Quitar pago 4' }).focus();
    await user.keyboard(' ');
    expect(screen.getByLabelText('Importe del pago 3')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Agregar pago' })).toBeInTheDocument();
  });
});

it.each([1440, 390])('opens installment dates inside the mobile flow at %ipx', (width) => {
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: width <= 760, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  try {
    render(<SalePaymentsFields clientId="client" due={800} currency="ARS" suggestedRate={1565} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Financiar en cuotas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir calendario: primer vencimiento' }));
    const calendar = screen.getByRole('dialog', { name: 'Elegir primer vencimiento' });
    expect(calendar.closest('.dp-calendar')?.classList.contains('dp-inline')).toBe(width <= 760);
    expect(screen.getByLabelText('Cantidad de cuotas')).toHaveValue('3');
  } finally { media.mockRestore(); }
});
