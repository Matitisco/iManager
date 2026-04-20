import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Filter, Download, Columns, Plus, Upload, ArrowUpDown } from 'lucide-react';

import type { TableEngineConfig, WithId, TablePageParams, ColDef } from './types';
import { useTableData } from './hooks/useTableData';
import { useColumnState } from './hooks/useColumnState';
import { useSelection } from './hooks/useSelection';
import { useInlineEdit } from './hooks/useInlineEdit';
import { useColResize } from './hooks/useColResize';
import { useColDrag } from './hooks/useColDrag';
import { useCategoryDrag } from './hooks/useCategoryDrag';
import { useItemDrag } from './hooks/useItemDrag';

import { TableTh } from './components/TableTh';
import { TableTd } from './components/TableTd';
import { CategoryTabs } from './components/CategoryTabs';
import { ActionMenu } from './components/ActionMenu';
import { BulkActionsBar } from './components/BulkActionsBar';
import { ContextMenu } from './components/ContextMenu';
import { EditPanel } from './components/EditPanel';
import { FilterPanel, SortPanel, ColumnsPanel } from './components/Panels';
import { ImportModal as GenericImportModal } from './components/ImportModal';
import { getColumnValue } from './columnAccess';

interface TableEngineProps<TRow extends WithId> {
  config: TableEngineConfig<TRow>;
  user?: any;
  searchTerm?: string;
}

