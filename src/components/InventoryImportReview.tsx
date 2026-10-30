import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { ImportColumnPicker } from './ImportColumnPicker';
import { Field, Segs } from '../desk/ui';
import { ReplayValue } from '../desk/replay-privacy';
import { columnLetter, importColumns, assignImportColumn, reorderPreviewColumns, resizePreviewColumn } from '../lib/import-preview';
import { automaticFieldName, unassignedImportColumns, importColumnScope, type DiscardedImportColumns } from '../lib/import-custom-fields';
import { updatePlanMapping } from '../lib/import-mapping';
import type { CustomFieldDefinition, CustomFieldInput } from '../services/custom-fields-api';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { parseImportNumber } from '../lib/import-number';
import type { ImportFieldDef } from './ImportModal';

interface Props {
  active: ImportSheetPlan;
  sheets: ImportSheetPayload[];
  plan: ImportSheetPlan[];
  rows: Record<string, string>[];
  summary: ImportAnalysis['summary'];
  fields: ImportFieldDef[];
  definitions: CustomFieldDefinition[];
  drafts: CustomFieldInput[];
  currency: string;
  missing: string[];
  applying: boolean;
  disabled: boolean;
  focusedField: { key: string } | null;
  onSheet: (name: string) => void;
  onChange: (plan: ImportSheetPlan[], refresh: boolean) => void;
  onDraft: (definition: CustomFieldInput) => void;
  discardedColumns?: DiscardedImportColumns;
  onDiscardedColumns?: (value: DiscardedImportColumns) => void;
  newFieldReview?: { sheet: string; request: number } | null;
  discardNotice?: ReactNode;
  children?: ReactNode;
}

type PreviewColumn = { key: string; label: string; source: number; unused: boolean; pending: boolean; header: string };
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 76;
const POSSIBLE_TOTAL_NOTE = 'Parece una fila de total';
const isPossibleTotal = (row: Record<string, string>) => row.batteryNote?.split('\n').includes(POSSIBLE_TOTAL_NOTE);

function HeaderSettings({ active, rowCount, disabled, onChange }: {
  active: ImportSheetPlan;
  rowCount: number;
  disabled: boolean;
  onChange: (headerRow: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    options.current?.querySelector('button')?.focus();
    const dismiss = (event: Event) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismiss);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismiss);
    };
  }, [open]);
  return <div ref={container} className="imp-header-settings" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
    }
  }}>
    <button ref={trigger} type="button" className="wlink imp-header-trigger" aria-expanded={open} aria-controls="import-header-options" onClick={() => setOpen(value => !value)}>
      Encabezado: {active.headerRow === 0 ? 'sin encabezado' : `fila ${active.headerRow}`} · Cambiar
    </button>
    {open && <div ref={options} id="import-header-options" className="imp-header-popover" role="group" aria-label="Encabezado del archivo">
      <div className="sgs imp-header-mode">
        <button type="button" className={`sg${active.headerRow === 0 ? ' on' : ''}`} aria-pressed={active.headerRow === 0} disabled={disabled} onClick={() => onChange(0)}>Sin encabezado</button>
        <button type="button" className={`sg${active.headerRow > 0 ? ' on' : ''}`} aria-pressed={active.headerRow > 0} disabled={disabled} onClick={() => onChange(1)}>Fila 1 es encabezado</button>
      </div>
      {active.headerRow > 0 && <label className="imp-header-row"><span>Fila de encabezado</span><input aria-label="Fila de encabezado" type="number" min={1} max={rowCount} value={active.headerRow} disabled={disabled} onChange={event => {
        const headerRow = Number(event.target.value);
        if (headerRow >= 1 && headerRow <= rowCount) onChange(headerRow);
      }} /></label>}
    </div>}
  </div>;
}

