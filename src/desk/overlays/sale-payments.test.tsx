import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SalePaymentsFields } from './sale-payments';

function mount(currency: 'ARS' | 'USD', due: number) {
  const onChange = vi.fn();
  render(<SalePaymentsFields clientId="qa-ventas" due={due} currency={currency} suggestedRate={1565} onChange={onChange} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Varios medios' }));
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
