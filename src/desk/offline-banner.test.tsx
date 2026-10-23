import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { pingHealth } from '../lib/connection';
import { NETWORK_ERROR_MESSAGE } from '../lib/user-message';
import { OfflineScope, suppressLocalNetworkBanner } from './offline-banner';

vi.mock('../lib/connection', () => ({ pingHealth: vi.fn(async () => true) }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

it.each([false, true])('renders only its children while offline (forced: %s)', forced => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const { container } = render(<OfflineScope forced={forced}><main>Dashboard</main></OfflineScope>);
  expect(container.innerHTML).toBe('<main>Dashboard</main>');
  act(() => { window.dispatchEvent(new Event('offline')); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  expect(screen.queryByText(NETWORK_ERROR_MESSAGE)).not.toBeInTheDocument();
});

it('keeps health probing and online recovery without rendering a notice, and cleans up', async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<OfflineScope>{null}</OfflineScope>);
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(pingHealth).toHaveBeenCalledTimes(1);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(pingHealth).toHaveBeenCalledTimes(2);
  expect(container).toBeEmptyDOMElement();
  unmount();
  await vi.advanceTimersByTimeAsync(4000);
  window.dispatchEvent(new Event('online'));
  expect(pingHealth).toHaveBeenCalledTimes(2);
});

it('suppresses local connection messages without scope ownership', () => {
  expect(suppressLocalNetworkBanner(NETWORK_ERROR_MESSAGE)).toBe(true);
  expect(suppressLocalNetworkBanner('Sin conexión')).toBe(true);
  expect(suppressLocalNetworkBanner('IMEI duplicado')).toBe(false);
});