export function InventoryImportReview({ active, sheets, plan, rows, summary, fields, definitions, drafts, currency, missing, applying, disabled, focusedField, onSheet, onChange, onDraft, discardedColumns = {}, onDiscardedColumns, newFieldReview, discardNotice, children }: Props) {
  const grid = sheets.find(sheet => sheet.name === active.name)?.rows ?? [];
  const mapping = importColumns(active, grid);
  const all = [...definitions, ...drafts];
  const catalog = fields.some(field => field.key === 'currency') ? fields : [...fields, { key: 'currency', label: 'Moneda', required: false }];
  const defaultCurrency = active.priceCurrency || currency;
  const [picker, setPicker] = useState<{ source: number; anchor: HTMLElement; search: string } | null>(null);
  const [highlightSource, setHighlightSource] = useState<number | null>(null);
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldInput['type']>('text');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const table = useRef<HTMLDivElement>(null);
  const cursors = useRef<{ pending: number | null; unassigned: number | null }>({ pending: null, unassigned: null });
  const gesture = useRef<{ key: string; kind: 'resize' | 'reorder'; x: number; width: number; target: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [gestureKey, setGestureKey] = useState<string | null>(null);
  const scope = importColumnScope(active);
  const [reviewingNewFields, setReviewingNewFields] = useState(false);
  const unassigned = new Set(unassignedImportColumns(active, grid, discardedColumns).map(column => column.columnIndex));
  const destinations: PreviewColumn[] = mapping.map(column => ({
    key: column.field === 'ignore' ? `unused:${column.columnIndex}` : column.field,
    label: catalog.find(field => field.key === column.field)?.label ?? all.find(field => `custom:${field.key}` === column.field)?.label ?? column.header,
    source: column.columnIndex, unused: column.field === 'ignore', pending: column.field !== 'ignore' && Boolean(column.review?.length), header: column.header,
  }));
  const visual = orders[scope] ?? [];
  const columns = [...destinations].sort((a, b) => {
    if (a.key === 'model') return -1;
    if (b.key === 'model') return 1;
    const rank = (column: PreviewColumn) => visual.includes(String(column.source)) ? visual.indexOf(String(column.source)) : visual.length + column.source;
    return rank(a) - rank(b);
  });
  const pending = columns.filter(column => column.pending);
  const order = columns.map(column => column.key);
  const widthFor = (key: string) => widths[`${scope}:${columns.find(column => column.key === key)?.source}`] ?? (key === 'model' ? 180 : unassigned.has(columns.find(column => column.key === key)?.source ?? -1) ? 260 : 160);
  const sheetRows = rows.filter(row => !row._sourceSheet || row._sourceSheet === active.name);
  const equipmentCount = rows.reduce((sum, row) => sum + Number(row.quantity || 1), 0);
  const possibleTotals = rows.filter(isPossibleTotal).length;
  const start = Math.min(Math.max(0, sheetRows.length - 1), Math.max(0, Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - 5));
  const end = Math.min(sheetRows.length, start + 24);
  const reveal = (source: number, open: boolean, search = '') => {
    if (disabled) return;
    setHighlightSource(source);
    const header = table.current?.querySelector<HTMLElement>(`th[data-column-index="${source}"]`);
    const scroller = table.current;
    if (!header || !scroller) return;
    // Only horizontal scrolling: preserve the equipment row currently being reviewed.
    const pinned = columns[0]?.key === 'model' ? widthFor('model') : 0;
    if (!header.classList.contains('imp-pinned') && (header.offsetLeft < scroller.scrollLeft + pinned || header.offsetLeft + header.offsetWidth > scroller.scrollLeft + scroller.clientWidth)) {
      scroller.scrollLeft = Math.max(0, header.offsetLeft - pinned);
    }
    const anchor = header.querySelector<HTMLButtonElement>('.imp-heading-label')!;
    anchor.focus({ preventScroll: true });
    if (open) { setCreating(null); setPicker({ source, anchor, search }); }
  };
  useEffect(() => { setPicker(null); setCreating(null); setHighlightSource(null); setReviewingNewFields(false); cursors.current = { pending: null, unassigned: null }; setScrollTop(0); if (table.current) table.current.scrollTop = 0; }, [scope]);
  useEffect(() => {
    if (!focusedField) return;
    const source = mapping.find(column => unassigned.has(column.columnIndex))?.columnIndex ?? mapping[0]?.columnIndex;
    if (source !== undefined) reveal(source, true, catalog.find(field => field.key === focusedField.key)?.label ?? '');
  }, [focusedField]);
  useEffect(() => { if (disabled) setPicker(null); }, [disabled]);
  const revealNext = (kind: 'pending' | 'unassigned') => {
    const indexes = columns.filter(column => kind === 'pending' ? column.pending : unassigned.has(column.source)).map(column => column.source);
    const current = indexes.indexOf(cursors.current[kind] ?? -1);
    if (!indexes.length) return;
    const source = indexes[(current + 1) % indexes.length];
    cursors.current[kind] = source;
    reveal(source, false);
  };
  useEffect(() => {
    if (newFieldReview?.sheet !== active.name) return;
    setReviewingNewFields(true);
    revealNext('unassigned');
  }, [newFieldReview]);
  const closePicker = () => { setPicker(null); setCreating(null); };
  const assign = (index: number, field: string) => {
    onDiscardedColumns?.({ ...discardedColumns, [scope]: field === 'ignore'
      ? [...new Set([...(discardedColumns[scope] ?? []), index])]
      : (discardedColumns[scope] ?? []).filter(column => column !== index) });
    const next = assignImportColumn(active, grid, index, field);
    const required = fields.filter(item => item.required).map(item => item.key);
    onChange(plan.map(sheet => sheet.name === active.name ? updatePlanMapping(active, next.mapping, required) : sheet), false);
    setHighlightSource(index);
    closePicker();
  };
  const create = () => {
    const label = name.trim();
    if (!label) { setError('Ingresá un nombre'); return; }
    if ([...all, ...catalog].some(field => field.label.toLocaleLowerCase('es') === label.toLocaleLowerCase('es'))) { setError('Ya existe un campo con ese nombre'); return; }
    const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 45) || 'campo';
    const key = `cf_${base}_${crypto.randomUUID().slice(0, 8)}`;
    onDraft({ entity: 'inventory', key, label, type, order: all.length });
    assign(creating!, `custom:${key}`);
    setCreating(null);
  };
  const reorder = (key: string, target: number) => {
    const pinned = columns.find(column => column.key === 'model');
    const keys = columns.map(column => column === pinned ? 'model' : String(column.source));
    const source = columns.find(column => column.key === key);
    if (!source) return;
    setOrders(current => ({ ...current, [scope]: reorderPreviewColumns(keys, key === 'model' ? key : String(source.source), target).map(id => id === 'model' ? String(pinned!.source) : id) }));
  };
  const begin = (event: PointerEvent<HTMLElement>, key: string, kind: 'resize' | 'reorder') => {
    if (disabled || event.button > 0 || (kind === 'reorder' && key === 'model')) return;
    suppressClick.current = false;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    gesture.current = { key, kind, x: event.clientX, width: widthFor(key), target: order.indexOf(key), moved: false };
    if (kind === 'resize') setGestureKey(key);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    event.stopPropagation();
    const delta = event.clientX - drag.x;
    drag.moved ||= Math.abs(delta) > 4;
    if (drag.kind === 'reorder' && !drag.moved) return;
    setGestureKey(drag.key);
    if (drag.kind === 'resize') setWidths(current => ({ ...current, [`${scope}:${columns.find(column => column.key === drag.key)?.source}`]: resizePreviewColumn(drag.width, delta) }));
    else {
      const scroller = table.current;
      if (!scroller) return;
      const bounds = scroller.getBoundingClientRect();
      if (event.clientX > bounds.right - 40) scroller.scrollLeft += 18;
      if (event.clientX < bounds.left + widthFor('model') + 20) scroller.scrollLeft -= 18;
      const x = event.clientX - bounds.left + scroller.scrollLeft;
      const headers = [...scroller.querySelectorAll<HTMLElement>('th')];
      drag.target = headers.findIndex(header => x < header.offsetLeft + header.offsetWidth);
      // jsdom has no layout; the browser uses the actual widths, including table expansion.
      if (!headers.some(header => header.offsetWidth)) {
        let edge = 0;
        drag.target = order.findIndex(key => { edge += widthFor(key); return x < edge; });
      }
      if (drag.target < 0) drag.target = columns.length - 1;
    }
  };
  const finish = (event: PointerEvent<HTMLElement>) => {
    const drag = gesture.current;
    if (!drag) return;
    event.stopPropagation();
    suppressClick.current = Boolean(drag && (drag.moved || drag.kind === 'resize'));
    if (drag?.kind === 'reorder' && drag.moved) reorder(drag.key, drag.target);
    gesture.current = null; setGestureKey(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cellValue = (row: Record<string, string>, index: number, column: PreviewColumn) => {
    if (column.unused) return grid[(Number(row._sourceRow) || active.dataStartRow + index) - 1]?.[column.source!] || '—';
    if (column.key === 'currency') return row.currency || defaultCurrency;
    if (column.key === 'quantity') return row.quantity || '1';
    if (column.key === 'price') {
      if (!row.price?.trim()) return 'A definir';
      const amount = parseImportNumber(row.price);
      return amount === undefined ? row.price : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount);
    }
    return row[column.key]?.trim() || '—';
  };

  return <div className="imp-review" data-testid="import-summary">
    <div className="imp-review-summary">
      <div className="imp-review-notices">{discardNotice}</div>
      <div className="imp-review-chips">
        {possibleTotals > 0 && <span className="imp-total-count" role="status">{possibleTotals} {possibleTotals === 1 ? 'equipo por revisar' : 'equipos por revisar'}</span>}
        {pending.length > 0 && <button type="button" className="dsel imp-pending-chip on" disabled={disabled} onClick={() => revealNext('pending')}>
          <span className="imp-state-dot" />{pending.length} por revisar<ChevronRight size={16} aria-hidden="true" />
        </button>}
      </div>
    </div>
    {sheets.length > 1 && <div className="imp-sources" role="group" aria-label="Hojas a importar">
      {plan.map(sheet => {
        const info = summary.sheets.find(item => item.name === sheet.name);
        return <div key={sheet.name} className="imp-source-row" data-testid="import-sheet-summary">
          <input type="checkbox" data-testid={`import-sheet-${sheet.name}`} aria-label={`Incluir hoja ${sheet.name}`} checked={sheet.include} disabled={disabled}
            onChange={() => onChange(plan.map(item => item.name === sheet.name ? { ...item, include: !item.include } : item), false)} />
          <button type="button" onClick={() => onSheet(sheet.name)} aria-pressed={active.name === sheet.name}><ReplayValue>{sheet.name}</ReplayValue></button>
          <span>· {info?.rows ?? 0} {info?.rows === 1 ? 'equipo' : 'equipos'}{info?.condition === 'USADO' ? ' usados' : info?.condition === 'NUEVO' ? ' nuevos' : ''}</span>
        </div>;
      })}
    </div>}
    {missing.length > 0 && <div className="imp-review-error" role="alert" id="import-missing-model"><b>Falta {missing.join(', ')}. Asigná los campos obligatorios para importar.</b></div>}
    {!plan.some(sheet => sheet.include) && <div className="imp-review-error" role="status">Incluí al menos una hoja para importar.</div>}
    <div className="imp-review-layout">
      <div className="imp-table-area">
        <div className="imp-table-title"><h4>Equipos a importar <span data-testid="import-preview-count">{new Intl.NumberFormat('es-AR').format(equipmentCount)} {equipmentCount === 1 ? 'equipo' : 'equipos'}</span></h4><HeaderSettings key={active.name} active={active} rowCount={grid.length} disabled={disabled}
          onChange={headerRow => onChange(plan.map(item => item.name === active.name ? { ...item, headerRow, dataStartRow: headerRow + 1 } : item), true)} /></div>
        <div ref={table} className="imp-table-scroll" data-testid="import-preview" role="region" tabIndex={0} aria-label="Equipos a importar" aria-busy={applying} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
          <table className="dtable compact imp-preview-table" aria-label="Vista previa de equipos" aria-rowcount={sheetRows.length + 1} style={{ width: columns.reduce((total, column) => total + widthFor(column.key), 0) }}>
            <colgroup>{columns.map(column => <col key={column.source} style={{ width: widthFor(column.key) }} />)}</colgroup>
            <thead><tr>{columns.map(column => <th key={column.source} data-column-index={column.source} data-preview-key={column.key} scope="col"
              onPointerDown={event => { if (event.pointerType === 'touch') suppressClick.current = false; else begin(event, column.key, 'reorder'); }}
              onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } reveal(column.source, true); }} className={`${column.key === 'model' ? 'imp-pinned ' : ''}${column.unused ? `imp-unused ${unassigned.has(column.source!) ? `imp-unassigned ${reviewingNewFields ? 'imp-new-field-review ' : ''}` : ''}` : ''}${highlightSource === column.source ? 'imp-selected ' : ''}${column.pending ? 'imp-pending ' : ''}${gestureKey === column.key ? 'imp-dragging' : ''}`}>
              <div className="imp-column-heading">
                <button type="button" className="imp-grip" title="Arrastrar para reordenar" aria-label={`Arrastrar para reordenar · ${column.label}${column.unused ? ` · Excel ${columnLetter(column.source!)}` : ''}`}  aria-disabled={column.key === 'model' || undefined}
                  onPointerDown={event => { begin(event, column.key, 'reorder'); }} onPointerMove={move} onPointerUp={finish} onClick={event => event.stopPropagation()} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
                  onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); reorder(column.key, order.indexOf(column.key) + (event.key === 'ArrowLeft' ? -1 : 1)); } }}><GripVertical size={18} aria-hidden="true" /></button>
                <div className="imp-heading-content"><button type="button" className="imp-heading-label" data-testid={`import-column-${column.source}`} aria-label={`Importar ${column.header} como`} aria-haspopup="dialog" aria-description={`${column.unused ? unassigned.has(column.source) ? `Campo nuevo: ${automaticFieldName(active, grid, column.source)}` : 'Descartada' : column.label}${column.pending ? ' · Por revisar' : ''}`} aria-expanded={picker?.source === column.source} disabled={disabled}>
                  <b>{unassigned.has(column.source) ? <><span className="imp-new-field-plus"><Plus size={12} aria-hidden="true" /></span><span className="imp-new-field-label">Campo nuevo: <ReplayValue>{automaticFieldName(active, grid, column.source)}</ReplayValue></span></> : <>{column.pending && <span className="imp-state-dot" />}<ReplayValue>{column.unused ? 'Descartada' : column.label}</ReplayValue></>}</b><ChevronDown size={14} aria-hidden="true" />
                </button><small title={column.pending ? mapping.find(item => item.columnIndex === column.source)?.review?.join(' ') : column.header}><ReplayValue>{column.pending ? `${columnLetter(column.source)} · ${column.header}` : `Excel · ${columnLetter(column.source)}`}</ReplayValue></small></div>

              </div>
              <span className="imp-resize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={column.unused ? `Ancho de columna sin usar ${columnLetter(column.source!)}: ${column.label}` : `Ancho de ${column.label}`} aria-valuemin={100} aria-valuemax={480} aria-valuenow={widthFor(column.key)}
                onClick={event => event.stopPropagation()} onPointerDown={event => begin(event, column.key, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
                onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setWidths(current => ({ ...current, [`${scope}:${column.source}`]: resizePreviewColumn(widthFor(column.key), event.key === 'ArrowLeft' ? -20 : 20) })); } }} />
            </th>)}</tr></thead>
            <tbody>
              {start > 0 && <tr aria-hidden="true"><td colSpan={columns.length} style={{ height: start * ROW_HEIGHT, padding: 0 }} /></tr>}
              {sheetRows.slice(start, end).map((row, index) => <tr key={start + index} data-testid="import-preview-row" data-index={start + index} aria-rowindex={start + index + 2} className={isPossibleTotal(row) ? 'imp-total-row' : undefined}>
                {columns.map(column => <td key={column.source} className={`${column.key === 'model' ? 'imp-pinned ' : ''}${column.unused ? `imp-unused ${unassigned.has(column.source!) ? `imp-unassigned ${reviewingNewFields ? 'imp-new-field-review ' : ''}` : ''}` : ''}${highlightSource === column.source ? 'imp-selected ' : ''}${column.pending ? 'imp-pending' : ''}`} onClick={() => reveal(column.source, true)}><ReplayValue>{cellValue(row, start + index, column)}</ReplayValue>{column.key === 'model' && isPossibleTotal(row) && <small className="imp-total-note" title={POSSIBLE_TOTAL_NOTE}>Por revisar · {POSSIBLE_TOTAL_NOTE}</small>}</td>)}
              </tr>)}
              {end < sheetRows.length && <tr aria-hidden="true"><td colSpan={columns.length} style={{ height: (sheetRows.length - end) * ROW_HEIGHT, padding: 0 }} /></tr>}
            </tbody>
          </table>
        </div>
        {sheetRows.length === 0 && <div className="wempty">No hay equipos para importar en esta hoja.</div>}
        <div className="imp-table-notices">{children}</div>
      </div>
    </div>
    {picker && <ImportColumnPicker key={`${scope}:${picker.source}`} anchor={picker.anchor} title={`Importar ${columnLetter(picker.source)} · ${mapping[picker.source]?.header} como`} value={mapping[picker.source]?.field ?? 'ignore'} initialSearch={picker.search}
      options={[...catalog.map(field => ({ value: field.key, label: field.label })), ...all.map(field => ({ value: `custom:${field.key}`, label: `${field.label} · ${field.type === 'date' ? 'Fecha' : field.type === 'number' ? 'Número' : 'Texto'}` }))].map(field => ({ ...field, letter: mapping.some(column => column.field === field.value) ? columnLetter(mapping.find(column => column.field === field.value)!.columnIndex) : undefined }))}
      onClose={closePicker} onChoose={value => {
        if (value === '__new') { setCreating(picker.source); setName(''); setType('text'); setError(''); }
        else assign(picker.source, value);
      }}>
      {creating !== null && <div className="imp-new-inline" role="group" aria-label="Nuevo campo">
        <Field label="Nombre" error={error}><input autoFocus aria-label="Nombre del nuevo campo" maxLength={100} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></Field>
        <Segs options={[{ id: 'text', label: 'Texto' }, { id: 'date', label: 'Fecha' }, { id: 'number', label: 'Número' }]} value={type} onChange={value => setType(value as CustomFieldInput['type'])} />
        <div className="sacts"><button type="button" className="btn2 s" onClick={() => setCreating(null)}>Cancelar</button><button type="button" className="btn2 p" onClick={create}>Crear campo</button></div>
      </div>}
    </ImportColumnPicker>}
  </div>;
}
