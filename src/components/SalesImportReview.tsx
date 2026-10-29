import { useEffect, useRef, useState } from 'react';
import { assignImportColumn, columnLetter, importColumns } from '../lib/import-preview';
import type { ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import type { ImportFieldDef } from './ImportModal';
import { ReplayValue } from '../desk/replay-privacy';
import './SalesImportReview.css';

const ROW_HEIGHT = 64;
const messages = (row: Record<string, string>) => row._review?.split('\n').filter(Boolean) ?? [];
const reviewSummary = (row: Record<string, string>) => [/duplicada/, /fila de total/, /IMEI no encontrado|IMEI no disponible/, /Medio de pago/, /Sin cotización/].map(pattern => messages(row).find(message => pattern.test(message))).find(Boolean) || messages(row)[0];
const amount = (row: Record<string, string>) => row._possibleTotal === 'true' || row._unpriced === 'true' ? 'Sin importe imputado'
  : `USD ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(row._amountUsd ?? row.amount) || 0)}`;

export function SalesImportReview({ rows, sheets, plan, active, fields, disabled, onSheet, onChange }: {
  rows: Record<string, string>[]; sheets: ImportSheetPayload[]; plan: ImportSheetPlan[];
  active: ImportSheetPlan; fields: ImportFieldDef[]; disabled: boolean;
  onSheet: (name: string) => void; onChange: (plan: ImportSheetPlan[], refresh: boolean) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [selected, setSelected] = useState<Record<string, string> | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  const grid = sheets.find(sheet => sheet.name === active.name)?.rows ?? [];
  const columns = importColumns(active, grid);
  const sheetRows = rows.filter(row => row._sourceSheet === active.name);
  const filtered = onlyReview ? sheetRows.filter(row => messages(row).length) : sheetRows;
  const reviewCount = rows.filter(row => messages(row).length).length;
  const start = Math.max(0, Math.min(filtered.length - 1, Math.floor(scrollTop / ROW_HEIGHT) - 4));
  const end = Math.min(filtered.length, start + 20);
  const visible = filtered.slice(start, end);
  const change = (next: ImportSheetPlan, refresh = false) => onChange(plan.map(sheet => sheet.name === active.name ? next : sheet), refresh);
  const inspect = (row: Record<string, string>) => { setSelected(row); };
  useEffect(() => { setSelected(null); setScrollTop(0); if (scroller.current) scroller.current.scrollTop = 0; }, [active.name, rows, onlyReview]);
  useEffect(() => { if (selected) detail.current?.scrollIntoView?.({ block: 'nearest' }); }, [selected]);
  return <div className="sales-import-review" data-testid="sales-import-review">
    <div className="imp-table-title"><h4>Ventas a importar <span data-testid="import-preview-count">{rows.length} {rows.length === 1 ? 'venta' : 'ventas'}</span></h4>
      <button type="button" className="wlink" aria-pressed={onlyReview} onClick={() => setOnlyReview(value => !value)}>{onlyReview ? 'Ver todas' : `Por revisar (${reviewCount})`}</button>
    </div>
    {plan.length > 1 && <div className="imp-sources" role="group" aria-label="Hojas a importar">{plan.map(sheet => <div className="imp-source-row" key={sheet.name}>
      <input type="checkbox" aria-label={`Incluir hoja ${sheet.name}`} checked={sheet.include} disabled={disabled} onChange={() => onChange(plan.map(item => item.name === sheet.name ? { ...item, include: !item.include } : item), false)} />
      <button type="button" aria-pressed={active.name === sheet.name} onClick={() => onSheet(sheet.name)}><ReplayValue>{sheet.name}</ReplayValue></button>
    </div>)}</div>}
    <details className="sales-import-settings"><summary className="wlink">Encabezado y rango</summary><div className="sales-import-range">
      <label className="fl"><span>Fila de encabezado (0 = sin encabezado)</span><input aria-label="Fila de encabezado" type="number" min={0} max={grid.length} value={active.headerRow} disabled={disabled} onChange={event => change({ ...active, headerRow: Number(event.target.value), dataStartRow: Number(event.target.value) + 1 }, true)} /></label>
      <label className="fl"><span>Desde fila</span><input aria-label="Desde fila" type="number" min={active.headerRow + 1} max={grid.length} value={active.dataStartRow} disabled={disabled} onChange={event => change({ ...active, dataStartRow: Number(event.target.value) })} /></label>
      <label className="fl"><span>Hasta fila</span><input aria-label="Hasta fila" type="number" min={active.dataStartRow} max={grid.length} value={active.dataEndRow} disabled={disabled} onChange={event => change({ ...active, dataEndRow: Number(event.target.value) })} /></label>
    </div></details>
    <div className="sales-import-mapping-mobile"><details><summary className="wlink">Asignar columnas</summary>{columns.map(column => <label className="fl" key={column.columnIndex}><span><ReplayValue>{columnLetter(column.columnIndex)} · {column.header}</ReplayValue></span><select aria-label={`Importar ${column.header} como (móvil)`} disabled={disabled} value={column.field} onChange={event => change(assignImportColumn(active, grid, column.columnIndex, event.target.value))}>
      <option value="ignore">Conservar en notas</option>{fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
    </select></label>)}</details></div>
    <div ref={scroller} className="sales-import-scroll" data-testid="import-preview" role="region" aria-label="Vista previa de ventas" aria-rowcount={filtered.length} aria-busy={disabled} tabIndex={0} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      <table className="dtable compact sales-import-table" aria-label="Ventas fila por fila" aria-rowcount={filtered.length + 1}>
        <thead><tr><th scope="col">Fila</th><th scope="col">Revisión</th><th scope="col">Importe a guardar</th>{columns.map(column => <th scope="col" key={column.columnIndex} className={column.field === 'ignore' ? 'imp-unused' : undefined}>
          <label><small><ReplayValue>{columnLetter(column.columnIndex)} · {column.header}</ReplayValue></small><select aria-label={`Importar ${column.header} como`} value={column.field} disabled={disabled} onChange={event => change(assignImportColumn(active, grid, column.columnIndex, event.target.value))}>
            <option value="ignore">Conservar en notas</option>{fields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
          </select></label>{column.review?.length ? <small className="sales-import-column-review">Por revisar · {column.review.join(' ')}</small> : null}
        </th>)}</tr></thead>
        <tbody>
          {start > 0 && <tr aria-hidden="true"><td colSpan={columns.length + 3} style={{ height: start * ROW_HEIGHT, padding: 0 }} /></tr>}
          {visible.map((row, index) => <tr key={row._sourceRow || index} data-testid="import-preview-row" aria-rowindex={start + index + 2} className={messages(row).length ? 'sales-import-pending' : undefined} style={{ height: ROW_HEIGHT }}>
            <td>{row._sourceRow}</td>
            <td><button type="button" className="wlink" onClick={() => inspect(row)}>{messages(row).length ? `Por revisar (${messages(row).length})` : 'Ver datos'}</button><small title={row._review}>{reviewSummary(row) || 'Lista para importar'}</small></td>
            <td>{amount(row)}{row._exchangeRate && <small>ARS {row._exchangeRate} · {row._rateDate}{row._rateSource === 'today' ? ' · hoy' : ''}</small>}</td>
            {columns.map(column => <td key={column.columnIndex}><ReplayValue>{grid[Number(row._sourceRow) - 1]?.[column.columnIndex] || '—'}</ReplayValue></td>)}
          </tr>)}
          {end < filtered.length && <tr aria-hidden="true"><td colSpan={columns.length + 3} style={{ height: (filtered.length - end) * ROW_HEIGHT, padding: 0 }} /></tr>}
        </tbody>
      </table>
      <div className="sales-import-cards" style={{ height: filtered.length * ROW_HEIGHT, position: 'relative' }}>{visible.map((row, index) => <button type="button" key={row._sourceRow || index} className={`sales-import-card${messages(row).length ? ' sales-import-pending' : ''}`} style={{ top: (start + index) * ROW_HEIGHT, height: ROW_HEIGHT }} onClick={() => inspect(row)}>
        <span><b><ReplayValue>{row.clientName || row.device || `Fila ${row._sourceRow}`}</ReplayValue></b><strong>{amount(row)}</strong></span>
        <small>Fila {row._sourceRow} · {messages(row).length ? `Por revisar · ${reviewSummary(row)}` : 'Lista para importar'}</small>
      </button>)}</div>
    </div>
    {filtered.length === 0 && <div className="wempty">No hay ventas {onlyReview ? 'por revisar' : 'en esta hoja'}.</div>}
    {rows.some(row => row._unassigned) && <p className="sales-import-preserved" role="status">Las columnas sin asignar se guardan en las notas de cada venta.</p>}
    {selected && <div ref={detail} className="sales-import-detail" data-testid="sales-import-row-detail">
      <div className="imp-table-title"><h4>Fila {selected._sourceRow} · <ReplayValue>{selected._sourceSheet}</ReplayValue></h4><button type="button" className="wlink" onClick={() => setSelected(null)}>Cerrar detalle</button></div>
      {messages(selected).length > 0 && <ul>{messages(selected).map(message => <li key={message}><ReplayValue>{message}</ReplayValue></li>)}</ul>}
      <div className="sales-import-values">{fields.filter(field => selected[field.key]).map(field => <div className="kv" key={field.key}><span>{field.label}</span><b><ReplayValue>{selected[field.key]}</ReplayValue></b></div>)}</div>
      {selected._exchangeRate && <p>Importe a guardar: {amount(selected)} · Cotización {selected._rateSource === 'today' ? 'de hoy' : 'de la fecha de venta'}: ARS {selected._exchangeRate} por USD ({selected._rateDate}).</p>}
    </div>}
  </div>;
}
