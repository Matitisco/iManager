import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldSkeleton, Skeleton } from './Skeleton';
import { ListSkeleton } from '../desk/list-skeleton';

describe('shared loading placeholders', () => {
  it('keeps decorative shapes out of the accessibility tree', () => {
    const { container } = render(<Skeleton style={{ width: 80 }} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).toBe('');
  });

  it('marks a pending field busy without a visible value or an interactive control', () => {
    const { container } = render(<FieldSkeleton />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it.each(['rows', 'cards', 'lines'] as const)('announces %s loading without visible copy', variant => {
    const { container } = render(<ListSkeleton variant={variant} rows={3} />);
    expect(screen.getByRole('status', { name: 'Cargando' })).toHaveAttribute('aria-busy', 'true');
    expect(container.textContent).toBe('');
    expect(screen.getByRole('status').children).toHaveLength(3);
  });
});

it('keeps skeleton shapes static and hidden for the first 180 ms, including list containers', async () => {
  const css = readFileSync('src/components/skeleton.css', 'utf8');
  const deskCss = readFileSync('src/desk/desk.css', 'utf8');
  // jsdom does not advance CSS animations; verify the shared browser rule contract.
  expect(css).toMatch(/visibility: hidden; animation: skeleton-reveal 0s linear 180ms forwards/);
  expect(deskCss).toMatch(/\.list-skel \{[^}]*visibility: hidden; animation: skeleton-reveal 0s linear 180ms forwards/);
  expect(css).not.toMatch(/infinite|skeleton-pulse/);
  expect(deskCss).not.toMatch(/animation: list-skel.*infinite/);
});
