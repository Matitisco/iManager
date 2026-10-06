import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TableEngine } from './TableEngine';
import type { TableEngineConfig } from './types';
import { clearRowClipboardMemory } from './rowClipboard';

type TestRow = {
  id: string;
  name: string;
  quantity: number;
  categoryId: string | null;
  imei?: string;
  status?: string;
  channel?: string;
  customFields?: Record<string, unknown>;
};

function buildConfig(overrides: Partial<TableEngineConfig<TestRow>> = {}): TableEngineConfig<TestRow> {
  return {
    title: 'Inventario test',
    storageKey: 'table-engine-test',
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

  it('shows one page at a time and moves with the page controls', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = Array.from({ length: 5 }, (_, index) => ({
      id: String(index + 1),
      name: `Equipo ${index + 1}`,
      quantity: index + 1,
      categoryId: null,
    }));
    const fetchPage = vi.fn(async ({ skip = 0, take = 2 }: { skip?: number; take?: number }) => ({
      items: rows.slice(skip, skip + take),
      total: rows.length,
    }));

    render(
      <TableEngine
        config={buildConfig({
          fetchPage,
          pagination: { pageSize: 2 },
          noun: 'equipo',
          nounPlural: 'equipos',
        })}
        user={{ uid: 'user-1' }}
      />
    );

    expect(await screen.findByText('Equipo 1')).toBeInTheDocument();
    expect(screen.getByText('Equipo 2')).toBeInTheDocument();
    expect(screen.queryByText('Equipo 3')).not.toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, take: 2 }));

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));

    expect(await screen.findByText('Equipo 3')).toBeInTheDocument();
    expect(screen.getByText('Equipo 4')).toBeInTheDocument();
    expect(screen.queryByText('Equipo 1')).not.toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2, take: 2 }));
    expect(screen.getByText('3–4')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(await screen.findByText('Equipo 1')).toBeInTheDocument();
    expect(screen.queryByText('Equipo 3')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
  });

  it('shows the full filtered total beside the title, not the current page', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = Array.from({ length: 5 }, (_, index) => ({
      id: String(index + 1),
      name: `Equipo ${index + 1}`,
      quantity: index + 1,
      categoryId: null,
    }));
    const fetchPage = vi.fn(async ({
      skip = 0,
      take = 2,
      search,
    }: {
      skip?: number;
      take?: number;
      search?: string;
    }) => {
      if (search === 'ninguno') return { items: [], total: 0 };
      if (search === 'uno') return { items: rows.slice(0, 1), total: 1 };
      return { items: rows.slice(skip, skip + take), total: rows.length };
    });
    const config = buildConfig({
      title: 'Inventario',
      fetchPage,
      pagination: { pageSize: 2 },
      noun: 'equipo',
      nounPlural: 'equipos',
      showFilteredTotal: true,
      filters: [{
        id: 'status',
        label: 'Estado',
        param: 'status',
        defaultValue: 'Todos',
        options: [
          { value: 'Todos', label: 'Todos' },
          { value: 'Disponible', label: 'Disponible' },
        ],
      }],
    });

    const { rerender } = render(
      <TableEngine config={config} user={{ uid: 'user-1' }} />
    );

    expect(await screen.findByText('Equipo 1')).toBeInTheDocument();
    expect(screen.getByText('Equipo 2')).toBeInTheDocument();
    expect(screen.queryByTestId('filtered-result-total')).not.toBeInTheDocument();

    rerender(
      <TableEngine config={config} user={{ uid: 'user-1' }} searchTerm="iphone" />
    );

    expect(await screen.findByTestId('filtered-result-total')).toHaveTextContent('5 equipos');
    expect(screen.queryByText('Equipo 3')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(await screen.findByText('Equipo 3')).toBeInTheDocument();
    expect(screen.getByTestId('filtered-result-total')).toHaveTextContent('5 equipos');

    rerender(
      <TableEngine config={config} user={{ uid: 'user-1' }} searchTerm="uno" />
    );
    expect(await screen.findByTestId('filtered-result-total')).toHaveTextContent('1 equipo');

    rerender(
      <TableEngine config={config} user={{ uid: 'user-1' }} searchTerm="ninguno" />
    );
    expect(await screen.findByTestId('filtered-result-total')).toHaveTextContent('0 equipos');

    rerender(
      <TableEngine config={config} user={{ uid: 'user-1' }} />
    );
    await waitFor(() => {
      expect(screen.queryByTestId('filtered-result-total')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Filtros' }));
    await user.selectOptions(screen.getByRole('combobox'), 'Disponible');

    expect(await screen.findByTestId('filtered-result-total')).toHaveTextContent('5 equipos');
    expect(screen.getByText('Equipo 1')).toBeInTheDocument();
    expect(screen.queryByText('Equipo 3')).not.toBeInTheDocument();
    expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({
      skip: 0,
      take: 2,
      filters: { status: 'Disponible' },
    }));
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

  it('deletes every selected row from the context menu', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
      { id: '2', name: 'Beta', quantity: 2, categoryId: null },
    ];
    const onBulkDelete = vi.fn(async () => {});

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onBulkDelete,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const alphaRow = (await screen.findByText('Alpha')).closest('tr')!;
    const betaRow = screen.getByText('Beta').closest('tr')!;
    await user.click(alphaRow);
    await user.click(betaRow);
    fireEvent.contextMenu(betaRow);
    await user.click(screen.getByText('Eliminar 2'));

    await waitFor(() => {
      expect(onBulkDelete).toHaveBeenCalledWith(['1', '2']);
    });
    await waitFor(() => {
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();
  });

  it('hides the selection bar after deleting the selected row from the context menu', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
      { id: '2', name: 'Beta', quantity: 2, categoryId: null },
      { id: '3', name: 'Gamma', quantity: 3, categoryId: null },
    ];
    let releaseRefetch: (() => void) | null = null;
    let fetches = 0;
    const fetchPage = vi.fn(({ skip = 0, take = 2 }: { skip?: number; take?: number }) => {
      fetches += 1;
      const payload = () => ({ items: rows.slice(skip, skip + take), total: rows.length });
      if (fetches === 1) return Promise.resolve(payload());
      return new Promise<{ items: TestRow[]; total: number }>((resolve) => {
        releaseRefetch = () => resolve(payload());
      });
    });
    const onDelete = vi.fn(async (id: string) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    });

    render(
      <TableEngine
        config={buildConfig({
          fetchPage,
          onDelete,
          pagination: { pageSize: 2 },
          noun: 'equipo',
          nounPlural: 'equipos',
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const alphaRow = (await screen.findByText('Alpha')).closest('tr')!;
    await user.click(alphaRow);
    expect(screen.getByText('1 equipo seleccionado')).toBeInTheDocument();

    fireEvent.contextMenu(alphaRow);
    await user.click(screen.getByRole('button', { name: 'Eliminar equipo' }));
    const dialog = screen.getByRole('heading', { name: 'Eliminar equipo' }).parentElement;
    if (!dialog) throw new Error('Delete confirmation was not rendered');
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('1');
    });
    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();

    releaseRefetch?.();
    await waitFor(() => {
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    expect(screen.queryByText(/seleccionado/)).not.toBeInTheDocument();
    expect(screen.getByTestId('table-row-select-2')).not.toBeChecked();
  });

  it('keeps rows and shows the backend error when a delete fails', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const rows: TestRow[] = [{ id: '1', name: 'Alpha', quantity: 1, categoryId: null }];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onDelete: vi.fn(async () => { throw new Error('No se pudo eliminar la venta (400)'); }),
        })}
        user={{ uid: 'user-1' }}
      />
    );

    fireEvent.contextMenu((await screen.findByText('Alpha')).closest('tr')!);
    await user.click(screen.getByText('Eliminar ítem'));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('No se pudo eliminar la venta (400)');
    });
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('removes moved rows from the current category view after a context menu move', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: 'cat-a' },
      { id: '2', name: 'Beta', quantity: 2, categoryId: 'cat-a' },
    ];
    const onBulkMoveCategory = vi.fn(async () => {});

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async ({ categoryId }) => {
            const items = categoryId ? rows.filter((row) => row.categoryId === categoryId) : rows;
            return { items, total: items.length };
          }),
          categories: [
            { id: 'cat-a', name: 'Mostrador' },
            { id: 'cat-b', name: 'Web' },
          ],
          onBulkMoveCategory,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await screen.findByText('Alpha');
    await user.click(screen.getByRole('button', { name: 'Mostrador' }));
    fireEvent.contextMenu((await screen.findByText('Alpha')).closest('tr')!);
    await user.click(screen.getByText('Mover a categoría →'));
    await user.click(screen.getAllByRole('button', { name: 'Web' }).at(-1)!);

    await waitFor(() => {
      expect(onBulkMoveCategory).toHaveBeenCalledWith(['1'], 'cat-b');
    });
    await waitFor(() => {
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Beta')).toBeInTheDocument();
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

  it('inserts the draft row in the current view instead of at the end of the table', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
      { id: '2', name: 'Beta', quantity: 2, categoryId: null },
      { id: '3', name: 'Gamma', quantity: 3, categoryId: null },
    ];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
        })}
        user={{ uid: 'user-1' }}
      />
    );

    expect(await screen.findByText('Gamma')).toBeInTheDocument();

    const container = screen.getByRole('table').parentElement as HTMLDivElement;
    Object.defineProperty(container, 'scrollTop', { configurable: true, value: 240 });
    const header = container.querySelector('thead') as HTMLElement;
    header.getBoundingClientRect = () => ({
      top: 0, bottom: 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: 0, toJSON() { return {}; },
    });
    container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row-id]').forEach((row, index) => {
      const top = index === 0 ? -80 : index === 1 ? 48 : 120;
      row.getBoundingClientRect = () => ({
        top,
        bottom: top + 40,
        left: 0,
        right: 0,
        width: 0,
        height: 40,
        x: 0,
        y: top,
        toJSON() { return {}; },
      });
    });

    await user.click(screen.getByRole('button', { name: 'Nuevo' }));

    const addRow = screen.getByTestId('table-add-row');
    const alpha = screen.getByText('Alpha').closest('tr');
    const beta = screen.getByText('Beta').closest('tr');
    if (!alpha || !beta) throw new Error('Table rows were not rendered');

    expect(alpha.compareDocumentPosition(addRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addRow.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('inserts the draft row after the row opened from the context menu', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
      { id: '2', name: 'Beta', quantity: 2, categoryId: null },
      { id: '3', name: 'Gamma', quantity: 3, categoryId: null },
    ];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
        })}
        user={{ uid: 'user-1' }}
      />
    );

    fireEvent.contextMenu(await screen.findByText('Beta'));
    await user.click(screen.getByRole('button', { name: 'Agregar ítem' }));

    const addRow = screen.getByTestId('table-add-row');
    const beta = screen.getByText('Beta').closest('tr');
    const gamma = screen.getByText('Gamma').closest('tr');
    if (!beta || !gamma) throw new Error('Table rows were not rendered');

    expect(beta.compareDocumentPosition(addRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(addRow.compareDocumentPosition(gamma) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('copies selected rows and pastes them as new records', async () => {
    clearRowClipboardMemory();
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: 'phones', imei: '111' },
      { id: '2', name: 'Beta', quantity: 2, categoryId: 'phones', imei: '222' },
    ];
    const onCreate = vi.fn(async () => undefined);

    render(
      <TableEngine
        config={buildConfig({
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
            {
              id: 'imei',
              label: 'IMEI',
              field: 'imei',
              defaultWidth: 140,
              type: 'text',
              editable: true,
              onDuplicateValue: (value) => `${value}-copy`,
            },
          ],
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onCreate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const alphaRow = (await screen.findByText('Alpha')).closest('tr') as HTMLElement;
    const betaRow = screen.getByText('Beta').closest('tr') as HTMLElement;
    await user.click(alphaRow);
    fireEvent.click(betaRow, { shiftKey: true });
    fireEvent.keyDown(document, { key: 'c', ctrlKey: true });

    expect(await screen.findByText('Se copiaron 2 ítems')).toBeInTheDocument();

    fireEvent.paste(document.body, { clipboardData: { getData: () => '' } });

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(2);
    });
    expect(onCreate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      name: 'Alpha',
      quantity: 1,
      imei: '111-copy',
      categoryId: 'phones',
    }));
    expect(onCreate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      name: 'Beta',
      quantity: 2,
      imei: '222-copy',
      categoryId: 'phones',
    }));
  });

  it('pastes an external table as new rows without rewriting unique values', async () => {
    clearRowClipboardMemory();
    const onCreate = vi.fn(async () => undefined);

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: [], total: 0 })),
          onCreate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    fireEvent.paste(document.body, {
      clipboardData: {
        getData: () => 'Nombre\tCantidad\nGamma\t4',
      },
    });

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Gamma',
        quantity: 4,
      }));
    });
  });

  it('renames a dropdown tag from the pencil editor without changing the stored value', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    type BadgeRow = TestRow & { status: 'DISPONIBLE' | 'VENDIDO' };
    const rows: BadgeRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null, status: 'DISPONIBLE' },
    ];

    render(
      <TableEngine
        config={buildConfig({
          columns: [
            {
              id: 'status',
              label: 'Disponibilidad',
              field: 'status',
              defaultWidth: 160,
              type: 'badge',
              editable: true,
              enumOptions: ['DISPONIBLE', 'VENDIDO'],
              badgeMeta: {
                DISPONIBLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
                VENDIDO: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'VENDIDO' },
              },
            },
          ],
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onUpdate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(await screen.findByText('DISPONIBLE'));
    await user.click(screen.getByRole('button', { name: 'Editar etiqueta DISPONIBLE' }));

    const input = screen.getByTestId('tag-edit-input');
    await user.clear(input);
    await user.type(input, 'En local');
    await user.click(screen.getByRole('button', { name: 'Color Azul' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getAllByText('En local').length).toBeGreaterThan(0);
    expect(onUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'VENDIDO' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        status: 'VENDIDO',
      }));
    });
  });

  it('creates a new tag from the bottom of badge and enum dropdowns', async () => {
    localStorage.removeItem('table-engine-new-tag:user-1:tagOptions');
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    type DropdownRow = TestRow & { status: string; channel: string };
    const rows: DropdownRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null, status: 'DISPONIBLE', channel: 'Local' },
    ];

    render(
      <TableEngine
        config={buildConfig({
          storageKey: 'table-engine-new-tag',
          columns: [
            {
              id: 'status',
              label: 'Disponibilidad',
              field: 'status',
              defaultWidth: 160,
              type: 'badge',
              editable: true,
              enumOptions: ['DISPONIBLE', 'VENDIDO'],
              badgeMeta: {
                DISPONIBLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
                VENDIDO: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'VENDIDO' },
              },
            },
            {
              id: 'channel',
              label: 'Canal',
              field: 'channel',
              defaultWidth: 140,
              type: 'enum',
              editable: true,
              enumOptions: ['Local', 'Online'],
            },
          ],
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onUpdate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(await screen.findByText('DISPONIBLE'));
    await user.click(screen.getByRole('button', { name: 'Nueva etiqueta' }));
    await user.type(screen.getByTestId('tag-edit-input'), 'Reservado');
    await user.click(screen.getByRole('button', { name: 'Color Ámbar' }));
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        status: 'Reservado',
      }));
    });

    await user.click(screen.getByText('Local'));
    expect(screen.getByRole('button', { name: 'Nueva etiqueta' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nueva etiqueta' }));
    await user.type(screen.getByTestId('tag-edit-input'), 'Local');
    await user.click(screen.getByRole('button', { name: 'Crear' }));
    expect(screen.getByText('Esa etiqueta ya existe.')).toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('removes a tag from the dropdown without changing the stored row', async () => {
    localStorage.removeItem('table-engine-delete-tag:user-1:tagOptions');
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    type BadgeRow = TestRow & { status: string };
    const rows: BadgeRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null, status: 'DISPONIBLE' },
    ];

    render(
      <TableEngine
        config={buildConfig({
          storageKey: 'table-engine-delete-tag',
          columns: [
            {
              id: 'status',
              label: 'Disponibilidad',
              field: 'status',
              defaultWidth: 160,
              type: 'badge',
              editable: true,
              enumOptions: ['DISPONIBLE', 'VENDIDO'],
              badgeMeta: {
                DISPONIBLE: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'DISPONIBLE' },
                VENDIDO: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'VENDIDO' },
              },
            },
          ],
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onUpdate,
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(await screen.findByText('DISPONIBLE'));
    await user.click(screen.getByRole('button', { name: 'Eliminar etiqueta VENDIDO' }));

    expect(screen.queryByRole('button', { name: 'Eliminar etiqueta VENDIDO' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eliminar etiqueta DISPONIBLE' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva etiqueta' })).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Nueva etiqueta' }));
    await user.type(screen.getByTestId('tag-edit-input'), 'Reservado');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await user.click(await screen.findByText('Reservado'));
    await user.click(screen.getByRole('button', { name: 'Eliminar etiqueta Reservado' }));
    expect(screen.queryByRole('button', { name: 'Eliminar etiqueta Reservado' })).not.toBeInTheDocument();
    expect(screen.getByText('DISPONIBLE')).toBeInTheDocument();
  });

  it('renames a column from a double click and cancels with escape', async () => {
    const user = userEvent.setup();
    const rows: TestRow[] = [
      { id: '1', name: 'Alpha', quantity: 1, categoryId: null },
    ];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.dblClick(await screen.findByText('Nombre'));
    const input = screen.getByRole('textbox', { name: 'Nombre de la columna' });
    expect(input).toHaveValue('Nombre');
    expect(input).toHaveClass('text-xs', 'font-bold', 'tracking-wider', 'uppercase', 'ring-inset');

    await user.type(input, ' temporal');
    await user.keyboard('{Escape}');
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nombre de la columna' })).not.toBeInTheDocument();

    await user.dblClick(screen.getByText('Nombre'));
    const nextInput = screen.getByRole('textbox', { name: 'Nombre de la columna' });
    await user.clear(nextInput);
    await user.type(nextInput, 'Equipo{Enter}');

    expect(await screen.findByText('Equipo')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Nombre de la columna' })).not.toBeInTheDocument();
  });

  it('creates a dropdown custom column with fixed options', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    const rows: TestRow[] = [{ id: '1', name: 'Alpha', quantity: 1, categoryId: null }];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          customColumnActions: { onCreate },
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const header = await screen.findByText('Nombre');
    fireEvent.contextMenu(header.closest('th') ?? header);
    await user.click(screen.getByRole('button', { name: 'Nueva columna desplegable' }));

    expect(screen.getByText('Creá un desplegable con opciones fijas. En cada celda se elige una de esas opciones.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nombre'), 'Estado');
    await user.type(screen.getByLabelText('Opción 1'), ' Nuevo ');
    await user.type(screen.getByLabelText('Opción 2'), 'Usado');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        label: 'Estado',
        type: 'enum',
        options: ['Nuevo', 'Usado'],
      });
    });
  });

  it('rejects a dropdown column with fewer than two distinct options', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    const rows: TestRow[] = [{ id: '1', name: 'Alpha', quantity: 1, categoryId: null }];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          customColumnActions: { onCreate },
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const header = await screen.findByText('Nombre');
    fireEvent.contextMenu(header.closest('th') ?? header);
    await user.click(screen.getByRole('button', { name: 'Nueva columna desplegable' }));
    await user.type(screen.getByLabelText('Nombre'), 'Estado');
    await user.type(screen.getByLabelText('Opción 1'), 'Nuevo');
    await user.type(screen.getByLabelText('Opción 2'), ' nuevo ');
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    expect(await screen.findByText('Agregá al menos dos opciones distintas.')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('creates a multi-tag custom column', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(async () => undefined);
    const rows: TestRow[] = [{ id: '1', name: 'Alpha', quantity: 1, categoryId: null }];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          customColumnActions: { onCreate },
        })}
        user={{ uid: 'user-1' }}
      />
    );

    const header = await screen.findByText('Nombre');
    fireEvent.contextMenu(header.closest('th') ?? header);
    await user.click(screen.getByRole('button', { name: 'Nueva columna multietiqueta' }));
    expect(screen.getByText('Creá una columna multietiqueta. En cada celda podés poner varias etiquetas.')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ej: Proveedor'), { target: { value: 'Etiquetas' } });
    await user.click(screen.getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ label: 'Etiquetas', type: 'tags' });
    });
  });

  it('keeps several tags in the same cell', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(async () => undefined);
    const rows: TestRow[] = [{
      id: '1',
      name: 'Alpha',
      quantity: 1,
      categoryId: null,
      customFields: { labels: ['VIP'] },
    }];

    render(
      <TableEngine
        config={buildConfig({
          fetchPage: vi.fn(async () => ({ items: rows, total: rows.length })),
          onUpdate,
          dynamicColumns: {
            columns: [{ id: 'labels', label: 'Etiquetas', type: 'tags' }],
            getValue: (row, columnId) => row.customFields?.[columnId] ?? [],
            setValue: (row, columnId, value) => ({
              ...row,
              customFields: { ...(row.customFields ?? {}), [columnId]: value },
            }),
          },
        })}
        user={{ uid: 'user-1' }}
      />
    );

    await user.click(await screen.findByRole('button', { name: 'Etiquetas: VIP' }));
    await user.type(screen.getByLabelText('Nueva etiqueta'), 'Mayorista');
    await user.keyboard('{Enter}');
    await user.type(screen.getByLabelText('Nueva etiqueta'), 'Urgente');
    const overlay = document.querySelector('.fixed.inset-0');
    if (!overlay) throw new Error('Tag editor overlay was not rendered');
    await user.click(overlay);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
        customFields: { labels: ['VIP', 'Mayorista', 'Urgente'] },
      }));
    });
    expect(screen.getByRole('button', { name: 'Etiquetas: VIP, Mayorista, Urgente' })).toBeInTheDocument();
  });
});
