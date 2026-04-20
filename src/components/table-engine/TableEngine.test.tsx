import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TableEngine } from './TableEngine';
import type { TableEngineConfig } from './types';

type TestRow = {
  id: string;
  name: string;
  quantity: number;
  categoryId: string | null;
};

function buildConfig(overrides: Partial<TableEngineConfig<TestRow>> = {}): TableEngineConfig<TestRow> {
  return {
    title: 'Inventario test',
    storageKey: 'table-engine-test',
    exportSheetName: 'Inventario',
    filters: [],
    sortOptions: [],
    columns: [
      {
        id: 'name',
        label: 'Nombre',
        field: 'name',
        defaultWidth: 180,
        type: 'text',
        editable: true,
      },
      {
        id: 'quantity',
        label: 'Cantidad',
        field: 'quantity',
        defaultWidth: 120,
        type: 'number',
        editable: true,
      },
    ],
    fetchPage: vi.fn(),
    onUpdate: vi.fn(),
    onDelete: vi.fn(),
    addRowFields: [
      {
        colId: 'name',
        placeholder: 'Nuevo nombre',
        required: true,
      },
    ],
    onCreate: vi.fn(),
    buildNewItem: (formData, categoryId) => ({
      ...formData,
      categoryId,
      quantity: Number(formData.quantity ?? 0),
    }),
    ...overrides,
  };
}

describe('TableEngine', () => {
  it('loads rows and refetches them when the search term changes', async () => {
    const rows: TestRow[] = [
      { id: '1', name: 'iPhone 14', quantity: 2, categoryId: null },
      { id: '2', name: 'Pixel 9', quantity: 1, categoryId: null },
    ];

    const fetchPage = vi.fn(async ({ search }: { search?: string }) => {
      const filtered = search
        ? rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()))
        : rows;

      return {
        items: filtered,
        total: filtered.length,
      };
    });

    const { rerender } = render(
      <TableEngine
        config={buildConfig({ fetchPage })}
        user={{ uid: 'user-1' }}
      />
    );

    expect(await screen.findByText('iPhone 14')).toBeInTheDocument();
    expect(screen.getByText('Pixel 9')).toBeInTheDocument();

    rerender(
      <TableEngine
        config={buildConfig({ fetchPage })}
        user={{ uid: 'user-1' }}
        searchTerm="Pixel"
      />
    );

    await waitFor(() => {
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 30,
          search: 'Pixel',
        })
      );
    });

    expect(await screen.findByText('Pixel 9')).toBeInTheDocument();
    expect(screen.queryByText('iPhone 14')).not.toBeInTheDocument();
  });

  it('supports range selection and bulk delete', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
      { id: '2', name: 'Beta', quantity: 2, categoryId: null },
      { id: '3', name: 'Gamma', quantity: 3, categoryId: null },
    ];

    const onBulkDelete = vi.fn(async (ids: string[]) => {
      for (const id of ids) {
        const index = rows.findIndex((row) => row.id === id);
        if (index >= 0) rows.splice(index, 1);
      }
    });

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onBulkDelete,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const alphaRow = (await screen.findByText('Alpha')).closest('tr');
    const betaRow = screen.getByText('Beta').closest('tr');

    if (!alphaRow || !betaRow) {
      throw new Error('Table rows were not rendered');
    }

    await user.click(alphaRow);
    fireEvent.click(betaRow, { shiftKey: true });

    expect(screen.getByTestId('table-row-select-1')).toBeChecked();
    expect(screen.getByTestId('table-row-select-2')).toBeChecked();

    await user.click(screen.getByTestId('table-bulk-delete'));

    await waitFor(() => {
      expect(onBulkDelete).toHaveBeenCalledWith(['1', '2']);
    });
  });

  it('commits inline edits through the update handler', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
    ];

    const onUpdate = vi.fn(async (row: TestRow) => {
      rows[0] = row;
    });

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onUpdate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(await screen.findByText('Alpha'));

    const inlineInput = screen.getByDisplayValue('Alpha');
    await user.clear(inlineInput);
    await user.type(inlineInput, 'Omega{Enter}');

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          name: 'Omega',
        })
      );
    });
  });

  it('creates rows from the quick add flow and reloads the first page', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
    ];

    const fetchPage = vi.fn(async () => ({
      items: [...rows],
      total: rows.length,
    }));

    const onCreate = vi.fn(async (data: Record<string, unknown>) => {
      rows.unshift({
        id: String(rows.length + 1),
        name: String(data.name),
        quantity: Number(data.quantity ?? 0),
        categoryId: null,
      });
    });

    render(
      <TableEngine
        config={buildConfig({
          fetchPage,
          onCreate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Nuevo' }));
    await user.type(screen.getByPlaceholderText('Nuevo nombre'), 'Gamma{Enter}');

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gamma',
          quantity: 0,
          categoryId: null,
        })
      );
      expect(fetchPage).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText('Gamma')).toBeInTheDocument();
  });
});
