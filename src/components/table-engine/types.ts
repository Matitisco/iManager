import React from 'react';

/** Base constraint — every row must have an id */
export type WithId = { id: string };

// ─── Column definition ────────────────────────────────────────────────────────

export type ColType = 'text' | 'number' | 'enum' | 'badge' | 'custom';

export interface BadgeMeta {
  bg: string;
  text: string;
  dot: string;
  label: string;
}

export interface ColDef<TRow extends WithId> {
  /** Unique column id */
  id: string;
  /** Default header label */
  label: string;
  /** Mapped field on the row object */
  field: keyof TRow & string;
  /** Default pixel width */
  defaultWidth: number;
  /** Col type — drives inline edit and cell rendering */
  type: ColType;
  /** Always shown regardless of toggle */
  alwaysVisible?: boolean;
  /** Whether double-click activates inline edit */
  editable?: boolean;
  /** Enum options for type='enum' or type='badge' */
  enumOptions?: string[];
  /** Badge display metadata keyed by enum value (for type='badge') */
  badgeMeta?: Record<string, BadgeMeta>;
  /** Extra td className */
  tdClassName?: string;
  /** Custom cell renderer (for type='custom') */
  renderCell?: (value: any, row: TRow, helpers: CellHelpers<TRow>) => React.ReactNode;
  /** Optional formatter for display value */
  formatDisplay?: (value: any) => string | null | undefined;
  /** Sort field key sent to backend (defaults to col.id) */
  sortField?: string;
  /** Optional row accessor for nested or computed values */
  getValue?: (row: TRow) => any;
  /** Optional row updater for nested or computed values */
  setValue?: (row: TRow, value: unknown) => TRow;
}

export interface CellHelpers<TRow extends WithId> {
  startEdit: (id: string, field: string, value: string) => void;
  isEditing: (id: string, field: string) => boolean;
  inlineValue: string;
  setInlineValue: (v: string) => void;
  commitEdit: (row: TRow) => void;
  cancelEdit: () => void;
  cellDisplay: (row: TRow, field: string, fallback: any) => any;
  focusedCell: { rowIndex: number; colKey: string } | null;
  rowIndex: number;
  onBlur: (row: TRow) => void;
  onKeyDown: (e: React.KeyboardEvent, row: TRow) => void;
}

// ─── Filter definition ────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Parameter key sent to fetchPage */
  param: string;
  options: FilterOption[];
  /** Default "all" value (e.g. 'Todos', 'Todas') */
  defaultValue: string;
}

// ─── Sort options ─────────────────────────────────────────────────────────────

export interface SortOption {
  key: string;
  label: string;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface TableCategory {
  id: string;
  name: string;
}

// ─── Fetch params ─────────────────────────────────────────────────────────────

export interface TablePageParams {
  skip: number;
  take: number;
  categoryId?: string | null;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
  filters: Record<string, string>;
}

export type TableFilterParams = Omit<TablePageParams, 'skip' | 'take' | 'sortKey' | 'sortDir'>;

// ─── Add-row field config ─────────────────────────────────────────────────────

export interface AddRowField {
  colId: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'select';
  selectOptions?: { value: string; label: string }[];
  required?: boolean;
}

// ─── Edit panel field config ──────────────────────────────────────────────────

export interface EditPanelField<TRow extends WithId> {
  label: string;
  field: keyof TRow & string;
  type: 'text' | 'number' | 'select' | 'textarea';
  options?: { value: string; label: string }[];
  span?: 1 | 2;
  mono?: boolean;
}

// ─── Import config ───────────────────────────────────────────────────────────

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface GenericImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string; [key: string]: any }[];
}

export interface TableImportConfig {
  fields: ImportFieldDef[];
  onImport: (rows: Record<string, string>[]) => Promise<GenericImportResult>;
  title?: string;
  /** Optional: allow unmapped file columns to become extra/custom columns */
  extraColumns?: {
    existing: { id: string; label: string }[];
    onCreate: (label: string, type: 'text' | 'number') => Promise<string | null>;
  };
  /** Normalized header → field key aliases for auto-mapping */
  mapHints?: Record<string, string>;
}

export interface CreateColumnInput {
  label: string;
  type: 'text' | 'number';
}

export interface CustomColumnActions {
  onCreate: (input: CreateColumnInput) => Promise<unknown>;
  onDelete?: (colId: string) => Promise<void>;
  canDelete?: (colId: string) => boolean;
}

export interface DynamicColumnDefinition {
  id: string;
  label: string;
  type: 'text' | 'number' | 'enum';
  options?: string[];
}

export interface DynamicColumnsConfig<TRow extends WithId> {
  columns: DynamicColumnDefinition[];
  getValue: (row: TRow, columnId: string) => unknown;
  setValue: (row: TRow, columnId: string, value: unknown) => TRow;
  defaultWidth?: number;
}

// ─── Main engine config ───────────────────────────────────────────────────────

export interface TableEngineConfig<TRow extends WithId> {
  /** Page title */
  title: string;
  /** Prefix for localStorage keys (column widths, order, visibility) */
  storageKey: string;
  /** Sheet name for XLSX export */
  exportSheetName: string;

  // Columns
  columns: ColDef<TRow>[];

  // Filters shown in the filter panel
  filters: FilterDef[];

  // Sort options
  sortOptions: SortOption[];

  // Categories (optional feature)
  categories?: TableCategory[];
  onCreateCategory?: (name: string) => Promise<TableCategory>;
  onRenameCategory?: (id: string, name: string) => Promise<void>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onReorderCategories?: (ids: string[]) => Promise<void>;
  onBulkMoveCategory?: (ids: string[], categoryId: string | null) => Promise<void>;

  // Data fetching
  fetchPage: (params: TablePageParams) => Promise<{ items: TRow[]; total: number }>;
  fetchFilteredIds?: (params: TableFilterParams) => Promise<string[]>;

  // CRUD
  onCreate?: (data: Record<string, any>) => Promise<any>;
  onUpdate: (item: TRow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;

  // Bulk delete (optional override)
  onBulkDelete?: (ids: string[]) => Promise<void>;

  // Add-row inline form
  addRowFields?: AddRowField[];
  /** Called to build the full item from addRow form data before calling onCreate */
  buildNewItem?: (formData: Record<string, any>, categoryId: string | null) => Record<string, any>;

  // Edit slide-over panel
  editPanelFields?: EditPanelField<TRow>[];
  editPanelTitle?: string;

  // Import (optional) — pass either a custom ImportModal component or a declarative importConfig
  ImportModal?: React.ComponentType<{ onClose: () => void }>;
  importConfig?: TableImportConfig;
  showImport?: boolean;

  // Dynamic/custom columns (optional)
  customColumnActions?: CustomColumnActions;
  dynamicColumns?: DynamicColumnsConfig<TRow>;

  // Noun for UI labels e.g. "equipo", "cliente", "producto"
  noun?: string;
  nounPlural?: string;
}
