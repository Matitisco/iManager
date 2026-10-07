import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { EquipmentField } from './EquipmentField';

function product(id: string, model: string): Product {
  return {
    id,
    imei: '',
    model,
    capacity: '128GB',
    color: 'Negro',
    condition: 'USADO',
    grade: 'A',
    batteryHealth: '90%',
    cost: 100,
    price: 500,
    status: 'DISPONIBLE',
  };
}

const items = [
  product('a', 'iPhone 13'),
  product('b', 'Samsung A54'),
  ...Array.from({ length: 20 }, (_, index) => product(`x${index}`, `iPhone extra ${index}`)),
];

function Harness({ onPick }: { onPick: (item: Product) => void }) {
  const [value, setValue] = useState('');
  const [linked, setLinked] = useState(false);
  return (
    <EquipmentField
      items={items}
      value={value}
      linked={linked}
      onValue={(next) => { setValue(next); setLinked(false); }}
      onPick={(item) => { setValue(`${item.model} · ${item.capacity}`); setLinked(true); onPick(item); }}
    />
  );
}

describe('EquipmentField', () => {
  it('suggests a short matching list and lets you pick one or keep free text', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Equipo' }), 'iph');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options.map((option) => option.textContent).join(' ')).toContain('iPhone 13');
    expect(screen.queryByRole('option', { name: /Samsung/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Se guarda como texto/)).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /iPhone 13/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', model: 'iPhone 13' }));
  });
});
