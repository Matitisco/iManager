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
  it('shows 10 rows and moves to the next pages', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 23 }, (_, index) => index + 1);
    render(<Harness rows={rows} resetKey="todos" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8,9,10');
    expect(screen.getByText('1–10 de 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('11,12,13,14,15,16,17,18,19,20');

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('21,22,23');
    expect(screen.getByText('21–23 de 23')).toBeInTheDocument();
  });

  it('hides the pager when the list fits on one page', () => {
    render(<Harness rows={[1, 2, 3]} resetKey="todos" />);
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).not.toBeInTheDocument();
    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3');
  });

  it('returns to the first page when the filter changes', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 15 }, (_, index) => index + 1);
    const { rerender } = render(<Harness rows={rows} resetKey="todos" />);

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('11,12,13,14,15');

    rerender(<Harness rows={rows.slice(0, 12)} resetKey="filtro" />);
    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8,9,10');
  });
});
