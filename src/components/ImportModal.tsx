import { DeskSelect } from '../desk/select';
import { toActionMessage } from '../lib/user-message';
import React, { useEffect, useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Sheet } from '../desk/ui';
import { assignColumn, fieldToColumn, mappingFromFields } from '../lib/import-mapping';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { parseWorkbook } from '../utils/parse-workbook';
import { expandTextRows, textRowError } from '../lib/text-import-review';
import { parseImportNumber } from '../lib/import-number';
import { ImportPreviewList, previewColumns } from './ImportPreviewList';
import { ListSkeleton } from '../desk/list-skeleton';
import './ImportModal.css';
import { importVariant } from '../desk/import-variant';

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface GenericImportResult {
  priceToDefine?: number;
  imported: number;
  updated: number;
  errors: { row: number; message: string; [key: string]: unknown }[];
}

type Step = 'upload' | 'reading' | 'summary' | 'adjust' | 'result';

export const UNRELATED_IMPORT_NOTICE = 'Este archivo no parece tener equipos para importar.';

interface Props {
  onFilterPriceToDefine?: () => void;
  existingImeis?: readonly string[];
  fields: ImportFieldDef[];
  onImport: (rows: Record<string, string>[]) => Promise<GenericImportResult>;
  onClose: () => void;
  onStageChange?: (stage: 'file' | 'mapping' | 'review' | 'analyze') => void;
  title?: string;
  /** Kept for callers using the previous layout hint; Sheet now adapts automatically. */
  sheet?: boolean;
  nouns?: { one: string; many: string };
  unrelatedNotice?: string;
  onAnalyzeText?: (text: string) => Promise<ImportAnalysis>;
  onAnalyze: (sheets: ImportSheetPayload[]) => Promise<ImportAnalysis>;
  onApply: (sheets: ImportSheetPayload[], plan: ImportSheetPlan[], refreshMapping: boolean) => Promise<ImportAnalysis>;
}

function countLabel(count: number, nouns: { one: string; many: string }) {
  return `${new Intl.NumberFormat('es-AR').format(count)} ${count === 1 ? nouns.one : nouns.many}`;
}

function sheetLine(count: number, nouns: { one: string; many: string }, condition: string) {
  const label = countLabel(count, nouns);
  if (condition === 'NUEVO') return `${label} ${count === 1 ? 'nuevo' : 'nuevos'}`;
  if (condition === 'USADO') return `${label} ${count === 1 ? 'usado' : 'usados'}`;
  if (condition === 'PRE-OWNED') return `${label} pre-owned`;
  return label;
}

