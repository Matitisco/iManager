import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';

function Crashes({ error }: { error: Error }): never { throw error; }
afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it.each([
    [new Error('An unexpected error occurred'), 'Ocurrió un error inesperado. Recargá la página y probá de nuevo.'],
    [new Error('{"error":"Revisá los datos de la tienda."}'), 'Revisá los datos de la tienda.'],
  ])('shows a safe Spanish message for %s', (error, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Crashes error={error} /></ErrorBoundary>);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recargar página' })).toBeVisible();
    expect(screen.queryByText(/Load failed|An unexpected error/)).not.toBeInTheDocument();
  });
});

 it.each([new TypeError('Load failed'), new Error(NETWORK_ERROR_MESSAGE)])('renders nothing for network failures: %s', error => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { container } = render(<ErrorBoundary><Crashes error={error} /></ErrorBoundary>);
  expect(container).toBeEmptyDOMElement();
});
