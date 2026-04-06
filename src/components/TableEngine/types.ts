import type { MouseEvent, PointerEvent, ReactNode } from 'react';

export type TableRowId = string;

/**
 * Base row shape required by the engine.
 */
export type TableData = {
  id: TableRowId;
};

export type TableColumnRendererKey =
  | 'text'
  | 'number'
  | 'enum'
  | 'currency'
  | 'date'
  | 'placeholder'
  | 'custom'
  | (string & {});

export type TableEditRendererKey =
  | 'text'
  | 'number'
  | 'enum'
  | 'currency'
  | 'custom'
  | (string & {});

export interface TableEnumOption {
  label: ReactNode;
  value: string;
  disabled?: boolean;
}

export interface TablePlaceholderConfig {
  /**
   * Fallback visual value when the accessor resolves to nullish/empty.
   * Inventory parity default is `---`.
   */
  value?: ReactNode;
  /**
   * Marks whether empty-string values should also trigger the placeholder.
   */
  treatEmptyStringAsMissing?: boolean;
}

export interface TableColumnCellContext<TData extends TableData, TValue = unknown> {
  column: ColumnDef<TData, TValue>;
  row: TData;
  value: TValue;
  rowIndex: number;
  isEditing: boolean;
  placeholder: ReactNode | null;
}

export interface TableColumnEditContext<TData extends TableData, TValue = unknown> {
  column: ColumnDef<TData, TValue>;
  row: TData;
  value: TValue;
  rowIndex: number;
  commit: (nextValue: unknown) => Promise<void> | void;
  cancel: () => void;
}

/**
 * Public column contract for the reusable engine.
 */
export interface ColumnDef<TData extends TableData, TValue = unknown> {
  /**
   * Stable column identifier used for sorting, persistence and customization.
   */
  id: string;
  /**
   * Header label or node.
   */
  header: ReactNode | string;
  /**
   * Access a value from the row. `accessorFn` takes precedence over `accessorKey`.
   */
  accessorKey?: keyof TData | string;
  accessorFn?: (row: TData) => TValue;
  /**
   * Semantic renderer identifiers so adapters/plugins can reason about capabilities.
   */
  rendererKey?: TableColumnRendererKey;
  editorKey?: TableEditRendererKey;
  /**
   * Legacy shorthand kept for backwards compatibility with the current engine.
   * Prefer `rendererKey`.
   */
  type?: 'text' | 'number' | 'enum' | 'currency' | 'date' | 'custom';
  /**
   * Enum support for domain-agnostic inline editing.
   */
  enumOptions?: TableEnumOption[];
  /**
   * Legacy enum support kept for backwards compatibility.
   */
  options?: string[];
  /**
   * Placeholder semantics for empty values.
   */
  placeholder?: TablePlaceholderConfig;
  /**
   * Custom cell rendering.
   */
  cell?: (context: TableColumnCellContext<TData, TValue>) => ReactNode;
  /**
   * Optional edit renderer override.
   */
  editCell?: (context: TableColumnEditContext<TData, TValue>) => ReactNode;
  /**
   * Sorting / editing / customization participation.
   */
  sortable?: boolean;
  editable?: boolean;
  enableColumnCustomization?: boolean;
  /**
   * Explicit column rename support. Defaults to true when column customization is enabled.
   */
  renameable?: boolean;
  /**
   * Explicit column resize support. Defaults to true when column customization is enabled.
   */
  resizable?: boolean;
  /**
   * Explicit column reorder support. Defaults to true when column customization is enabled.
   */
  draggable?: boolean;
  /**
   * Width preferences. `width` is legacy-compatible.
   */
  width?: string | number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Visibility defaults.
   */
  visible?: boolean;
  alwaysVisible?: boolean;
  /**
   * Optional class name for td/th usage.
   */
  className?: string;
}

export interface TableSortState {
  columnId: string | null;
  direction: 'asc' | 'desc' | null;
}