export const ImportModal: React.FC<Props> = ({
  fields, onImport, onClose, onStageChange, onFilterPriceToDefine, existingImeis = [], title = 'Importar',
  nouns = { one: 'fila', many: 'filas' }, unrelatedNotice = UNRELATED_IMPORT_NOTICE, onAnalyze, onApply, onAnalyzeText,
}) => {
  const [source, setSource] = useState<'excel' | 'paste' | 'txt'>('excel');
  const [text, setText] = useState('');
  const [textPreview, setTextPreview] = useState(false);
  const [review, setReview] = useState<NonNullable<ImportAnalysis['review']>>([]);
  const [discarded, setDiscarded] = useState<NonNullable<ImportAnalysis['discarded']>>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<Step>('upload');
  const [readingHeight, setReadingHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { onStageChange?.(step === 'upload' ? 'file' : step === 'reading' ? 'analyze' : step === 'adjust' ? 'mapping' : 'review'); }, [step, onStageChange]);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ImportSheetPayload[]>([]);
  const [plan, setPlan] = useState<ImportSheetPlan[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<ImportAnalysis['summary'] | null>(null);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [applying, setApplying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GenericImportResult | null>(null);
  const variant = importVariant();
  const [targetField, setTargetField] = useState<string | null>(null);
  useEffect(() => {
    if (step !== 'adjust' || !targetField || applying) return;
    const field = bodyRef.current?.querySelector<HTMLElement>(`[data-testid="import-field-${targetField}"]`);
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus();
    setTargetField(null);
  }, [step, targetField, applying]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const editorRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => { if (editing !== null) editorRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [editing]);
  useEffect(() => () => { requestRef.current += 1; }, []);

  const beginReading = () => {
    setReadingHeight(bodyRef.current?.getBoundingClientRect().height ?? 0);
    setStep('reading');
  };

  const applyResult = (analysis: ImportAnalysis) => {
    setPlan(analysis.plan);
    setTextPreview(Boolean(analysis.review));
    setReview(analysis.review ?? []);
    setDiscarded(analysis.discarded ?? []);
    setEditing(null);
    setExcluded(new Set());
    setRows(analysis.review ? analysis.rows.map((row) => ({ ...row, currency: row.currency || analysis.currency, condition: row.condition || 'USADO' })) : analysis.rows);
    setSummary(analysis.summary);
    setCurrency(analysis.currency);
    setNotice(analysis.notice);
    setActiveSheet((current) => analysis.plan.some((item) => item.name === current) ? current : analysis.plan[0]?.name ?? '');
  };

  const handleText = async (value: string) => {
    setFileError(null);
    if (!value.trim()) { setFileError('Pegá un listado para analizar.'); return; }
    if (new TextEncoder().encode(value).length > 100_000) { setFileError('El texto supera los 100 KB. Dividilo en listados más chicos.'); return; }
    if (!onAnalyzeText) {
      await handleFile(new File([value], 'listado.csv', { type: 'text/csv' }));
      return;
    }
    const requestId = ++requestRef.current;
    beginReading();
    try {
      const analysis = await onAnalyzeText(value);
      if (requestRef.current !== requestId) return;
      applyResult(analysis);
      setStep('summary');
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setFileError(toActionMessage(error, 'No se pudo analizar el listado.'));
      setStep('upload');
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt') {
      setSource('txt');
      if (file.size > 100_000) { setFileError('El archivo supera los 100 KB. Dividilo en listados más chicos.'); return; }
      try {
        const value = await file.text();
        setText(value);
        await handleText(value);
      } catch { setFileError('No pudimos leer el .txt. Usá codificación UTF-8.'); }
      return;
    }
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setFileError('Formato no soportado. Usá .csv, .xlsx o .txt');
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    try {
      const workbook = await parseWorkbook(file);
      const nextSheets = workbook.sheetNames
        .map((name) => ({ name, rows: workbook.getSheet(name) }))
        .filter((item) => item.rows.some((row) => row.some(Boolean)));
      if (nextSheets.length === 0) {
        setFileError('El archivo está vacío');
        return;
      }
      if (nextSheets.reduce((total, item) => total + item.rows.length, 0) > 5000) {
        setFileError('El archivo supera las 5000 filas.');
        return;
      }
      setSheets(nextSheets);
      beginReading();
      const analysis = await onAnalyze(nextSheets);
      if (requestRef.current !== requestId) return;
      applyResult(analysis);
      setStep('summary');
    } catch (error: unknown) {
      if (requestRef.current !== requestId) return;
      setFileError(toActionMessage(error, 'Error al leer el archivo'));
      setStep('upload');
    }
  };

  const reapply = async (nextPlan: ImportSheetPlan[], refreshMapping: boolean) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setPlan(nextPlan);
    setApplying(true);
    setFileError(null);
    try {
      const analysis = await onApply(sheets, nextPlan, refreshMapping);
      if (requestRef.current !== requestId) return;
      applyResult(analysis);
    } catch (error: unknown) {
      if (requestRef.current !== requestId) return;
      setFileError(toActionMessage(error, 'No se pudo actualizar la importación.'));
    } finally {
      if (requestRef.current === requestId) setApplying(false);
    }
  };

  const included = plan.filter((item) => item.include);
  const requiredMissing = fields.filter((field) => field.required && included.some((item) => !item.mapping.some((column) => column.field === field.key)));
  const selectedRows = rows.filter((_, index) => !excluded.has(index));
  const existing = new Set(existingImeis);
  const updatingRows = selectedRows.filter(row => row.imei?.trim() && existing.has(row.imei.trim()));
  const updatingCount = new Set(updatingRows.map(row => row.imei.trim())).size;
  const replacementFields = fields.filter(field => field.key !== 'imei' && updatingRows.some(row => row[field.key] !== undefined && (field.key !== 'cost' || parseImportNumber(row.cost) !== undefined) && (field.key !== 'price' || Boolean(row.price?.trim())))).map(field => field.label);
  const equipmentCount = textPreview ? selectedRows.reduce((sum, row) => sum + Number(row.quantity), 0) : selectedRows.length;
  const validationError = textPreview ? selectedRows.map(textRowError).find(Boolean) ?? (equipmentCount > 2000 ? 'El listado supera los 2000 equipos.' : null) : null;
  const canImport = !applying && selectedRows.length > 0 && !validationError && (textPreview || (requiredMissing.length === 0 && included.length > 0));
  const unrelated = rows.length === 0 && (notice === unrelatedNotice || notice === 'Este texto no parece tener equipos para importar');
  const active = plan.find((item) => item.name === activeSheet) ?? plan[0];
  const activeRows = sheets.find((item) => item.name === active?.name)?.rows ?? [];
  const headerIndex = Math.max(0, (active?.headerRow ?? 1) - 1);
  const headers = (activeRows[headerIndex] ?? []).filter((header) => header.trim());
  const selected = active ? fieldToColumn(active.mapping) : {};
  const isInventory = fields.some(field => field.key === 'model') && fields.some(field => field.key === 'price');
  const missingPriceColumn = isInventory && !textPreview && included.some(item => !item.mapping.some(column => column.field === 'price'));
  const noPriceRows = isInventory ? selectedRows.filter(row => !row.price?.trim()).length : 0;
  const adjustField = (key: string) => {
    const sheet = included.find(item => !item.mapping.some(column => column.field === key));
    if (sheet) setActiveSheet(sheet.name);
    setTargetField(key);
    setStep('adjust');
  };

  const handleImport = async () => {
    if (importing || !canImport) return;
    setImporting(true);
    setFileError(null);
    try {
      const response = await onImport(textPreview ? expandTextRows(selectedRows) : selectedRows);
      setResult(response);
      setStep('result');
    } catch (error: unknown) {
      setFileError(toActionMessage(error, 'Error al importar'));
    } finally {
      setImporting(false);
    }
  };

  const rowErrors = rows.map((row) => {
    if (textPreview) return textRowError(row);
    const missing = fields.filter((field) => field.required && !row[field.key]?.trim());
    if (missing.length) return `Falta ${missing.map((field) => field.label).join(', ')}`;
    if (fields.some((field) => field.key === 'amount') && parseImportNumber(row.amount) === undefined) return 'Precio inválido';
    return null;
  });
  const busy = importing || applying || step === 'reading';
  const resultHasErrors = Boolean(result?.errors.length);
  const listLabel = `Listado de ${nouns.many === 'filas' ? 'equipos' : nouns.many}`;
  const placeholder = onAnalyzeText
    ? 'iPhone 13 128GB Midnight 89% US$ 420\n13 pro max 256 azul bat 85 520usd'
    : fields.some((field) => field.key === 'name')
      ? 'Nombre,Teléfono,Email\nLucía,2615550106,lucia@example.com'
      : fields.some((field) => field.key === 'amount')
        ? 'Fecha,Cliente,Equipo,Precio\n22/10/2026,Lucía,iPhone 13,420'
        : 'Modelo,Precio\niPhone 13,420';

  const body = (
    <div ref={bodyRef} className={`inv-import-body import-variant-${variant}`} style={step === 'reading' ? { minHeight: readingHeight } : undefined}>
      {step === 'upload' && (
        <div className="import-source">
          <div className="import-modes" role="group" aria-label="Origen del listado">
            {([['excel', 'CSV'], ['txt', 'Subir .txt'], ['paste', 'Pegar listado']] as const).map(([value, label]) => (
              <button type="button" key={value} aria-pressed={source === value} onClick={() => { setSource(value); setFileError(null); }} className={source === value ? 'on' : ''}>{label}</button>
            ))}
          </div>
          {source === 'paste' ? <textarea
            aria-label={listLabel} value={text} onChange={(event) => setText(event.target.value)}
            rows={7} maxLength={100_000} placeholder={placeholder} className="import-paste"
          /> : <button
            type="button" aria-label={source === 'txt' ? 'Elegir archivo .txt' : 'Elegir archivo CSV o XLSX'}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`import-drop${dragging ? ' dragging' : ''}`}
          >
            <Upload size={28} aria-hidden="true" />
            <strong>Elegir archivo</strong>
            <span>{source === 'txt' ? '.txt · 100 KB' : '.csv · .xlsx · 5000 filas'}</span>
            <span className="import-drag-hint">o arrastralo acá</span>
          </button>}
          <input
            ref={fileInputRef} type="file" aria-label="Archivo a importar"
            accept={source === 'txt' ? '.txt,text/plain' : '.csv,.xlsx'} hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {step === 'reading' && <ListSkeleton variant="lines" rows={5} testId="import-reading" />}

      {step === 'summary' && missingPriceColumn && <div className="import-guidance" role="status" data-testid="import-price-notice">
        {variant === 'b' && <span className="spill">Precio a definir</span>}
        <b>Tu archivo no tiene columna de precio de venta asignada.</b>
        <p>Podés importar los equipos con precio a definir. Si el archivo sí tiene esa columna, asignala en Ajustar importación.</p>
        <button type="button" className="wlink" onClick={() => adjustField('price')}>Asignar columna de precio</button>
      </div>}

      {step === 'summary' && summary && unrelated && (
        <div data-testid="import-unrelated" role="status" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
          <p className="text-sm font-medium text-gray-900">{notice || unrelatedNotice}</p>
        </div>
      )}

      {step === 'summary' && summary && !unrelated && (
        <div data-testid="import-summary" className="space-y-3">
          {(summary.discardedRows ?? 0) > 0 && <div className="import-guidance missing" role="status" data-testid="import-skipped-notice"><b>{summary.discardedRows} {summary.discardedRows === 1 ? 'fila descartada' : 'filas descartadas'} por falta de modelo.</b><button type="button" className="wlink" onClick={() => adjustField('model')}>Asignar columna de modelo</button></div>}
          {updatingCount > 0 && <div className="import-imei-warning" role="status" data-testid="import-imei-warning">
            <b>{updatingCount === 1 ? 'Se actualizará 1 equipo existente por IMEI' : `Se actualizarán ${updatingCount} equipos existentes por IMEI`}</b>
            <p>Campos del archivo que pueden reemplazar datos: {replacementFields.join(', ')}. Los campos omitidos se conservan.</p>
          </div>}
          {summary.sheetCount > 1 && <details className="import-sheets">
          <summary>{summary.sheetCount} hojas</summary>
          <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {summary.sheets.filter((item) => item.included).map((item) => (
              <li key={item.name} data-testid="import-sheet-summary" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-gray-500">{sheetLine(item.rows, nouns, item.condition)}</span>
              </li>
            ))}
          </ul></details>}
          {summary.rowCount === 0 && !(summary.discardedRows > 0) && <div className="import-guidance" role="status">
            <b>No encontramos filas para importar.</b>
            <p>{requiredMissing.length ? `Falta asignar ${requiredMissing.map(field => field.label).join(', ')}.` : 'Revisá el encabezado y las columnas asignadas.'}</p>
            <button type="button" className="wlink" onClick={() => adjustField(requiredMissing[0]?.key ?? 'model')}>Ajustar importación</button>
          </div>}
          {!missingPriceColumn && noPriceRows > 0 && <div className="import-guidance" role="status"><b>{noPriceRows} {noPriceRows === 1 ? 'equipo sin precio' : 'equipos sin precio'} de venta.</b><p>Se importarán con precio a definir. Los precios ya guardados se conservan.</p></div>}
          {rows.length > 0 && (
            <ImportPreviewList
              rows={rows}
              columns={previewColumns(fields)}
              currency={currency}
              layout="cards"
              nouns={textPreview ? { one: 'fila', many: 'filas' } : nouns}
              review={textPreview ? review : undefined}
              errors={rowErrors}
              excluded={excluded}
              onEdit={textPreview ? (index) => setEditing(index) : undefined}
            />
          )}
        </div>
      )}

      {step === 'summary' && textPreview && !unrelated && <div className="space-y-3 mt-3">
        {excluded.size > 0 && <p className="text-sm text-gray-600">{excluded.size} filas excluidas · <button type="button" className="underline" onClick={() => setExcluded(new Set())}>Restaurar filas</button></p>}
        {editing !== null && rows[editing] && <fieldset ref={editorRef} className="rounded-xl border border-gray-200 p-3 space-y-3" data-testid="import-row-editor">
          <legend className="text-sm font-bold px-1">Revisar equipo · línea {review[editing]?.line}</legend>
          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{review[editing]?.original}</p>
          {review[editing]?.dudas.map((duda, index) => <p key={index} className="text-xs text-amber-900">{duda}</p>)}
          <div className="grid grid-cols-2 gap-3">
            {[...fields.filter((field) => !['grade', 'status'].includes(field.key)), { key: 'currency', label: 'Moneda' }, { key: 'serial', label: 'Serie' }, { key: 'quantity', label: 'Cantidad' }].map((field) => <label key={field.key} className="text-xs font-medium text-gray-700 min-w-0">{field.label}
              {['currency', 'condition'].includes(field.key) ? <DeskSelect label={field.label} value={rows[editing][field.key] ?? ''}
                onChange={(value) => setRows((current) => current.map((row, index) => index === editing ? { ...row, [field.key]: value } : row))}
                options={(field.key === 'currency' ? ['ARS', 'USD'] : ['USADO', 'NUEVO', 'PRE-OWNED', 'OUTLET']).map(value => ({ value, label: value }))} /> : <input aria-label={field.label} value={rows[editing][field.key] ?? ''} inputMode={['price', 'cost', 'quantity', 'imei'].includes(field.key) ? 'decimal' : undefined} onChange={(event) => setRows((current) => current.map((row, index) => index === editing ? { ...row, [field.key]: event.target.value } : row))} className="block w-full min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-base" />}
            </label>)}
          </div>
          {textRowError(rows[editing]) && <p role="alert" className="text-sm text-red-700">{textRowError(rows[editing])}</p>}
          <div className="flex gap-3">
            <button type="button" className="btn2 s" style={{ minHeight: 44 }} onClick={() => { setExcluded((current) => new Set([...current, editing])); setEditing(null); }}>Excluir fila</button>
            <button type="button" className="btn2 p" style={{ minHeight: 44 }} onClick={() => setEditing(null)}>Listo</button>
          </div>
        </fieldset>}
        {validationError && !selectedRows.some(textRowError) && <p role="alert" className="text-sm text-red-700">{validationError}</p>}
      </div>}
      {step === 'summary' && textPreview && discarded.length > 0 && <details className="mt-3 rounded-xl border border-gray-200 p-3" data-testid="import-discarded">
        <summary className="text-sm font-medium cursor-pointer">{discarded.length} {discarded.length === 1 ? 'línea descartada' : 'líneas descartadas'}</summary>
        <ul className="mt-2 space-y-2">{discarded.map((item) => <li key={item.line} className="text-xs text-gray-600 break-words">Línea {item.line}: {item.original} — {item.reason}</li>)}</ul>
      </details>}

      {step === 'adjust' && active && (
        <div className="space-y-5" data-testid="import-adjust">
          {requiredMissing.length > 0 && <div className="import-guidance missing" role="alert"><b>Falta asignar {requiredMissing.map(field => field.label).join(', ')}.</b><p>Asigná los campos obligatorios para importar.</p><button type="button" className="wlink" onClick={() => adjustField(requiredMissing[0].key)}>Ir al campo obligatorio</button></div>}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hojas</p>
            {plan.map((item) => (
              <label key={item.name} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm cursor-pointer ${active.name === item.name ? 'border-gray-900' : 'border-gray-200'}`}>
                <input
                  type="checkbox"
                  className="accent-black"
                  style={{ accentColor: '#16181D' }}
                  data-testid={`import-sheet-${item.name}`}
                  checked={item.include}
                  onChange={() => {
                    void reapply(plan.map((sheetPlan) => sheetPlan.name === item.name ? { ...sheetPlan, include: !sheetPlan.include } : sheetPlan), false);
                  }}
                />
                <button type="button" className="flex-1 text-left font-medium text-gray-800" onClick={() => setActiveSheet(item.name)}>
                  {item.name}
                </button>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Encabezado</p>
            {activeRows.slice(0, 12).map((row, index) => {
              const selectedRow = index + 1 === active.headerRow;
              return (
                <button
                  key={index}
                  type="button"
                  data-testid={selectedRow ? 'import-header-current' : undefined}
                  onClick={() => {
                    if (selectedRow) return;
                    void reapply(plan.map((sheetPlan) => sheetPlan.name === active.name
                      ? { ...sheetPlan, headerRow: index + 1, dataStartRow: index + 2 }
                      : sheetPlan), true);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm"
                  style={selectedRow
                    ? { background: '#16181D', color: '#fff', border: '1px solid #16181D' }
                    : { background: '#fff', color: '#374151', border: '1px solid #e5e7eb' }}
                >
                  <span className="w-6 shrink-0 font-mono text-xs opacity-70">{index + 1}</span>
                  <span className="truncate">{row.filter(Boolean).slice(0, 5).join(' · ') || 'fila vacía'}</span>
                </button>
              );
            })}
          </div>

          <div className={`import-mapping border border-gray-200 rounded-xl ${variant === 'b' ? 'import-mapping-cards' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Campo</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Columna del archivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field) => {
                  const taken = new Set(Object.entries(selected).filter(([key, value]) => key !== field.key && value).map(([, value]) => value));
                  return (
                    <tr key={field.key} className={field.required && !selected[field.key] ? 'import-field-missing' : field.key === 'price' && !selected.price ? 'import-field-price' : undefined}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {field.label}
                        {field.required && <span className="text-red-500 text-xs"> *</span>}
                        {field.required && !selected[field.key] && <small>Obligatorio sin asignar</small>}
                        {field.key === 'price' && !selected.price && <small>Opcional · a definir</small>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <DeskSelect label={field.label} invalid={field.required && !selected[field.key]} data-testid={`import-field-${field.key}`} value={selected[field.key] ?? ''}
                            onChange={(value) => {
                              const mapping = mappingFromFields(headers, assignColumn(selected, field.key, value));
                              void reapply(plan.map((sheetPlan) => sheetPlan.name === active.name ? { ...sheetPlan, mapping } : sheetPlan), false);
                            }}
                            options={[{ value: '', label: '— Sin mapear —' }, ...headers.map(header => ({ value: header, label: header, disabled: selected[field.key] !== header && taken.has(header) }))]} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-4 border rounded-xl ${resultHasErrors ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            {resultHasErrors ? <AlertCircle size={22} className="text-red-600 shrink-0" /> : <CheckCircle2 size={22} className="text-green-600 shrink-0" />}
            <div>
              <p className={`font-semibold ${resultHasErrors ? 'text-red-800' : 'text-green-800'}`}>{resultHasErrors ? 'Importación con errores' : 'Importación completada'}</p>
              <p className={`text-sm mt-0.5 ${resultHasErrors ? 'text-red-700' : 'text-green-700'}`}>
                {result.imported} creados · {result.updated} actualizados
                {result.errors.length > 0 && ` · ${result.errors.length} ${result.errors.length === 1 ? 'error' : 'errores'}`}
              </p>
            </div>
          </div>
          {(result.priceToDefine ?? 0) > 0 && <div className="import-guidance" role="status" data-testid="import-price-result">
            {variant === 'b' && <span className="import-result-number">{result.priceToDefine}</span>}
            <b>{result.priceToDefine} {result.priceToDefine === 1 ? 'equipo quedó' : 'equipos quedaron'} con precio a definir</b>
            {onFilterPriceToDefine && <button type="button" className="wlink" onClick={onFilterPriceToDefine}>Ver equipos con precio a definir</button>}
          </div>}
          {result.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-red-50">
                  {result.errors.map((error, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-gray-500">{error.row}</td>
                      <td className="px-3 py-2 text-red-600">{toActionMessage(error, 'No se pudo importar esta fila.')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {resultHasErrors && !textPreview && <button type="button" className="wlink" onClick={() => adjustField(requiredMissing[0]?.key ?? 'model')}>Corregir en Ajustar importación</button>}
        </div>
      )}

      {fileError && step !== 'result' && (
        <div role="alert" className="import-error">
          <AlertCircle size={15} /> {fileError}
        </div>
      )}
      {step === 'summary' && requiredMissing.length > 0 && !(summary?.discardedRows > 0) && (
        <p className="mt-3 text-sm text-red-700">Falta mapear {requiredMissing.map((field) => field.label).join(', ')}.</p>
      )}
    </div>
  );

  const importLabel = `Importar ${countLabel(equipmentCount, nouns)}`;
  const backUpload = () => {
    requestRef.current += 1;
    setStep('upload');
    setFileError(null);
    setNotice(null);
    setTextPreview(false);
    setEditing(null);
  };

  const footer = (
    <div className="import-actions">
      {step === 'upload' && <>
        <button type="button" className="btn2 s" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn2 p" disabled={source === 'paste' && !text.trim()} onClick={() => source === 'paste' ? void handleText(text) : fileInputRef.current?.click()}>
          {source === 'paste' ? 'Analizar listado' : 'Elegir archivo'}
        </button>
      </>}
      {step === 'reading' && <button type="button" className="btn2 s" onClick={backUpload}>Volver</button>}
      {step === 'summary' && <>
        <button type="button" className="btn2 s" disabled={busy} onClick={backUpload}>Volver</button>
        {!unrelated && !textPreview && <button type="button" className="import-adjust" data-testid="import-adjust-open" disabled={busy} onClick={() => setStep('adjust')}>Ajustar importación</button>}
        {!unrelated && <button type="button" className="btn2 p" data-testid="import-confirm" aria-busy={importing} disabled={!canImport || importing} onClick={() => void handleImport()}>{importLabel} <ArrowRight size={15} aria-hidden="true" /></button>}
      </>}
      {step === 'adjust' && <button type="button" className="btn2 p" disabled={busy} onClick={() => setStep('summary')}>Listo</button>}
      {step === 'result' && <button type="button" className="btn2 p" onClick={onClose}>Cerrar</button>}
    </div>
  );

  return <Sheet title={title} onClose={onClose} busy={importing || applying} className="inv-import" footer={footer}>
    {body}
  </Sheet>;
};
