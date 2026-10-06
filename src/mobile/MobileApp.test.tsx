import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppContext } from '../context/AppContext';
import { MobileApp } from './MobileApp';
import { createPreviewContext } from './preview-fixture';

describe('MobileApp', () => {
  it('renders the phone dashboard with the bottom tabs', () => {
    render(
      <AppContext.Provider value={createPreviewContext()}>
        <MobileApp />
      </AppContext.Provider>,
    );

    expect(screen.getByRole('heading', { name: /qué hay para/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inventario' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getAllByText('Mi Tienda Ejemplo').length).toBeGreaterThan(0);
    expect(screen.getByText(/Canjes en curso/)).toBeInTheDocument();
  });
});