export interface TablePaginationState {
  pageIndex: number;
  pageSize: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

export interface TableSelectionState {
  selectedIds: TableRowId[];
  /**
   * When `allMatching` is true, `selectedIds` may represent the currently loaded slice
   * while `matchingIds` comes from the remote adapter (`fetchFilteredIds`).
   */
  allMatching?: boolean;
  matchingIds?: TableRowId[];
  anchorId?: TableRowId | null;
  scope?: 'page' | 'filtered' | 'all';
}

export interface TableInlineEditingState {
  rowId: TableRowId | null;
  columnId: string | null;
  draftValue?: unknown;
  isSaving?: boolean;
}

export interface TableColumnPreferenceState {
  order: string[];
  visibility: Record<string, boolean>;
  widths?: Record<string, number | string>;
  labels?: Record<string, string>;
}

export interface TableFilterState {
  values: Record<string, unknown>;
}

export interface TableSearchState {
  query: string;
}

export interface TableContextMenuState {
  rowId?: TableRowId;
  selectedIds?: TableRowId[];
  position?: {
    x: number;
    y: number;
  };
}

export interface TableControlledState {
  sorting?: TableSortState;
  pagination?: TablePaginationState;
  selection?: TableSelectionState;
  editing?: TableInlineEditingState;
  filters?: TableFilterState;
  search?: TableSearchState;
  columnPreferences?: TableColumnPreferenceState;
  contextMenu?: TableContextMenuState | null;
}

export interface TableStateChangeHandlers<TData extends TableData> {
  onSortingChange?: (next: TableSortState) => void;
  onPaginationChange?: (next: TablePaginationState) => void;
  onSelectionChange?: (next: TableSelectionState, meta?: { rows: TData[] }) => void;
  onEditingChange?: (next: TableInlineEditingState) => void;
  onFilterChange?: (next: TableFilterState) => void;
  onSearchChange?: (next: TableSearchState) => void;
  onColumnPreferencesChange?: (next: TableColumnPreferenceState) => void;
  onContextMenuChange?: (next: TableContextMenuState | null) => void;
}

export interface TableLocalDataAdapter<TData extends TableData> {
  mode: 'local';
  rows: TData[];
}

export interface TableRemotePageResult<TData extends TableData> {
  rows: TData[];
  totalItems?: number;
  totalPages?: number;
  hasNextPage?: boolean;
}

export interface TableRemoteQuery {
  sorting?: TableSortState;
  pagination?: TablePaginationState;
  filters?: TableFilterState;
  search?: TableSearchState;
}

export interface TableRemoteDataAdapter<TData extends TableData> {
  mode: 'remote';
  fetchPage: (query: TableRemoteQuery) => Promise<TableRemotePageResult<TData>>;
  fetchFilteredIds?: (query: TableRemoteQuery) => Promise<TableRowId[]>;
  persistColumnPreferences?: (
    next: TableColumnPreferenceState,
  ) => Promise<void> | void;
  exportRows?: (context: TableExportContext<TData>) => Promise<void> | void;
}

export type TableDataAdapter<TData extends TableData> =
  | TableLocalDataAdapter<TData>
  | TableRemoteDataAdapter<TData>;

export interface TableExportContext<TData extends TableData> {
  visibleColumns: Array<ColumnDef<TData>>;
  rows: TData[];
  selection: TableSelectionState;
  query?: TableRemoteQuery;
}

export interface TableRowAction<TData extends TableData> {
  id: string;
  label: ReactNode;
  run: (row: TData) => void | Promise<void>;
  disabled?: boolean | ((row: TData) => boolean);
}

export interface TableBulkAction<TData extends TableData> {
  id: string;
  label: ReactNode;
  run: (selection: TableSelectionState, rows: TData[]) => void | Promise<void>;
  disabled?: boolean | ((selection: TableSelectionState, rows: TData[]) => boolean);
}

export interface TablePluginContext<TData extends TableData> {
  columns: Array<ColumnDef<TData>>;
  state: TableControlledState;
  adapter?: TableDataAdapter<TData>;
}

export interface TablePlugin<TData extends TableData> {
  id: string;
  rowActions?: Array<TableRowAction<TData>>;
  bulkActions?: Array<TableBulkAction<TData>>;
  canRenderColumn?: (column: ColumnDef<TData>) => boolean;
  canEditColumn?: (column: ColumnDef<TData>) => boolean;
  getExternalDropTargetLabel?: (row: TData) => ReactNode | null;
  extendPromptContract?: (context: TablePluginContext<TData>) => string | null;
}

/**
 * Feature flags retained for backwards compatibility while the engine migrates
 * to the richer adapter/plugin contracts.
 */
export interface TableFeatures {
  sorting?: boolean;
  pagination?: boolean;
  rowSelection?: boolean;
  dragAndDrop?: boolean;
  contextMenu?: boolean;
  inlineEditing?: boolean;
  bulkActions?: boolean;
  columnCustomization?: boolean;
  keyboardNavigation?: boolean;
  rangeSelection?: boolean;
  remoteSelectAll?: boolean;
  placeholderAwareRendering?: boolean;
}

/**
 * Legacy callbacks API retained so current consumers compile while the new
 * `state` + adapter/plugin contracts get adopted.
 */
export interface TableCallbacks<TData extends TableData> {
  onRowEdit?: (row: TData, field: string, value: unknown) => Promise<void> | void;
  onSortChange?: (columnId: string, direction: 'asc' | 'desc' | null) => void;
  onBulkAction?: (actionId: string, selectedIds: string[]) => void;
  onPageChange?: (page: number, pageSize: number) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onContextMenu?: (event: MouseEvent, row: TData) => void;
  onRowDoubleClick?: (event: MouseEvent, row: TData) => void;
  onRowDragStart?: (event: PointerEvent, row: TData) => void;
}

/**
 * Main props interface for the TableEngine component.
 */
export interface TableEngineProps<TData extends TableData> {
  /**
   * Legacy direct data prop. New integrations should prefer `adapter`.
   */
  data: TData[];
  columns: Array<ColumnDef<TData>>;
  features?: TableFeatures;
  callbacks?: TableCallbacks<TData>;
  adapter?: TableDataAdapter<TData>;
  plugins?: Array<TablePlugin<TData>>;
  state?: TableControlledState;
  onStateChange?: TableStateChangeHandlers<TData>;
  viewId?: string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  appendRow?: ReactNode;
  /**
   * Legacy controlled selection.
   */
  selectedIds?: string[];
}
