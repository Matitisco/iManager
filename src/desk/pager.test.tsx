import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TablePager, usePagedRows } from './pager';

function Harness({ rows, resetKey, pageSize }: { rows: number[]; resetKey: string; pageSize?: number }) {
  const page = usePagedRows(rows, resetKey, pageSize);
  return (
    <div>
      <div data-testid="visible">{page.visible.join(',')}</div>
      <TablePager page={page.page} pages={page.pages} total={page.total} from={page.from} to={page.to} onPage={page.setPage} pageSize={pageSize} />
    </div>
  );
}

describe('table pagination', () => {
  it('shows 8 rows and moves to the next pages', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 23 }, (_, index) => index + 1);
    render(<Harness rows={rows} resetKey="todos" />);

    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8');
    expect(screen.getByText('1–8 de 23')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página 2' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('9,10,11,12,13,14,15,16');

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('visible')).toHaveTextContent('17,18,19,20,21,22,23');
    expect(screen.getByText('17–23 de 23')).toBeInTheDocument();
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
    expect(screen.getByTestId('visible')).toHaveTextContent('9,10,11,12,13,14,15');

    rerender(<Harness rows={rows.slice(0, 12)} resetKey="filtro" />);
    expect(screen.getByTestId('visible')).toHaveTextContent('1,2,3,4,5,6,7,8');
  });

  it('supports 16 rows without changing the default of 8 for other tables', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 17 }, (_, index) => index + 1);
    const { rerender } = render(<Harness rows={rows} resetKey="todos" pageSize={16} />);
    expect(screen.getByText('1–16 de 17')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('visible')).toHaveTextContent(/^17$/);
    expect(screen.getByText('17–17 de 17')).toBeInTheDocument();

    rerender(<Harness rows={rows} resetKey="default" />);
    expect(screen.getByText('1–8 de 17')).toBeInTheDocument();
    expect(screen.getByTestId('visible')).toHaveTextContent(/^1,2,3,4,5,6,7,8$/);
  });

  it('hides the pager for exactly one custom-sized page', () => {
    render(<Harness rows={Array.from({ length: 16 }, (_, i) => i)} resetKey="todos" pageSize={16} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('clamps to the last page when rows disappear, including an empty list', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 40 }, (_, i) => i + 1);
    const { rerender } = render(<Harness rows={rows} resetKey="todos" pageSize={16} />);
    await user.click(screen.getByRole('button', { name: 'Página 3' }));
    rerender(<Harness rows={rows.slice(0, 17)} resetKey="todos" pageSize={16} />);
    expect(screen.getByText('17–17 de 17')).toBeInTheDocument();
    rerender(<Harness rows={[]} resetKey="todos" pageSize={16} />);
    expect(screen.getByTestId('visible')).toBeEmptyDOMElement();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
