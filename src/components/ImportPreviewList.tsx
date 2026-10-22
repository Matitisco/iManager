import { useEffect, useRef, useState } from 'react';

export type PreviewColumn = { key: string; label: string };

const EQUIPMENT_COLUMNS: PreviewColumn[] = [
  { key: 'model', label: 'Modelo' },
  { key: 'capacity', label: 'Capacidad' },
  { key: 'color', label: 'Color' },
  { key: 'condition', label: 'Condición' },
  { key: 'batteryHealth', label: 'Batería' },
  { key: 'price', label: 'Precio' },
  { key: 'currency', label: 'Moneda' },
];

const SALE_COLUMNS: PreviewColumn[] = [
  { key: 'date', label: 'Fecha' },
  { key: 'clientName', label: 'Cliente' },
  { key: 'device', label: 'Equipo' },
  { key: 'amount', label: 'Precio' },
  { key: 'currency', label: 'Moneda' },
  { key: 'paymentMethod', label: 'Pago' },
  { key: 'tradeIn', label: 'Canje' },
  { key: 'seller', label: 'Vendedor' },
];

const CLIENT_COLUMNS: PreviewColumn[] = [
  { key: 'name', label: 'Nombre' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email' },
  { key: 'dni', label: 'DNI' },
];

const TABLE_ROW = 44;
const CARD_ROW = 72;
const OVERSCAN = 6;

export function previewColumns(fields: { key: string; label: string }[]): PreviewColumn[] {
  if (fields.some((field) => field.key === 'model')) return EQUIPMENT_COLUMNS;
  if (fields.some((field) => field.key === 'amount')) return SALE_COLUMNS;
  if (fields.some((field) => field.key === 'name')) return CLIENT_COLUMNS;
  return fields.map((field) => ({ key: field.key, label: field.label }));
}

export function ImportPreviewList({
  rows,
  columns,
  currency,
  layout,
  nouns,
  review,
  excluded,
  errors,
  onEdit,
}: {
  rows: Record<string, string>[];
  columns: PreviewColumn[];
  currency: string;
  layout: 'table' | 'cards';
  nouns: { one: string; many: string };
  review?: { dudas: string[] }[];
  excluded?: Set<number>;
  errors?: (string | null)[];
  onEdit?: (index: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(layout === 'cards' ? 280 : 320);
  const cardHeight = onEdit ? 56 : CARD_ROW;
  const errorHeight = !onEdit && errors?.some(Boolean) ? 28 : 0;
  const rowHeight = (layout === 'cards' ? cardHeight : TABLE_ROW) + (onEdit ? 44 : 0) + errorHeight;
  const headerHeight = layout === 'table' ? 36 : 0;
  const equipment = columns.some((column) => column.key === 'model');
  const sales = columns.some((column) => column.key === 'amount');
  const clients = columns.some((column) => column.key === 'name') && !sales && !equipment;
  const wide = equipment || sales || clients;
  const total = new Intl.NumberFormat('es-AR').format(rows.length);
  const noun = rows.length === 1 ? nouns.one : nouns.many;
  const label = `${total} ${noun}`;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return undefined;
    const measure = () => setViewport(element.clientHeight || (layout === 'cards' ? 280 : 320));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout]);

  const start = Math.max(0, Math.min(rows.length, Math.floor(Math.max(0, scrollTop - headerHeight) / rowHeight) - OVERSCAN));
  const end = Math.min(rows.length, start + Math.ceil(viewport / rowHeight) + OVERSCAN * 2);
  const visible = rows.slice(start, end);

  return (
    <div className="import-preview-list space-y-2" data-layout={layout}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-bold text-gray-900">{equipment ? 'Equipos a importar' : sales ? 'Ventas a importar' : clients ? 'Clientes a importar' : 'Para importar'}</h3>
        <p className="text-sm font-medium text-gray-600" data-testid="import-preview-count">{label}</p>
      </div>
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div
          ref={scroller}
          data-testid="import-preview"
          tabIndex={0}
          role="region"
          aria-label={label}
          aria-rowcount={rows.length}
          className="overflow-auto"
          style={{ maxHeight: layout === 'cards' ? 280 : 360 }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          {layout === 'table' && (
            <div
              className="sticky top-0 z-[1] grid gap-2 border-b border-gray-200 bg-gray-50 px-3 text-xs font-bold uppercase tracking-wide text-gray-500"
              style={{ height: headerHeight, gridTemplateColumns: template(columns), minWidth: wide ? tableMinWidth(columns) : undefined, alignItems: 'center' }}
            >
              {columns.map((column) => <span key={column.key} className="truncate">{column.label}</span>)}
            </div>
          )}
          <div style={{ height: rows.length * rowHeight, position: 'relative', minWidth: layout === 'table' && wide ? tableMinWidth(columns) : undefined }}>
            {visible.map((row, offset) => {
              const index = start + offset;
              return (
                <div
                  key={index}
                  data-testid="import-preview-row"
                  data-index={index}
                  className={`absolute left-0 right-0 border-b border-gray-100 ${errors?.[index] ? 'bg-red-50' : review?.[index]?.dudas.length ? 'bg-amber-50' : ''} ${excluded?.has(index) ? 'opacity-50' : ''}`}
                  style={{ top: index * rowHeight, height: rowHeight, boxSizing: 'border-box' }}
                >
                  <div style={{ height: layout === 'cards' ? cardHeight : TABLE_ROW }}>
                    {layout === 'table'
                      ? <TableRow row={row} columns={columns} currency={currency} />
                      : <CardRow row={row} columns={columns} currency={currency} kind={equipment ? 'equipment' : sales ? 'sales' : clients ? 'clients' : 'generic'} />}
                  </div>
                  {errorHeight > 0 && <p className="px-3 text-xs text-red-700 truncate" style={{ height: errorHeight, margin: 0, lineHeight: '28px' }} title={errors?.[index] ?? undefined}>{errors?.[index]}</p>}
                  {onEdit && <button type="button" onClick={() => onEdit(index)} title={errors?.[index] ?? undefined} data-testid={`import-edit-row-${index}`} style={{ minHeight: 44 }} className="w-full px-3 flex items-center justify-between gap-2 text-xs font-medium text-gray-700 text-left">
                    <span className={`truncate ${errors?.[index] ? 'text-red-700' : ''}`}>{errors?.[index] || <>{excluded?.has(index) ? 'Excluida · ' : ''}{review?.[index]?.dudas.length ? `${review[index].dudas.length} ${review[index].dudas.length === 1 ? 'duda' : 'dudas'} · ` : ''}Cantidad: {row.quantity || '1'}{row.imei ? ` · IMEI ${row.imei}` : ''}{row.serial ? ` · Serie ${row.serial}` : ''}</>}</span>
                    <span className="shrink-0 underline">Revisar / editar</span>
                  </button>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TableRow({ row, columns, currency }: { row: Record<string, string>; columns: PreviewColumn[]; currency: string }) {
  return (
    <div className="grid gap-2 h-full items-center px-3 text-sm" style={{ gridTemplateColumns: template(columns) }}>
      {columns.map((column) => (
        <span key={column.key} className={`truncate ${column.key === 'model' || column.key === 'price' || column.key === 'clientName' || column.key === 'name' || column.key === 'amount' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
          {display(row, column.key, currency) || '—'}
        </span>
      ))}
    </div>
  );
}

function CardRow({
  row, columns, currency, kind,
}: {
  row: Record<string, string>;
  columns: PreviewColumn[];
  currency: string;
  kind: 'equipment' | 'sales' | 'clients' | 'generic';
}) {
  if (kind === 'equipment') {
    const meta = ['capacity', 'color', 'condition', 'batteryHealth']
      .map((key) => row[key]?.trim())
      .filter(Boolean)
      .join(' · ');
    const price = display(row, 'price', currency);
    return (
      <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-gray-900 truncate">{row.model || '—'}</p>
          <p className="text-sm font-medium text-gray-900 shrink-0">{[price, row.currency || currency].filter(Boolean).join(' ')}</p>
        </div>
        <p title={meta} className="text-xs text-gray-500 truncate">{meta || '—'}</p>
      </div>
    );
  }
  if (kind === 'sales') {
    const price = [display(row, 'amount', currency), display(row, 'currency', currency)].filter(Boolean).join(' ');
    const meta = [row.date, deviceLine(row), row.paymentMethod, row.tradeIn, row.seller].map((value) => value?.trim()).filter(Boolean).join(' · ');
    return (
      <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-gray-900 truncate">{row.clientName || deviceLine(row) || '—'}</p>
          <p className="text-sm font-medium text-gray-900 shrink-0">{price || '—'}</p>
        </div>
        <p title={meta} className="text-xs text-gray-500 truncate">{meta || '—'}</p>
      </div>
    );
  }
  if (kind === 'clients') {
    const meta = [row.phone, row.instagram ? `@${row.instagram.replace(/^@/, '')}` : '', row.email, row.dni ? `DNI ${row.dni}` : '']
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' · ');
    return (
      <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-0.5">
        <p className="text-sm font-medium text-gray-900 truncate">{row.name || '—'}</p>
        <p title={meta} className="text-xs text-gray-500 truncate">{meta || '—'}</p>
      </div>
    );
  }
  const [primary, ...rest] = columns;
  return (
    <div className="h-full px-3 py-2.5 flex flex-col justify-center gap-0.5">
      <p className="text-sm font-medium text-gray-900 truncate">{primary ? display(row, primary.key, currency) || '—' : '—'}</p>
      <p className="text-xs text-gray-500 truncate">
        {rest.map((column) => display(row, column.key, currency)).filter(Boolean).join(' · ') || '—'}
      </p>
    </div>
  );
}

function tableMinWidth(columns: PreviewColumn[]): number {
  if (columns.some((column) => column.key === 'amount')) return 980;
  if (columns.some((column) => column.key === 'name')) return 760;
  return 720;
}

function template(columns: PreviewColumn[]): string {
  if (columns.some((column) => column.key === 'model') && columns.length === EQUIPMENT_COLUMNS.length) {
    return 'minmax(140px, 1.6fr) minmax(72px, 0.8fr) minmax(72px, 0.9fr) minmax(88px, 0.8fr) minmax(64px, 0.7fr) minmax(72px, 0.8fr) minmax(56px, 0.5fr)';
  }
  if (columns.some((column) => column.key === 'amount') && columns.length === SALE_COLUMNS.length) {
    return 'minmax(88px, 0.8fr) minmax(120px, 1.2fr) minmax(140px, 1.4fr) minmax(80px, 0.8fr) minmax(56px, 0.5fr) minmax(110px, 0.9fr) minmax(100px, 0.9fr) minmax(90px, 0.8fr)';
  }
  return `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;
}

function deviceLine(row: Record<string, string>): string {
  return [row.device, row.productImei].map((value) => value?.trim()).filter(Boolean).join(' · ');
}

function display(row: Record<string, string>, key: string, currency: string): string {
  if (key === 'currency') return row.currency?.trim() || currency;
  if (key === 'price') return formatAmount(row.price);
  if (key === 'amount') return formatAmount(row.amount);
  if (key === 'device') return deviceLine(row);
  if (key === 'instagram') {
    const handle = row.instagram?.trim().replace(/^@+/, '');
    return handle ? `@${handle}` : '';
  }
  return row[key]?.trim() ?? '';
}

function formatAmount(value: string | undefined): string {
  if (!value?.trim()) return '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(amount);
}
