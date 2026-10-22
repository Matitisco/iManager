import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnFilter } from './ColumnFilter';

const longName = 'Matías Tiscornia con un nombre extremadamente largo';

function options() {
  return <div className="opts">
    <label className="chk"><input type="checkbox" aria-label={longName} defaultChecked /><span>{longName}</span><em>123</em></label>
    <label className="chk"><input type="checkbox" /><span>Sin vendedor</span><em>17</em></label>
  </div>;
}

afterEach(() => vi.restoreAllMocks());

describe('shared column filter', () => {
  it('renders option text and counts separately and keeps selection and clearing functional', async () => {
    const onToggle = vi.fn();
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(<ColumnFilter label="vendedor" open active onToggle={onToggle} onClear={onClear}>{options()}</ColumnFilter>);
    const popup = screen.getByRole('dialog', { name: 'Filtrar vendedor' });
    const option = within(popup).getByRole('checkbox', { name: longName });
    expect(option).toBeChecked();
    expect(option.closest('label')?.querySelector('span')).toHaveTextContent(longName);
    expect(option.closest('label')?.querySelector('em')).toHaveTextContent('123');
    await user.click(option);
    expect(option).not.toBeChecked();
    await user.click(within(popup).getByRole('button', { name: 'Limpiar' }));
    expect(onClear).toHaveBeenCalledOnce();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it.each(['left', 'right'] as const)('clamps %s-aligned menus to both viewport edges at 390px', (align) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 375, right: 397, bottom: 48 } as DOMRect);
    render(<ColumnFilter label="pago" open active={false} align={align} onToggle={vi.fn()} onClear={vi.fn()}>{options()}</ColumnFilter>);
    const popup = screen.getByRole('dialog', { name: 'Filtrar pago' });
    expect(popup).toHaveStyle({ left: '134px', top: '56px' });
    expect(within(popup).queryByText('Limpiar')).not.toBeInTheDocument();
  });
});
