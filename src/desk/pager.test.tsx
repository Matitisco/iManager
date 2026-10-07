import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TablePager, usePagedRows } from './pager';

function Harness({ rows, resetKey }: { rows: number[]; resetKey: string }) {
  const page = usePagedRows(rows, resetKey);
  return (
    <div>
      <div data-testid="visible">{page.visible.join(',')}</div>
      <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} />
    </div>
  );
}

describe('table pagination', () => {
  it('shows eight rows per page and reaches every item once, including the last partial page', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 17 }, (_, index) => index + 1);
    render(<Harness rows={rows} resetKey="todos" />);

    const seen = () => screen.getByTestId('visible').textContent!.split(',').map(Number);
    const visited = [...seen()];
    expect(seen()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(screen.getByText('1–8 de 17')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    visited.push(...seen());
    expect(seen()).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(screen.getByText('9–16 de 17')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    visited.push(...seen());
    expect(seen()).toEqual([17]);
    expect(screen.getByText('17–17 de 17')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    expect(visited).toEqual(rows);
    expect(new Set(visited).size).toBe(rows.length);
  });

  it('hides the pager when the list fits on one page', () => {
    render(<Harness rows={[1, 2, 3, 4, 5, 6, 7, 8]} resetKey="todos" />);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8');
  });

  it('returns to the first page when the filter changes', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 15 }, (_, index) => index + 1);
    const { rerender } = render(<Harness rows={rows} resetKey="todos" />);

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('9,10,11,12,13,14,15');

    rerender(<Harness rows={rows.slice(0, 12)} resetKey="filtro" />);
    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8');
  });
});
