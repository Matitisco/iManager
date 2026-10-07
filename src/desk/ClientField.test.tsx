import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Client } from '../types';
import { ClientField } from './ClientField';

function client(id: string, name: string): Client {
  return {
    id,
    dni: '',
    name,
    email: '',
    phone: '',
    lastPurchaseDate: '',
    totalSpent: 0,
    pendingBalance: 0,
  };
}

const clients = [
  client('a', 'Ana Gómez'),
  client('b', 'Bruno Díaz'),
  ...Array.from({ length: 20 }, (_, index) => client(`x${index}`, `Ana extra ${index}`)),
];

function Harness({ onPick }: { onPick: (client: Client) => void }) {
  const [value, setValue] = useState('');
  const [linked, setLinked] = useState(false);
  return (
    <ClientField
      clients={clients}
      value={value}
      linked={linked}
      onValue={(next) => { setValue(next); setLinked(false); }}
      onPick={(item) => { setValue(item.name); setLinked(true); onPick(item); }}
    />
  );
}

describe('ClientField', () => {
  it('suggests existing clients and lets you pick one or keep free text', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox', { name: 'Cliente' }), 'ana');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(6);
    expect(options.map((option) => option.textContent).join(' ')).toContain('Ana Gómez');
    expect(screen.queryByRole('option', { name: /Bruno/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Se guarda como texto/)).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: /Ana Gómez/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a', name: 'Ana Gómez' }));
    expect(screen.queryByText(/Se guarda como texto/)).not.toBeInTheDocument();
  });
});
