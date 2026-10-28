import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { GripVertical, Plus } from 'lucide-react';
import { DeskSelect } from '../desk/select';
import { Field, Segs } from '../desk/ui';
import { ReplayValue } from '../desk/replay-privacy';
import { columnLetter, importColumns, assignImportColumn, reorderPreviewColumns, resizePreviewColumn } from '../lib/import-preview';
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
  children?: ReactNode;
}

type PreviewColumn = { key: string; label: string; source?: number; unused?: boolean };
const FIRST_FIELDS = ['model', 'capacity', 'color', 'batteryHealth', 'imei', 'cost', 'price'];
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 64;

export function InventoryImportReview({ active, sheets, plan, rows, summary, fields, definitions, drafts, currency, missing, applying, disabled, focusedField, onSheet, onChange, onDraft, children }: Props) {
  const grid = sheets.find(sheet => sheet.name === active.name)?.rows ?? [];
  const mapping = importColumns(active, grid);
  const all = [...definitions, ...drafts];
  const catalog = fields.some(field => field.key === 'currency') ? fields : [...fields, { key: 'currency', label: 'Moneda', required: false }];
  const defaultCurrency = active.priceCurrency || currency;
  const missingModel = !mapping.some(column => column.field === 'model');
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [highlightSource, setHighlightSource] = useState<number | null>(null);
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldInput['type']>('text');
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Record<string, string[]>>({});
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [scrollTop, setScrollTop] = useState(0);
  const table = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelToggle = useRef<HTMLButtonElement>(null);
  const suggestions = useRef(new Map<string, string>());
  const gesture = useRef<{ key: string; kind: 'resize' | 'reorder'; x: number; width: number; target: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [gestureKey, setGestureKey] = useState<string | null>(null);
  const scope = `${active.name}:${active.headerRow}`;
  const [discardedColumns, setDiscardedColumns] = useState<Record<string, number[]>>({});
  const unassigned = new Set(mapping.filter(column => column.field === 'ignore' && !discardedColumns[scope]?.includes(column.columnIndex)).map(column => column.columnIndex));
  const pending = mapping.filter(column => unassigned.has(column.columnIndex));
  const pendingLabel = pending.length ? `${pending.length} por revisar` : 'Todo asignado';
  for (const column of mapping) {
    const id = `${scope}:${column.columnIndex}`;
    if (!suggestions.current.has(id)) suggestions.current.set(id, column.field);
  }

  const destinations: PreviewColumn[] = [
    ...catalog.map(field => ({ key: field.key, label: field.label, source: mapping.find(column => column.field === field.key)?.columnIndex })),
    ...all.filter(field => plan.some(sheet => sheet.mapping.some(column => column.field === `custom:${field.key}`)))
      .map(field => ({ key: `custom:${field.key}`, label: field.label, source: mapping.find(column => column.field === `custom:${field.key}`)?.columnIndex })),
  ].sort((a, b) => {
    const rank = (column: PreviewColumn) => FIRST_FIELDS.includes(column.key) ? FIRST_FIELDS.indexOf(column.key)
      : column.source !== undefined ? FIRST_FIELDS.length : FIRST_FIELDS.length + 1;
    return rank(a) - rank(b) || (a.source ?? Infinity) - (b.source ?? Infinity);
  });
  const visual = orders[scope] ?? [];
  const ordered = [...destinations].sort((a, b) => {
    if (a.key === 'model') return -1;
    if (b.key === 'model') return 1;
    const rank = (key: string) => visual.includes(key) ? visual.indexOf(key) : visual.length + destinations.findIndex(column => column.key === key);
    return rank(a.key) - rank(b.key);
  });
  const columns: PreviewColumn[] = [...ordered, ...mapping.filter(column => column.field === 'ignore')
    .map(column => ({ key: `unused:${column.columnIndex}`, label: column.header, source: column.columnIndex, unused: true }))];
  const order = columns.map(column => column.key);
  const widthFor = (key: string) => widths[`${scope}:${key}`] ?? (key === 'model' ? 180 : 140);
  const sheetRows = rows.filter(row => !row._sourceSheet || row._sourceSheet === active.name);
  const start = Math.min(Math.max(0, sheetRows.length - 1), Math.max(0, Math.floor((scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - 5));
  const end = Math.min(sheetRows.length, start + 24);
  const examples = grid.slice(Math.max(active.headerRow, active.dataStartRow - 1), active.dataEndRow).slice(0, 2);

  const selectColumn = (key: string, fromTable: boolean) => {
    setHighlight(key);
    const column = columns.find(item => item.key === key);
    if (fromTable) {
      setPanelOpen(true);
      const suggestion = mapping.find(item => item.field === 'ignore' && item.header.toLocaleLowerCase('es').includes(column?.label.toLocaleLowerCase('es') || key));
      const source = column?.source ?? suggestion?.columnIndex ?? pending[0]?.columnIndex ?? mapping[0]?.columnIndex;
      setHighlightSource(source ?? null);
      requestAnimationFrame(() => {
        const row = panel.current?.querySelector<HTMLElement>(`[data-column-index="${source}"]`);
        row?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        row?.focus({ preventScroll: true });
      });
    } else {
      setHighlightSource(column?.source ?? null);
      const header = [...(table.current?.querySelectorAll<HTMLElement>('th') ?? [])].find(item => item.dataset.previewKey === key);
      // Scroll only horizontally: keep the user's current equipment row in view.
      if (header && table.current && key !== 'model') {
        const pinned = widthFor('model');
        const left = header.offsetLeft;
        if (left < table.current.scrollLeft + pinned || left + header.offsetWidth > table.current.scrollLeft + table.current.clientWidth) {
          table.current.scrollLeft = Math.max(0, left - pinned);
        }
      }
    }
  };

  useEffect(() => { setCreating(null); setHighlight(null); setHighlightSource(null); setScrollTop(0); if (table.current) table.current.scrollTop = 0; }, [scope]);
  useEffect(() => {
    if (!focusedField) return;
    const column = columns.find(item => item.key === focusedField.key);
    if (column) selectColumn(column.key, true);
  }, [focusedField]);
  // Inline editors and the mobile panel consume Escape before the parent Sheet.
  const closeInternal = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (creating !== null) {
      event.preventDefault(); event.stopPropagation();
      const index = creating;
      setCreating(null);
      panel.current?.querySelector<HTMLElement>(`[data-column-index="${index}"] [role="combobox"]`)?.focus();
    } else if (panelOpen && window.matchMedia('(max-width: 699px)').matches) {
      event.preventDefault(); event.stopPropagation(); setPanelOpen(false); panelToggle.current?.focus();
    }
  };

  const assign = (index: number, field: string) => {
    setDiscardedColumns(current => ({ ...current, [scope]: field === 'ignore'
      ? [...new Set([...(current[scope] ?? []), index])]
      : (current[scope] ?? []).filter(column => column !== index) }));
    const next = assignImportColumn(active, grid, index, field);
    const required = fields.filter(item => item.required).map(item => item.key);
    onChange(plan.map(sheet => sheet.name === active.name ? updatePlanMapping(active, next.mapping, required) : sheet), false);
    setHighlightSource(index);
    setHighlight(field === 'ignore' ? `unused:${index}` : field);
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
    // Unused sources remain at the end; destinations can move freely after Modelo.
    const keys = ordered.map(column => column.key);
    setOrders(current => ({ ...current, [scope]: reorderPreviewColumns(keys, key, Math.min(keys.length - 1, target)) }));
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
    if (drag.kind === 'resize') setWidths(current => ({ ...current, [`${scope}:${drag.key}`]: resizePreviewColumn(drag.width, delta) }));
    else {
      const scroller = table.current;
      if (!scroller) return;
      const bounds = scroller.getBoundingClientRect();
      if (event.clientX > bounds.right - 40) scroller.scrollLeft += 18;
      if (event.clientX < bounds.left + widthFor('model') + 20) scroller.scrollLeft -= 18;
      const x = event.clientX - bounds.left + scroller.scrollLeft;
      let edge = 0;
      drag.target = order.findIndex(key => { edge += widthFor(key); return x < edge; });
      if (drag.target < 0) drag.target = ordered.length - 1;
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
    if (column.key === 'price') {
      if (!row.price?.trim()) return 'A definir';
      const amount = parseImportNumber(row.price);
      return amount === undefined ? row.price : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount);
    }
    return row[column.key]?.trim() || '—';
  };

  return <div className="imp-review" data-testid="import-summary" onKeyDown={closeInternal}>
    <h4 className="imp-detected">Detectamos {sheets.length} {sheets.length === 1 ? 'hoja' : 'hojas'}, {new Intl.NumberFormat('es-AR').format(summary.rowCount)} {summary.rowCount === 1 ? 'equipo' : 'equipos'}</h4>
    <div className="imp-sources">
      {plan.length > 1 && <DeskSelect label="Hoja a revisar" value={active.name} onChange={onSheet} options={plan.map(sheet => ({ value: sheet.name, label: sheet.name }))} />}
      {plan.map(sheet => {
        const info = summary.sheets.find(item => item.name === sheet.name);
        return <label key={sheet.name} className="imp-source-row" data-testid="import-sheet-summary">
          <input type="checkbox" data-testid={`import-sheet-${sheet.name}`} aria-label={`Incluir hoja ${sheet.name}`} checked={sheet.include} disabled={disabled}
            onChange={() => onChange(plan.map(item => item.name === sheet.name ? { ...item, include: !item.include } : item), false)} />
          <button type="button" onClick={() => onSheet(sheet.name)} aria-pressed={active.name === sheet.name}><ReplayValue>{sheet.name}</ReplayValue></button>
          <span>{info?.rows ?? 0} {info?.rows === 1 ? 'equipo' : 'equipos'}{info?.condition === 'USADO' ? ' usados' : info?.condition === 'NUEVO' ? ' nuevos' : ''}</span>
        </label>;
      })}
    </div>
    <details className="imp-header-settings" key={scope}>
      <summary>Encabezado · {active.headerRow === 0 ? 'Sin encabezado' : `Fila ${active.headerRow}`}</summary>
      <div className="imp-header-mode" role="group" aria-label="Encabezado del archivo">
        <button type="button" aria-pressed={active.headerRow === 0} disabled={disabled} onClick={() => onChange(plan.map(item => item.name === active.name ? { ...item, headerRow: 0, dataStartRow: 1 } : item), true)}>Sin encabezado</button>
        <button type="button" aria-pressed={active.headerRow > 0} disabled={disabled} onClick={() => onChange(plan.map(item => item.name === active.name ? { ...item, headerRow: 1, dataStartRow: 2 } : item), true)}>Fila 1 es encabezado</button>
        {active.headerRow > 0 && <label className="imp-header-row"><span>Fila de encabezado</span><input aria-label="Fila de encabezado" type="number" min={1} max={grid.length} value={active.headerRow} disabled={disabled} onChange={event => {
          const headerRow = Number(event.target.value);
          if (headerRow >= 1 && headerRow <= grid.length) onChange(plan.map(item => item.name === active.name ? { ...item, headerRow, dataStartRow: headerRow + 1 } : item), true);
        }} /></label>}
      </div>
    </details>
    {missing.length > 0 && <div className="import-guidance missing" role="alert" id="import-missing-model"><b>Falta {missing.join(', ')}. Asigná los campos obligatorios para importar.</b></div>}
    {!plan.some(sheet => sheet.include) && <div className="import-guidance" role="status">Incluí al menos una hoja para importar.</div>}
    <div className="imp-review-layout">
      <div className="imp-table-area">
        <button ref={panelToggle} type="button" className="btn2 s imp-panel-toggle" aria-expanded={panelOpen} aria-controls="import-column-panel" onClick={() => setPanelOpen(value => !value)}>Columnas ({pendingLabel}){missingModel ? ' · Falta Modelo' : ''}</button>
        <div className="imp-table-title"><h4>Equipos a importar</h4><span data-testid="import-preview-count">{new Intl.NumberFormat('es-AR').format(rows.length)} {rows.length === 1 ? 'equipo' : 'equipos'}</span></div>
        <div ref={table} className="imp-table-scroll" data-testid="import-preview" role="region" tabIndex={0} aria-label="Equipos a importar" aria-busy={applying} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
          <table className="dtable compact imp-preview-table" aria-label="Vista previa de equipos" aria-rowcount={sheetRows.length + 1} style={{ width: columns.reduce((total, column) => total + widthFor(column.key), 0) }}>
            <colgroup>{columns.map(column => <col key={column.key} style={{ width: widthFor(column.key) }} />)}</colgroup>
            <thead><tr>{columns.map(column => <th key={column.key} data-preview-key={column.key} scope="col"
              onPointerDown={event => { if (event.pointerType !== 'touch' && !column.unused) begin(event, column.key, 'reorder'); }}
              onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
              onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } selectColumn(column.key, true); }} className={`${column.key === 'model' ? 'imp-pinned ' : ''}${column.unused ? `imp-unused ${unassigned.has(column.source!) ? 'imp-unassigned ' : ''}` : ''}${highlight === column.key ? 'imp-selected ' : ''}${column.key === 'model' && missingModel ? 'imp-required ' : ''}${gestureKey === column.key ? 'imp-dragging' : ''}`}>
              <div className="imp-column-heading">
                <button type="button" className="imp-grip" title="Arrastrar para reordenar" aria-label={`Arrastrar para reordenar · ${column.label}${column.unused ? ` · Excel ${columnLetter(column.source!)}` : ''}`}  aria-disabled={column.key === 'model' || column.unused || undefined}
                  onPointerDown={event => { if (!column.unused) begin(event, column.key, 'reorder'); }} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
                  onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); if (!column.unused) reorder(column.key, order.indexOf(column.key) + (event.key === 'ArrowLeft' ? -1 : 1)); } }}><GripVertical size={18} aria-hidden="true" /></button>
                <button type="button" className="imp-heading-label" aria-label={column.unused ? `Sin usar · ${column.label} · Excel ${columnLetter(column.source!)}` : undefined}><b><ReplayValue>{column.label}</ReplayValue></b><small>{column.key === 'model' && missingModel ? 'Falta Modelo' : column.unused ? unassigned.has(column.source!) ? 'Sin asignar' : 'Sin usar' : column.source !== undefined ? `Excel · ${columnLetter(column.source)}` : column.key === 'currency' ? `${defaultCurrency} por defecto` : 'sin columna'}</small></button>
              </div>
              <span className="imp-resize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={column.unused ? `Ancho de columna sin usar ${columnLetter(column.source!)}: ${column.label}` : `Ancho de ${column.label}`} aria-valuemin={100} aria-valuemax={480} aria-valuenow={widthFor(column.key)}
                onClick={event => event.stopPropagation()} onPointerDown={event => begin(event, column.key, 'resize')} onPointerMove={move} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setGestureKey(null); }}
                onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); setWidths(current => ({ ...current, [`${scope}:${column.key}`]: resizePreviewColumn(widthFor(column.key), event.key === 'ArrowLeft' ? -20 : 20) })); } }} />
            </th>)}</tr></thead>
            <tbody>
              {start > 0 && <tr aria-hidden="true"><td colSpan={columns.length} style={{ height: start * ROW_HEIGHT, padding: 0 }} /></tr>}
              {sheetRows.slice(start, end).map((row, index) => <tr key={start + index} data-testid="import-preview-row" data-index={start + index} aria-rowindex={start + index + 2}>
                {columns.map(column => <td key={column.key} className={`${column.key === 'model' ? 'imp-pinned ' : ''}${column.unused ? `imp-unused ${unassigned.has(column.source!) ? 'imp-unassigned ' : ''}` : ''}${highlight === column.key ? 'imp-selected' : ''}`} onClick={() => selectColumn(column.key, true)}><ReplayValue>{cellValue(row, start + index, column)}</ReplayValue></td>)}
              </tr>)}
              {end < sheetRows.length && <tr aria-hidden="true"><td colSpan={columns.length} style={{ height: (sheetRows.length - end) * ROW_HEIGHT, padding: 0 }} /></tr>}
            </tbody>
          </table>
        </div>
        {sheetRows.length === 0 && <div className="wempty">No hay equipos para importar en esta hoja.</div>}
        <div className="imp-table-notices">{children}</div>
      </div>
      <aside ref={panel} id="import-column-panel" className={`imp-panel${panelOpen ? ' imp-panel-open' : ''}`} aria-label="Excel → campo">
        <div className="imp-panel-heading"><h4>Excel → campo</h4><span className={`spill ${pending.length ? 'lime' : 'ok'}`} role="status">{pendingLabel}</span>{unassigned.size > 0 && <span className="spill no">Sin asignar</span>}{missingModel && <b className="imp-model-warning">Falta Modelo</b>}</div>
        <div className="imp-panel-rows">{mapping.map(column => {
          const key = column.field === 'ignore' ? `unused:${column.columnIndex}` : column.field;
          const suggested = suggestions.current.get(`${scope}:${column.columnIndex}`);
          return <article key={column.columnIndex} tabIndex={-1} data-column-index={column.columnIndex} aria-label={`Columna ${column.header}`} className={`imp-panel-row${unassigned.has(column.columnIndex) ? ' imp-unassigned' : ''}${highlight === key || highlightSource === column.columnIndex ? ' imp-selected' : ''}`}
            onClick={event => { if (!(event.target as HTMLElement).closest('.ds-select, .imp-new-inline')) selectColumn(key, false); }} onFocus={event => { if (event.target !== event.currentTarget) selectColumn(key, false); }}>
            <span className="imp-letter">{columnLetter(column.columnIndex)}</span>
            <div className="imp-source-name"><b title={column.header}><ReplayValue>{column.header}</ReplayValue></b><small><ReplayValue>{examples.map(row => row[column.columnIndex]?.trim() || '—').join(' · ')}</ReplayValue></small></div>
            <DeskSelect label={`Importar ${column.header} como`} data-testid={`import-column-${column.columnIndex}`} value={column.field} displayValue={unassigned.has(column.columnIndex) ? 'Sin asignar' : undefined} disabled={disabled}
              onChange={value => {
                if (value === '__new') { setCreating(column.columnIndex); setName(''); setType('text'); setError(''); }
                else assign(column.columnIndex, value);
              }} options={[
                ...catalog.map(field => ({ value: field.key, label: `${field.label}${suggested === field.key ? ' · Sugerido' : ''}` })),
                ...all.map(field => ({ value: `custom:${field.key}`, label: `${field.label} · ${field.type === 'date' ? 'Fecha' : field.type === 'number' ? 'Número' : 'Texto'}${suggested === `custom:${field.key}` ? ' · Sugerido' : ''}` })),
                { value: '__new', label: 'Nuevo campo…', icon: <Plus size={18} />, className: 'imp-new-field-option' }, { value: 'ignore', label: 'Descartar' },
              ]} />
            {creating === column.columnIndex && <div className="imp-new-inline" role="group" aria-label="Nuevo campo">
              <Field label="Nombre" error={error}><input autoFocus aria-label="Nombre del nuevo campo" maxLength={100} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></Field>
              <Segs options={[{ id: 'text', label: 'Texto' }, { id: 'date', label: 'Fecha' }, { id: 'number', label: 'Número' }]} value={type} onChange={value => setType(value as CustomFieldInput['type'])} />
              <button type="button" className="btn2 s" onClick={() => setCreating(null)}>Cancelar</button><button type="button" className="btn2 p" onClick={create}>Crear campo</button>
            </div>}
          </article>;
        })}</div>
      </aside>
    </div>
  </div>;
}