export function TableEngine<TRow extends WithId>({ config, user, searchTerm = '' }: TableEngineProps<TRow>) {
  const {
    title, storageKey, exportSheetName, columns, filters, sortOptions,
    categories = [], onCreateCategory, onRenameCategory, onDeleteCategory,
    onReorderCategories, onBulkMoveCategory,
    fetchPage, fetchFilteredIds, onCreate, onUpdate, onDelete, onBulkDelete,
    addRowFields = [], buildNewItem, editPanelFields = [], editPanelTitle,
    ImportModal, importConfig, showImport = !!(ImportModal || importConfig),
    customColumnActions, dynamicColumns,
    noun = 'ítem', nounPlural = 'ítems',
  } = config;
  const scopedStorageKey = user?.uid ? `${storageKey}:${user.uid}` : storageKey;

  const resolvedColumns = React.useMemo<ColDef<TRow>[]>(() => {
    if (!dynamicColumns?.columns?.length) {
      return columns;
    }

    const defaultWidth = dynamicColumns.defaultWidth ?? 160;
    return [
      ...columns,
      ...dynamicColumns.columns.map((column) => ({
        id: `dynamic:${column.id}`,
        field: `dynamic:${column.id}` as keyof TRow & string,
        label: column.label,
        defaultWidth,
        type: column.type,
        editable: true,
        enumOptions: column.type === 'enum' ? column.options ?? [] : undefined,
        getValue: (row: TRow) => dynamicColumns.getValue(row, column.id),
        setValue: (row: TRow, value: unknown) => dynamicColumns.setValue(row, column.id, value),
        formatDisplay: column.type === 'number'
          ? (value: number | string) => value === '' || value == null ? undefined : String(value)
          : undefined,
      })),
    ];
  }, [columns, dynamicColumns]);

  const PAGE_SIZE = 30;

  // ── State: filters, sort, category, panels ─────────────────────────────────
  const filterDefaults = Object.fromEntries(filters.map(f => [f.id, f.defaultValue]));
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(filterDefaults);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TRow | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: TRow; isBulk: boolean } | null>(null);
  const [headerContextMenu, setHeaderContextMenu] = useState<{ x: number; y: number; colId: string } | null>(null);
  const [addingRow, setAddingRow] = useState<Record<string, any> | null>(null);
  const [pendingItemMove, setPendingItemMove] = useState<{ categoryId: string; categoryName: string; count: number } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string } | null>(null);
  const [newColumnDraft, setNewColumnDraft] = useState<{ label: string; type: 'text' | 'number' } | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<{ id: string; label: string } | null>(null);
  const [columnsToDeleteRight, setColumnsToDeleteRight] = useState<string[] | null>(null);
  const [columnMutationError, setColumnMutationError] = useState<string | null>(null);
  const [isColumnMutationLoading, setIsColumnMutationLoading] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const renameDoneRef = useRef(false);
  const addingRowDataRef = useRef<Record<string, any> | null>(null);
  const addingRowInitialDataRef = useRef<Record<string, any> | null>(null);
  const addFirstInputRef = useRef<HTMLInputElement | null>(null);
  const addRowFieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const addRowRef = useRef<HTMLTableRowElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({});
  const filtersRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const filterParamsRef = useRef<Omit<TablePageParams, 'skip' | 'take'>>({ filters: {} });

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { items, setItems, total, setTotal, isInitialLoading, isLoadingMore, isExporting, setIsExporting, sentinelRef, loadFirstPage } = useTableData({ user, fetchPage, pageSize: PAGE_SIZE });
  const colState = useColumnState(scopedStorageKey, resolvedColumns);
  const { selectedIds, setSelectedIds, allSelected, toggleSelectAll, applySelection, clearSelection } = useSelection(items, total, fetchFilteredIds, filterParamsRef);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  const editHook = useInlineEdit(items, resolvedColumns, colState.orderedVisibleCols, onUpdate, setItems);
  const { activeResizeCol, handleResizeStart } = useColResize(colState.colWidths, colState.setColWidths);
  const { draggingColId, dropBeforeColId, colDragPos, handleColPointerDown } = useColDrag(colState.ALL_COL_IDS, thRefs, colState.setColOrder);
  const catDrag = useCategoryDrag(categories, onReorderCategories);
  const onPendingMove = useCallback((catId: string, catName: string, count: number) => {
    setPendingItemMove({ categoryId: catId, categoryName: catName, count });
  }, []);
  const itemDrag = useItemDrag(
    categories, selectedIdsRef, catDrag.catTabsContainerRef, setSelectedIds, onPendingMove
  );

  // ── Build filter params ────────────────────────────────────────────────────
  const buildFilterParams = useCallback((): Omit<TablePageParams, 'skip' | 'take'> => ({
    categoryId: activeCategoryId === 'all' ? undefined : activeCategoryId,
    sortKey: sortKey ?? undefined,
    sortDir,
    search: searchTerm.trim() || undefined,
    filters: Object.fromEntries(
      Object.entries(activeFilters).filter(([id, val]) => {
        const def = filters.find(f => f.id === id);
        return def && val !== def.defaultValue;
      })
    ),
  }), [activeCategoryId, sortKey, sortDir, searchTerm, activeFilters, filters]);

  useEffect(() => { filterParamsRef.current = buildFilterParams(); }, [buildFilterParams]);

  useEffect(() => {
    const params = buildFilterParams();
    clearSelection();
    loadFirstPage(params);
  }, [activeFilters, activeCategoryId, sortKey, sortDir, searchTerm, user]);

  // ── Click outside popups ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (showColumns && columnsRef.current && !columnsRef.current.contains(target)) setShowColumns(false);
      if (showFilters && filtersRef.current && !filtersRef.current.contains(target)) setShowFilters(false);
      if (showSort && sortRef.current && !sortRef.current.contains(target)) setShowSort(false);
      if (addingRow && addRowRef.current && !addRowRef.current.contains(target)) {
        const current = addingRowDataRef.current ?? {};
        const initial = addingRowInitialDataRef.current ?? {};
        const hasChanges = Object.keys(current).some((key) => String(current[key] ?? '') !== String(initial[key] ?? ''));
        if (hasChanges) void commitAddRow(false);
        else cancelAddRow();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColumns, showFilters, showSort, addingRow]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') clearSelection(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const addingRowActive = !!addingRow;
  useEffect(() => { if (addingRowActive) addFirstInputRef.current?.focus(); }, [addingRowActive]);

  // ── Row interactions ───────────────────────────────────────────────────────
  const handleRowClick = (e: React.MouseEvent, row: TRow, index: number) => {
    if (itemDrag.justItemDraggedRef.current) return;
    const target = e.target as HTMLElement;
    const inputEl = target.closest('input') as HTMLInputElement | null;
    if (target.closest('button, select') || (inputEl && inputEl.type !== 'checkbox')) return;
    if (e.detail >= 2) {
      const td = target.closest('td[data-col]') as HTMLElement | null;
      const colId = td?.dataset.col;
      if (colId && editHook.EDITABLE_COLS.has(colId)) {
        const field = editHook.COL_TO_FIELD[colId];
        const colDef = resolvedColumns.find(c => c.id === colId);
        if (field && colDef) {
          editHook.setFocusedCell(null);
          editHook.startInlineEdit(row.id, field, String(getColumnValue(row, colDef) ?? ''));
        }
      }
      return;
    }
    applySelection(row, index, e.shiftKey);
  };

  const handleContextMenu = (e: React.MouseEvent, row: TRow) => {
    e.preventDefault();
    if (itemDrag.draggingItems) return;
    const isBulk = selectedIds.has(row.id) && selectedIds.size > 1;
    const MENU_W = 208;
    const x = e.clientX + MENU_W > window.innerWidth ? e.clientX - MENU_W : e.clientX;
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setHeaderContextMenu(null);
    setContextMenu({ x, y, item: row, isBulk });
  };

  const openHeaderContextMenu = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    const MENU_W = 232;
    const x = e.clientX + MENU_W > window.innerWidth ? e.clientX - MENU_W : e.clientX;
    const y = Math.min(e.clientY, window.innerHeight - 220);
    setContextMenu(null);
    setHeaderContextMenu({ x, y, colId });
  };

  const canDeleteColumn = (colId: string) =>
    !!customColumnActions?.onDelete && (customColumnActions.canDelete?.(colId) ?? true);

  const submitCreateColumn = async () => {
    if (!customColumnActions || !newColumnDraft) return;

    const label = String(newColumnDraft.label ?? '').trim();
    if (!label) {
      setColumnMutationError('Poné un nombre para la columna.');
      return;
    }

    setIsColumnMutationLoading(true);
    setColumnMutationError(null);
    try {
      await customColumnActions.onCreate({ label, type: newColumnDraft.type });
      setNewColumnDraft(null);
    } catch (error) {
      setColumnMutationError(error instanceof Error ? error.message : 'No se pudo crear la columna.');
    } finally {
      setIsColumnMutationLoading(false);
    }
  };

  const confirmDeleteColumnsRight = async () => {
    if (!customColumnActions?.onDelete || !columnsToDeleteRight) return;
    setIsColumnMutationLoading(true);
    setColumnMutationError(null);
    try {
      for (const colId of columnsToDeleteRight) {
        await customColumnActions.onDelete(colId);
      }
      setColumnsToDeleteRight(null);
    } catch (error) {
      setColumnMutationError(error instanceof Error ? error.message : 'No se pudo eliminar las columnas.');
    } finally {
      setIsColumnMutationLoading(false);
    }
  };

  const confirmDeleteColumn = async () => {
    if (!customColumnActions?.onDelete || !columnToDelete) return;

    setIsColumnMutationLoading(true);
    setColumnMutationError(null);
    try {
      await customColumnActions.onDelete(columnToDelete.id);
      setColumnToDelete(null);
    } catch (error) {
      setColumnMutationError(error instanceof Error ? error.message : 'No se pudo eliminar la columna.');
    } finally {
      setIsColumnMutationLoading(false);
    }
  };

  // ── Add row ────────────────────────────────────────────────────────────────
  const startAddRow = () => {
    if (addingRowDataRef.current) { addFirstInputRef.current?.focus(); return; }
    const initial: Record<string, any> = Object.fromEntries(
      addRowFields.map(f => [
        f.colId,
        (f.type === 'select' || !!f.selectOptions?.length) ? (f.selectOptions?.[0]?.value ?? '') : '',
      ])
    );
    // Auto-initialize all visible editable columns not already covered by addRowFields
    colState.orderedVisibleCols.forEach(colId => {
      if (colId in initial) return;
      const colDef = resolvedColumns.find(c => c.id === colId);
      if (!colDef?.editable) return;
      initial[colId] = (colDef.type === 'enum' || colDef.type === 'badge') ? (colDef.enumOptions?.[0] ?? '') : '';
    });
    addingRowInitialDataRef.current = initial;
    addingRowDataRef.current = initial; setAddingRow(initial);
  };
  const cancelAddRow = () => {
    addingRowInitialDataRef.current = null;
    addingRowDataRef.current = null;
    setAddingRow(null);
  };
  const commitAddRow = async (showErrorIfEmpty = true) => {
    const current = addingRowDataRef.current;
    if (!current) return;
    const missingRequiredField = addRowFields.find((field) => {
      if (!field.required) return false;
      return !String(current[field.colId] ?? '').trim();
    });
    if (missingRequiredField) {
      if (showErrorIfEmpty) {
        addRowFieldRefs.current[missingRequiredField.colId]?.focus();
      } else {
        addingRowDataRef.current = null;
        setAddingRow(null);
      }
      return;
    }
    
    try {
      // Auto-map colId → field using ColDef so buildNewItem always works with field names
      const mapped: Record<string, any> = {};
      for (const [colId, val] of Object.entries(current)) {
        const colDef = resolvedColumns.find(c => c.id === colId);
        mapped[colDef?.field ?? colId] = val;
      }
      const newItemData = buildNewItem
        ? buildNewItem(mapped, activeCategoryId !== 'all' ? activeCategoryId : null)
        : { ...mapped, categoryId: activeCategoryId !== 'all' ? activeCategoryId : null };
      if (onCreate) {
        await onCreate(newItemData);
      }
      
      addingRowInitialDataRef.current = null;
      addingRowDataRef.current = null; setAddingRow(null);
      const result = await fetchPage({ skip: 0, take: PAGE_SIZE, ...filterParamsRef.current });
      setItems(result.items); setTotal(result.total);
    } catch (e: any) {
      alert(e.message || 'Error al agregar el ítem. Verificá los campos e intentá nuevamente.');
      // Re-focus the first input if possible
      addFirstInputRef.current?.focus();
    }
  };

  // ── Bulk move confirm ──────────────────────────────────────────────────────
  const confirmBulkMove = async () => {
    if (!pendingItemMove || !onBulkMoveCategory) return;
    const ids = Array.from(selectedIds);
    await onBulkMoveCategory(ids, pendingItemMove.categoryId || null);
    if (activeCategoryId !== 'all') { setItems(prev => prev.filter(p => !ids.includes(p.id))); setTotal(prev => prev - ids.length); }
    else { setItems(prev => prev.map(p => ids.includes(p.id) ? { ...p, categoryId: pendingItemMove.categoryId } : p)); }
    clearSelection(); setPendingItemMove(null);
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (total === 0) return;
    setIsExporting(true);
    try {
      const result = await fetchPage({ skip: 0, take: total, ...buildFilterParams() });
      const rows = result.items.map(row => {
        const r: Record<string, any> = {};
        colState.orderedVisibleCols.forEach(colId => {
          const colDef = resolvedColumns.find(c => c.id === colId);
          if (!colDef) return;
          r[colState.colNames[colId] || colState.DEFAULT_COL_NAMES[colId] || colId] = getColumnValue(row, colDef) ?? '';
        });
        return r;
      });
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(exportSheetName);
      const columns = Object.keys(rows[0] ?? {}).map((key) => ({ header: key, key }));
      worksheet.columns = columns;
      rows.forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${storageKey}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally { setIsExporting(false); }
  };

  const hasActiveFilters = filters.some(f => activeFilters[f.id] !== f.defaultValue);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50 text-gray-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 mr-2">{title}</h1>
        <div className="flex-1" />
        {/* Toolbar */}
        <div className="relative" ref={filtersRef}>
          <button onClick={() => { setShowFilters(!showFilters); setShowSort(false); setShowColumns(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border transition-all ${hasActiveFilters ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            <Filter size={14} /> Filtros {hasActiveFilters && <span className="ml-1 bg-white/20 rounded-md px-1.5 text-xs">{filters.filter(f => activeFilters[f.id] !== f.defaultValue).length}</span>}
          </button>
          {showFilters && (
            <div className="absolute right-0 top-full mt-2 z-30">
              <FilterPanel filters={filters} activeFilters={activeFilters}
                onChange={(id, val) => setActiveFilters(prev => ({ ...prev, [id]: val }))}
                onReset={() => setActiveFilters(filterDefaults)} />
            </div>
          )}
        </div>
        <div className="relative" ref={sortRef}>
          <button onClick={() => { setShowSort(!showSort); setShowFilters(false); setShowColumns(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border transition-all ${sortKey ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
            <ArrowUpDown size={14} /> Ordenar
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-2 z-30">
              <SortPanel sortOptions={sortOptions} sortKey={sortKey} sortDir={sortDir}
                onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setShowSort(false); }}
                onReset={() => { setSortKey(null); setShowSort(false); }} />
            </div>
          )}
        </div>
        <div className="relative" ref={columnsRef}>
          <button onClick={() => { setShowColumns(!showColumns); setShowFilters(false); setShowSort(false); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border bg-white text-gray-600 border-gray-200 hover:border-gray-300 transition-all">
            <Columns size={14} /> Columnas
          </button>
          {showColumns && (
            <div className="absolute right-0 top-full mt-2 z-30">
              <ColumnsPanel allCols={colState.ALL_COL_IDS} alwaysVisible={colState.ALWAYS_VISIBLE}
                colNames={colState.colNames} defaultColNames={colState.DEFAULT_COL_NAMES}
                visibleColumns={colState.visibleColumns} onToggle={colState.toggleColumn}
                onResetNames={() => colState.setColNames({})} />
            </div>
          )}
        </div>
        <button onClick={handleExport} disabled={isExporting || total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border bg-white text-gray-600 border-gray-200 hover:border-gray-300 disabled:opacity-40 transition-all">
          <Download size={14} /> {isExporting ? 'Exportando...' : 'Exportar'}
        </button>
        {showImport && (
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-xl border bg-white text-gray-600 border-gray-200 hover:border-gray-300 transition-all">
            <Upload size={14} /> Importar
          </button>
        )}
        <button onClick={startAddRow}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-xl bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {/* ── Category tabs ── */}
      {(categories.length > 0 || !!onCreateCategory) && (
        <div className="bg-white border-b border-gray-100">
          <CategoryTabs
            categories={categories} activeCategoryId={activeCategoryId} setActiveCategoryId={setActiveCategoryId}
            draggingCat={catDrag.draggingCat} dropTargetId={catDrag.dropTargetId}
            draggingItems={itemDrag.draggingItems} itemDropTarget={itemDrag.itemDropTarget}
            justDraggedRef={catDrag.justDraggedRef} catTabsContainerRef={catDrag.catTabsContainerRef}
            startCatDrag={catDrag.startCatDrag}
            editingCategoryId={editingCategoryId} editingCategoryName={editingCategoryName}
            setEditingCategoryId={setEditingCategoryId} setEditingCategoryName={setEditingCategoryName}
            renameDoneRef={renameDoneRef} onRenameCategory={onRenameCategory}
            onDeleteCategory={onDeleteCategory ? (id, name) => setCategoryToDelete({ id, name }) : undefined}
            onCreateCategory={onCreateCategory}
          />
        </div>
      )}

      {/* ── Table ── */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-sm table-fixed">
          <thead className="sticky top-0 z-20 bg-gray-50 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-100">
            <tr>
              <th className="px-4 py-4 text-left w-12 sticky left-0 bg-gray-50">
                <input data-testid="table-select-all" type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900" />
              </th>
              {colState.orderedVisibleCols.map(col => (
                <TableTh key={col}
                  col={col}
                  colName={colState.colNames[col] || colState.DEFAULT_COL_NAMES[col] || col}
                  colWidth={colState.colWidths[col]}
                  isDragging={draggingColId === col}
                  dropBefore={dropBeforeColId === col}
                  isResizing={activeResizeCol === col}
                  isCustom={col.startsWith('dynamic:')}
                  renamingCol={colState.renamingCol}
                  renameValue={colState.renameValue}
                  setRenameValue={colState.setRenameValue}
                  setRenamingCol={colState.setRenamingCol}
                  commitColRename={colState.commitColRename}
                  thRef={el => { thRefs.current[col] = el; }}
                  onPointerDown={e => handleColPointerDown(e, col)}
                  onResizeStart={e => handleResizeStart(e, col)}
                  onContextMenu={e => openHeaderContextMenu(e, col)}
                />
              ))}
              <th className="px-3 py-4 w-10 bg-gray-50" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isInitialLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-4 py-4"><div className="w-3.5 h-3.5 bg-gray-200 rounded animate-pulse" /></td>
                  {colState.orderedVisibleCols.map(col => (
                    <td key={col} className="px-3 py-4"><div className="h-4 bg-gray-100 rounded-lg animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                  ))}
                  <td className="px-3 py-4" />
                </tr>
              ))
            ) : (
              items.map((row, index) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <tr key={row.id}
                    onClick={e => handleRowClick(e, row, index)}
                    onContextMenu={e => handleContextMenu(e, row)}
                    onPointerDown={e => itemDrag.startItemDrag(e, row.id)}
                    className={`group transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/60' : 'bg-white hover:bg-gray-50/60'}`}>
                    <td className="px-4 py-4 sticky left-0 z-10" style={{ background: 'inherit' }}>
                      <input data-testid={`table-row-select-${row.id}`} type="checkbox" checked={isSelected} readOnly
                        className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900 pointer-events-none" />
                    </td>
                    {colState.orderedVisibleCols.map(colId => {
                      const colDef = resolvedColumns.find(c => c.id === colId);
                      if (!colDef) return null;
                      return (
                        <TableTd key={colId}
                          colId={colId} colDef={colDef} row={row} rowIndex={index}
                          inlineEditCell={editHook.inlineEditCell}
                          inlineEditValue={editHook.inlineEditValue}
                          setInlineEditValue={(v) => { editHook.setInlineEditValue(v); editHook.inlineEditValueRef.current = v; }}
                          inlineEditValueRef={editHook.inlineEditValueRef}
                          focusedCell={editHook.focusedCell}
                          setFocusedCell={editHook.setFocusedCell}
                          startInlineEdit={editHook.startInlineEdit}
                          commitInlineEdit={editHook.commitInlineEdit}
                          cancelInlineEdit={editHook.cancelInlineEdit}
                          inlineEditCellRef={editHook.inlineEditCellRef}
                          handleCellBlur={editHook.handleCellBlur}
                          handleCellKeyDown={editHook.handleCellKeyDown}
                          cellDisplay={editHook.cellDisplay}
                          displayVal={editHook.displayVal}
                        />
                      );
                    })}
                    <td className="px-3 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ActionMenu
                        onEdit={() => setSelectedItem(row)}
                        onDelete={() => setItemToDelete(row.id)}
                      />
                    </td>
                  </tr>
                );
              })
            )}

            {/* Add row inline */}
            {addingRow && !!onCreate && (() => {
              // First text/number input column gets the focus ref
              const firstTextColId = colState.orderedVisibleCols.find(colId => {
                const fc = addRowFields.find(f => f.colId === colId);
                const cd = resolvedColumns.find(c => c.id === colId);
                if (!fc && !cd?.editable) return false;
                const isSelect = fc?.type === 'select' || !!fc?.selectOptions?.length
                  || (!fc && cd && (cd.type === 'enum' || cd.type === 'badge') && !!cd.enumOptions?.length);
                return !isSelect;
              }) ?? null;
              return (
                <tr ref={addRowRef} className="bg-blue-50/30 border-l-2 border-blue-500">
                  <td className="px-4 py-3"><div className="w-3.5 h-3.5 rounded border-2 border-blue-300" /></td>
                  {colState.orderedVisibleCols.map((colId) => {
                    const fieldCfg = addRowFields.find(f => f.colId === colId);
                    const colDef = resolvedColumns.find(c => c.id === colId);
                    // Skip columns that are not editable and not explicitly in addRowFields
                    if (!fieldCfg && !colDef?.editable) return <td key={colId} className="px-3 py-3" />;

                    let effectiveType: 'text' | 'number' | 'select' = 'text';
                    let selectOptions: { value: string; label: string }[] = [];
                    let placeholder = '';

                    // ColDef as base
                    if (colDef) {
                      if (colDef.type === 'number') effectiveType = 'number';
                      else if ((colDef.type === 'enum' || colDef.type === 'badge') && colDef.enumOptions?.length) {
                        effectiveType = 'select';
                        selectOptions = colDef.enumOptions.map(o => ({
                          value: o,
                          label: colDef.badgeMeta?.[o]?.label ?? o,
                        }));
                      }
                    }

                    // addRowFields overrides: placeholder, custom select subset, explicit type
                    if (fieldCfg) {
                      placeholder = fieldCfg.placeholder ?? '';
                      if (fieldCfg.selectOptions?.length) {
                        effectiveType = 'select';
                        selectOptions = fieldCfg.selectOptions;
                      } else if (fieldCfg.type != null && fieldCfg.type !== 'select') {
                        effectiveType = fieldCfg.type;
                      }
                    }

                    return (
                      <td key={colId} className="px-3 py-3">
                        {effectiveType === 'select' ? (
                          <select
                            ref={(node) => { addRowFieldRefs.current[colId] = node; }}
                            value={addingRow[colId] ?? selectOptions[0]?.value ?? ''}
                            onChange={e => { const v = { ...addingRow, [colId]: e.target.value }; addingRowDataRef.current = v; setAddingRow(v); }}
                            onKeyDown={e => { if (e.key === 'Enter') commitAddRow(); if (e.key === 'Escape') cancelAddRow(); }}
                            className="w-full text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue-400">
                            {selectOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input
                            ref={(node) => {
                              addRowFieldRefs.current[colId] = node;
                              if (colId === firstTextColId) {
                                addFirstInputRef.current = node;
                              }
                            }}
                            type={effectiveType === 'number' ? 'number' : 'text'}
                            placeholder={placeholder}
                            value={addingRow[colId] ?? ''}
                            onChange={e => { const v = { ...addingRow, [colId]: e.target.value }; addingRowDataRef.current = v; setAddingRow(v); }}
                            onKeyDown={e => { if (e.key === 'Enter') commitAddRow(); if (e.key === 'Escape') cancelAddRow(); }}
                            className="w-full text-sm border border-blue-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-blue-400" />
                        )}
                      </td>
                    );
                  })}
                  <td className="hidden">
                    <button onClick={() => commitAddRow()} className="px-2 py-1 text-xs font-bold bg-gray-900 text-white rounded-lg">OK</button>
                    <button onClick={cancelAddRow} className="px-2 py-1 text-xs font-bold text-gray-400 hover:text-gray-600 rounded-lg">✕</button>
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-16 flex items-center justify-center">
          {isLoadingMore && <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />}
          {!isInitialLoading && !isLoadingMore && items.length === 0 && (
            <p className="text-sm text-gray-400 font-medium py-12">No hay {nounPlural} para mostrar</p>
          )}
        </div>
      </div>

      {/* ── Floating status ── */}
      {!isInitialLoading && total > 0 && (
        <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>{total} {total === 1 ? noun : nounPlural} en total</span>
          {selectedIds.size > 0 && <span className="font-semibold text-gray-600">{selectedIds.size} seleccionados</span>}
        </div>
      )}

      {/* ── Drag ghosts ── */}
      {catDrag.draggingCat && (
        <div className="fixed pointer-events-none z-[200]" style={{ left: catDrag.dragPos.x + 10, top: catDrag.dragPos.y - 12 }}>
          <div className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-80">{catDrag.draggingCat.label}</div>
        </div>
      )}
      {itemDrag.draggingItems && selectedIds.size > 0 && (
        <div className="fixed pointer-events-none z-[200]" style={{ left: itemDrag.itemDragPos.x + 12, top: itemDrag.itemDragPos.y - 10 }}>
          <div className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xl">{selectedIds.size} {selectedIds.size === 1 ? noun : nounPlural}</div>
        </div>
      )}
      {draggingColId && (
        <div className="fixed pointer-events-none z-[200]" style={{ left: colDragPos.x + 8, top: colDragPos.y - 12 }}>
          <div className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg shadow-xl opacity-80">
            {colState.colNames[draggingColId] || colState.DEFAULT_COL_NAMES[draggingColId]}
          </div>
        </div>
      )}

      {/* ── Bulk actions bar ── */}
      <BulkActionsBar
        selectedIds={selectedIds} total={total} categories={categories}
        onClearSelection={clearSelection} noun={noun} nounPlural={nounPlural}
        onBulkDelete={() => {
          const ids = Array.from(selectedIds);
          (onBulkDelete ? onBulkDelete(ids) : Promise.all(ids.map(id => onDelete(id))))
            .then(() => { setItems(prev => prev.filter(p => !ids.includes(p.id))); setTotal(prev => prev - ids.length); clearSelection(); });
        }}
        onBulkMove={categories.length > 0 && onBulkMoveCategory ? (catId) => {
          const ids = Array.from(selectedIds);
          onBulkMoveCategory(ids, catId || null)
            .then(() => { if (activeCategoryId !== 'all') { setItems(prev => prev.filter(p => !ids.includes(p.id))); setTotal(prev => prev - ids.length); } clearSelection(); });
        } : undefined}
      />

      {/* ── Context menu ── */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x} y={contextMenu.y} item={contextMenu.item} isBulk={contextMenu.isBulk}
            selectedCount={selectedIds.size} categories={categories} onClose={() => setContextMenu(null)}
            onAddRow={!!onCreate ? startAddRow : undefined}
            onEdit={item => { setSelectedItem(item); setContextMenu(null); }}
            onDelete={item => { setItemToDelete(item.id); setContextMenu(null); }}
            onBulkDelete={() => { setContextMenu(null); }}
            onMoveToCategory={onBulkMoveCategory ? (catId) => {
              const ids = contextMenu.isBulk ? Array.from(selectedIds) : [contextMenu.item.id];
              onBulkMoveCategory(ids, catId).then(() => { clearSelection(); });
            } : undefined}
            noun={noun} nounPlural={nounPlural}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {headerContextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setHeaderContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              style={{ position: 'fixed', top: headerContextMenu.y, left: headerContextMenu.x, zIndex: 50 }}
              className="w-56 bg-white rounded-xl shadow-xl border border-gray-100 text-sm py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  colState.setRenameValue(colState.colNames[headerContextMenu.colId] || colState.DEFAULT_COL_NAMES[headerContextMenu.colId] || headerContextMenu.colId);
                  colState.setRenamingCol(headerContextMenu.colId);
                  setHeaderContextMenu(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700"
              >
                Renombrar columna
              </button>
              {!colState.ALWAYS_VISIBLE.has(headerContextMenu.colId) && (
                <>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => {
                      colState.setVisibleColumns(prev => ({ ...prev, [headerContextMenu.colId]: false }));
                      setHeaderContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700"
                  >
                    Ocultar columna
                  </button>
                  {(() => {
                    const colIdx = colState.colOrder.indexOf(headerContextMenu.colId);
                    const colsToRight = colState.colOrder
                      .slice(colIdx + 1)
                      .filter(cId => !colState.ALWAYS_VISIBLE.has(cId) && colState.visibleColumns[cId] !== false);
                    if (colsToRight.length === 0) return null;
                    return (
                      <button
                        onClick={() => {
                          colState.setVisibleColumns(prev => {
                            const next = { ...prev };
                            colsToRight.forEach(cId => { next[cId] = false; });
                            return next;
                          });
                          setHeaderContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700"
                      >
                        Ocultar todas las de la derecha
                      </button>
                    );
                  })()}
                </>
              )}
              {customColumnActions && (
                <>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => {
                      setColumnMutationError(null);
                      setNewColumnDraft({ label: '', type: 'text' });
                      setHeaderContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700"
                  >
                    Nueva columna de texto
                  </button>
                  <button
                    onClick={() => {
                      setColumnMutationError(null);
                      setNewColumnDraft({ label: '', type: 'number' });
                      setHeaderContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 font-medium text-gray-700"
                  >
                    Nueva columna numérica
                  </button>
                </>
              )}
              {canDeleteColumn(headerContextMenu.colId) && (
                <>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => {
                      setColumnMutationError(null);
                      setColumnToDelete({
                        id: headerContextMenu.colId,
                        label: colState.colNames[headerContextMenu.colId] || colState.DEFAULT_COL_NAMES[headerContextMenu.colId] || headerContextMenu.colId,
                      });
                      setHeaderContextMenu(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium"
                  >
                    Eliminar columna
                  </button>
                  {(() => {
                    const colIdx = colState.colOrder.indexOf(headerContextMenu.colId);
                    const deletableRight = colState.colOrder.slice(colIdx + 1).filter(cId => canDeleteColumn(cId));
                    if (deletableRight.length === 0) return null;
                    return (
                      <button
                        onClick={() => {
                          setColumnMutationError(null);
                          setColumnsToDeleteRight(deletableRight);
                          setHeaderContextMenu(null);
                        }}
                        className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 font-medium"
                      >
                        Eliminar columnas de la derecha
                      </button>
                    );
                  })()}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Edit panel ── */}
      <EditPanel
        item={selectedItem} fields={editPanelFields} title={editPanelTitle ?? `Editar ${noun}`}
        onClose={() => setSelectedItem(null)}
        onChange={updated => setSelectedItem(updated)}
        onSave={async (item) => { await onUpdate(item); setItems(prev => prev.map(p => p.id === item.id ? item : p)); }}
        onDelete={onDelete ? (id) => { setSelectedItem(null); onDelete(id).then(() => { setItems(prev => prev.filter(p => p.id !== id)); setTotal(prev => prev - 1); }); } : undefined}
      />

      {/* ── Pending item move confirm ── */}
      <AnimatePresence>
        {pendingItemMove && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setPendingItemMove(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-80">
              <h3 className="text-base font-bold text-gray-900 mb-2">Mover {pendingItemMove.count} {pendingItemMove.count === 1 ? noun : nounPlural}</h3>
              <p className="text-sm text-gray-500 mb-5">¿Mover a <strong>{pendingItemMove.categoryName}</strong>?</p>
              <div className="flex gap-3">
                <button onClick={() => setPendingItemMove(null)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button onClick={confirmBulkMove} className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800">Mover</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newColumnDraft && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => !isColumnMutationLoading && setNewColumnDraft(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-[26rem]"
            >
              <h3 className="text-base font-bold text-gray-900 mb-2">Nueva columna</h3>
              <p className="text-sm text-gray-500 mb-4">
                Creá una columna {newColumnDraft.type === 'number' ? 'numérica' : 'de texto'} para esta tabla.
              </p>
              <div className="space-y-3">
                <input
                  autoFocus
                  maxLength={30}
                  value={newColumnDraft.label}
                  onChange={(e) => setNewColumnDraft((prev) => prev ? { ...prev, label: e.target.value } : prev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submitCreateColumn();
                    }
                  }}
                  placeholder="Ej: Proveedor"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
                />
                {columnMutationError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {columnMutationError}
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setNewColumnDraft(null)}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void submitCreateColumn()}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                >
                  {isColumnMutationLoading ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Category delete confirm ── */}
      <AnimatePresence>
        {categoryToDelete && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setCategoryToDelete(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-80">
              <h3 className="text-base font-bold text-gray-900 mb-2">Eliminar categoría</h3>
              <p className="text-sm text-gray-500 mb-5">
                ¿Eliminar <strong>{categoryToDelete.name}</strong>? Los {nounPlural} de esta categoría quedarán sin categoría.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={async () => {
                    if (!onDeleteCategory) return;
                    await onDeleteCategory(categoryToDelete.id);
                    setCategoryToDelete(null);
                    const result = await fetchPage({ skip: 0, take: PAGE_SIZE, ...buildFilterParams() });
                    setItems(result.items); setTotal(result.total);
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700">
                  Eliminar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {columnToDelete && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => !isColumnMutationLoading && setColumnToDelete(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-80"
            >
              <h3 className="text-base font-bold text-gray-900 mb-2">Eliminar columna</h3>
              <p className="text-sm text-gray-500 mb-4">
                ¿Eliminar <strong>{columnToDelete.label}</strong>? La tabla va a dejar de mostrarla y no vas a poder recuperarla desde acá.
              </p>
              {columnMutationError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">
                  {columnMutationError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setColumnToDelete(null)}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void confirmDeleteColumn()}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isColumnMutationLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {columnsToDeleteRight && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => !isColumnMutationLoading && setColumnsToDeleteRight(null)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-80"
            >
              <h3 className="text-base font-bold text-gray-900 mb-2">Eliminar columnas</h3>
              <p className="text-sm text-gray-500 mb-4">
                ¿Eliminar <strong>{columnsToDeleteRight.length} columna{columnsToDeleteRight.length !== 1 ? 's' : ''}</strong> a la derecha? Esta acción no se puede deshacer.
              </p>
              {columnMutationError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-4">
                  {columnMutationError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setColumnsToDeleteRight(null)}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void confirmDeleteColumnsRight()}
                  disabled={isColumnMutationLoading}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isColumnMutationLoading ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Item delete confirm ── */}
      <AnimatePresence>
        {itemToDelete && (
          <>
            <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setItemToDelete(null)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 z-50 w-80">
              <h3 className="text-base font-bold text-gray-900 mb-2">Eliminar {noun}</h3>
              <p className="text-sm text-gray-500 mb-5">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setItemToDelete(null)} className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button
                  onClick={async () => {
                    const id = itemToDelete;
                    setItemToDelete(null);
                    await onDelete(id);
                    setItems(prev => prev.filter(p => p.id !== id));
                    setTotal(prev => prev - 1);
                  }}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700">
                  Eliminar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Import modal ── */}
      {showImportModal && ImportModal && (
        <ImportModal onClose={() => { setShowImportModal(false); loadFirstPage(buildFilterParams()); }} />
      )}
      {showImportModal && !ImportModal && importConfig && (
        <GenericImportModal
          {...importConfig}
          onClose={() => { setShowImportModal(false); loadFirstPage(buildFilterParams()); }}
        />
      )}
    </div>
  );
}
