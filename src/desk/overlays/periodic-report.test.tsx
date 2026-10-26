import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeskProvider } from '../ui';
import { PeriodicReportForm } from './periodic-report';
it('legacy entrypoint routes to the mail settings tab', async () => {
  const close = vi.fn();
  render(<DeskProvider value={{ tab: 'settings', go: vi.fn(), open: vi.fn(), openRecord: vi.fn(), close, toast: vi.fn(), isStaff: false }}><PeriodicReportForm run={vi.fn()} busy={false} error={null} /></DeskProvider>);
  await waitFor(() => expect(window.location.hash).toBe('#/analisis/resumen-periodico?view=mail'));
  expect(close).toHaveBeenCalled();
  window.location.hash = '';
});
