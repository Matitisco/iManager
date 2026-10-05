import type { ColType } from './types';

export interface CopiedRow {
  values: Record<string, unknown>;
  categoryId?: string | null;
}

export interface RowCopy {
  storageKey: string;
  tsv: string;
  rows: CopiedRow[];
}

export interface PasteColumn {
  field: string;
  type: ColType;
  names: string[];
  onDuplicateValue?: (value: unknown, index: number) => unknown;
}

interface CreatePayloadInput {
  columns: PasteColumn[];
  drafts: CopiedRow[];
  duplicate: boolean;
  fallbackCategoryId: string | null;
  buildNewItem?: (formData: Record<string, unknown>, categoryId: string | null) => Record<string, unknown>;
}

let memoryCopy: RowCopy | null = null;

export function clearRowClipboardMemory() {
  memoryCopy = null;
}

export function rememberRowCopy(copy: RowCopy) {
  memoryCopy = copy;
}

export function readMemoryCopy(storageKey: string) {
  if (!memoryCopy || memoryCopy.storageKey !== storageKey) return null;
  return memoryCopy;
}

export async function writeClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // The in-memory copy still lets this tab paste the rows.
  }
}

export function duplicateUniqueValue(value: unknown, index: number, maxLength: number) {
  const base = String(value ?? '').trim();
  if (!base) return base;
  const tail = `-${Date.now().toString(36).slice(-4)}${index + 1}`;
  return `${base.slice(0, Math.max(1, maxLength - tail.length))}${tail}`;
}

function escapeTsvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  if (/[\t\n\r"]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildTsv(headers: string[], rows: unknown[][]) {
  const header = headers.map(escapeTsvCell).join('\t');
  const body = rows.map((row) => row.map(escapeTsvCell).join('\t')).join('\n');
  return body ? `${header}\n${body}` : header;
}

function parseTsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === '\t') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function coerceNumber(raw: string) {
  const trimmed = raw.trim().replace(/[$\s]/g, '');
  if (!trimmed) return 0;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) return Number(trimmed.replace(/,/g, ''));
  if (/^-?\d+,\d+$/.test(trimmed)) return Number(trimmed.replace(',', '.'));
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseClipboardRows(text: string, columns: PasteColumn[]): CopiedRow[] {
  const grid = parseTsv(text);
  if (grid.length === 0 || columns.length === 0) return [];

  const namedColumns = columns.map((column) => ({
    ...column,
    keys: column.names.map(normalizeName).filter(Boolean),
  }));
  const header = grid[0].map(normalizeName);
  const headerMatches = header.filter((cell) => namedColumns.some((column) => column.keys.includes(cell))).length;
  const hasHeader = headerMatches >= Math.min(2, columns.length) || (columns.length === 1 && headerMatches === 1);
  const dataRows = hasHeader ? grid.slice(1) : grid;
  const headerIndex = new Map<string, number>();
  if (hasHeader) {
    header.forEach((cell, index) => {
      if (!headerIndex.has(cell)) headerIndex.set(cell, index);
    });
  }

  return dataRows.flatMap((cells) => {
    const values: Record<string, unknown> = {};
    namedColumns.forEach((column, index) => {
      let cellIndex: number | undefined;
      if (hasHeader) {
        cellIndex = column.keys.map((key) => headerIndex.get(key)).find((value) => value !== undefined);
      } else if (index < cells.length) {
        cellIndex = index;
      }
      if (cellIndex === undefined || cellIndex >= cells.length) return;
      const raw = cells[cellIndex] ?? '';
      values[column.field] = column.type === 'number' ? coerceNumber(raw) : raw;
    });
    return Object.keys(values).length > 0 ? [{ values }] : [];
  });
}

export function toCreatePayloads({
  columns,
  drafts,
  duplicate,
  fallbackCategoryId,
  buildNewItem,
}: CreatePayloadInput) {
  return drafts.map((draft, index) => {
    const mapped: Record<string, unknown> = {};
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(draft.values, column.field)) continue;
      const raw = draft.values[column.field];
      mapped[column.field] = duplicate && column.onDuplicateValue
        ? column.onDuplicateValue(raw, index)
        : raw;
    }
    const categoryId = draft.categoryId !== undefined ? draft.categoryId : fallbackCategoryId;
    return buildNewItem
      ? buildNewItem(mapped, categoryId)
      : { ...mapped, categoryId };
  });
}
