import { toUserMessage } from '../lib/user-message';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { Sheet, useEscape } from '../desk/ui';
import { assignColumn, fieldToColumn, mappingFromFields } from '../lib/import-mapping';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { parseWorkbook } from '../utils/parse-workbook';
import { expandTextRows, textRowError } from '../lib/text-import-review';
import { ImportPreviewList, previewColumns } from './ImportPreviewList';

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface GenericImportResult {
  imported: number;
  updated: number;
  errors: { row: number; message: string; [key: string]: unknown }[];
}

type Step = 'upload' | 'reading' | 'summary' | 'adjust' | 'result';

export const UNRELATED_IMPORT_NOTICE = 'Este archivo no parece tener equipos para importar.';

interface Props {
  fields: ImportFieldDef[];
  onImport: (rows: Record<string, string>[]) => Promise<GenericImportResult>;
  onClose: () => void;
  onStageChange?: (stage: 'file' | 'mapping' | 'review' | 'analyze') => void;
  title?: string;
  sheet?: boolean;
  nouns?: { one: string; many: string };
  unrelatedNotice?: string;
  onAnalyzeText?: (text: string) => Promise<ImportAnalysis>;
  onAnalyze: (sheets: ImportSheetPayload[]) => Promise<ImportAnalysis>;
  onApply: (sheets: ImportSheetPayload[], plan: ImportSheetPlan[], refreshMapping: boolean) => Promise<ImportAnalysis>;
}

function ignoreEscape() {}

function formatCount(count: number) {
  return new Intl.NumberFormat('es-AR').format(count);
}

function countLabel(count: number, nouns: { one: string; many: string }) {
  return `${formatCount(count)} ${count === 1 ? nouns.one : nouns.many}`;
}

function sheetLine(count: number, nouns: { one: string; many: string }, condition: string) {
  const noun = count === 1 ? nouns.one : nouns.many;
  const total = formatCount(count);
  if (condition === 'NUEVO') return `${total} ${noun} ${count === 1 ? 'nuevo' : 'nuevos'}`;
  if (condition === 'USADO') return `${total} ${noun} ${count === 1 ? 'usado' : 'usados'}`;
  if (condition === 'PRE-OWNED') return `${total} ${noun} pre-owned`;
  return `${total} ${noun}`;
}

export const ImportModal: React.FC<Props> = ({
  fields, onImport, onClose, onStageChange, title = 'Importar', sheet = false,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const editorRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => { if (editing !== null) editorRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [editing]);
  useEscape(sheet ? ignoreEscape : onClose);

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
    if (!onAnalyzeText) return;
    setFileError(null);
    if (!value.trim()) { setFileError('Pegá un listado de equipos para analizar.'); return; }
    if (new TextEncoder().encode(value).length > 100_000) { setFileError('El texto supera los 100 KB. Dividilo en listados más chicos.'); return; }
    const requestId = ++requestRef.current;
    setStep('reading');
    try {
      const analysis = await onAnalyzeText(value);
      if (requestRef.current !== requestId) return;
      applyResult(analysis);
      setStep('summary');
    } catch (error) {
      if (requestRef.current !== requestId) return;
      setFileError(error instanceof Error ? error.message : 'No se pudo analizar el listado.');
      setStep('upload');
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt' && onAnalyzeText) {
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
      setFileError(onAnalyzeText ? 'Formato no soportado. Usá .csv, .xlsx o .txt' : 'Formato no soportado. Usá .csv o .xlsx');
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
      setStep('reading');
      const analysis = await onAnalyze(nextSheets);
      if (requestRef.current !== requestId) return;
      applyResult(analysis);
      setStep('summary');
    } catch (error: unknown) {
      if (requestRef.current !== requestId) return;
      setFileError(toUserMessage(error, 'Error al leer el archivo'));
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
      setFileError(toUserMessage(error, 'No se pudo actualizar la importación.'));
    } finally {
      if (requestRef.current === requestId) setApplying(false);
    }
  };

  const included = plan.filter((item) => item.include);
  const requiredMissing = fields.filter((field) => field.required && included.some((item) => !item.mapping.some((column) => column.field === field.key)));
  const selectedRows = rows.filter((_, index) => !excluded.has(index));
  const equipmentCount = textPreview ? selectedRows.reduce((sum, row) => sum + Number(row.quantity), 0) : selectedRows.length;
  const validationError = textPreview ? selectedRows.map(textRowError).find(Boolean) ?? (equipmentCount > 2000 ? 'El listado supera los 2000 equipos.' : null) : null;
  const canImport = !applying && selectedRows.length > 0 && !validationError && (textPreview || (requiredMissing.length === 0 && included.length > 0));
  const unrelated = rows.length === 0 && (notice === unrelatedNotice || notice === 'Este texto no parece tener equipos para importar');
  const active = plan.find((item) => item.name === activeSheet) ?? plan[0];
  const activeRows = sheets.find((item) => item.name === active?.name)?.rows ?? [];
  const headerIndex = Math.max(0, (active?.headerRow ?? 1) - 1);
  const headers = (activeRows[headerIndex] ?? []).filter((header) => header.trim());
  const selected = active ? fieldToColumn(active.mapping) : {};

  const handleImport = async () => {
    setImporting(true);
    setFileError(null);
    try {
      const response = await onImport(textPreview ? expandTextRows(selectedRows) : selectedRows);
      setResult(response);
      setStep('result');
    } catch (error: unknown) {
      setFileError(toUserMessage(error, 'Error al importar'));
    } finally {
      setImporting(false);
    }
  };

  const headline = summary
    ? `Detectamos ${summary.sheetCount} ${summary.sheetCount === 1 ? 'hoja' : 'hojas'}, ${countLabel(summary.rowCount, nouns)}`
    : '';

  const subtitle = {
    upload: onAnalyzeText ? 'Elegí Excel, texto pegado o un archivo .txt' : 'Subí un archivo CSV o XLSX',
    reading: source === 'excel' ? 'Leyendo la planilla…' : 'Analizando el listado…',
    summary: unrelated
      ? (unrelatedNotice.includes('ventas') ? 'Sin ventas para importar' : unrelatedNotice.includes('clientes') ? 'Sin clientes para importar' : 'Sin equipos para importar')
      : 'Listo para importar',
    adjust: 'Ajustá hojas, encabezado o columnas',
    result: 'Importación completada',
  }[step];

  const body = (
    <div className={sheet ? 'inv-import-body' : 'overflow-y-auto flex-1 p-5'}>
      {step === 'upload' && (
        <div className="space-y-4">
          {onAnalyzeText && <div className="grid grid-cols-3 gap-2" role="group" aria-label="Origen del listado">
            {([['excel', 'Excel'], ['paste', 'Pegar listado'], ['txt', 'Subir .txt']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={source === value} onClick={() => { setSource(value); setFileError(null); }} className={`rounded-xl min-h-11 px-2 text-sm font-medium border ${source === value ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-200'}`}>{label}</button>)}
          </div>}
          {source === 'paste' ? <div className="space-y-3">
            <label htmlFor="inventory-paste" className="block text-sm font-medium text-gray-700">Listado de equipos</label>
            <textarea id="inventory-paste" value={text} onChange={(event) => setText(event.target.value)} rows={8} maxLength={100_000} placeholder={'iPhone 13 128GB Midnight 89% US$ 420\n13 pro max 256 azul bat 85 520usd'} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-base focus:outline-none focus:ring-2 focus:ring-black" />
            <p className="text-xs text-gray-500">Hasta 100 KB / 1000 líneas. Revisá y corregí los equipos antes de confirmar.</p>
            <button type="button" className="btn2 p" style={{ minHeight: 44 }} onClick={() => void handleText(text)}>Analizar listado</button>
          </div> : <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`inv-drop border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
          >
            <Upload size={32} className="text-gray-400" />
            <div className="text-center">
              <p className="font-medium text-gray-700">Arrastrá un archivo o hacé click para elegir</p>
              <p className="text-sm text-gray-400 mt-1">{source === 'txt' ? '.txt UTF-8 — máx. 100 KB / 1000 líneas' : '.csv, .xlsx — máx. 5000 filas'}</p>
            </div>
          </div>}
          <input
            ref={fileInputRef}
            type="file"
            accept={source === 'txt' ? '.txt,text/plain' : '.csv,.xlsx'}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {step === 'reading' && (
        <p className="text-sm text-gray-500" data-testid="import-reading">{source === 'excel' ? 'Leyendo la planilla…' : 'Analizando el listado… Podés revisar los equipos al terminar.'}</p>
      )}

      {step === 'summary' && summary && unrelated && (
        <div data-testid="import-unrelated" role="status" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
          <p className="text-sm font-medium text-gray-900">{notice || unrelatedNotice}</p>
        </div>
      )}

      {step === 'summary' && summary && !unrelated && (
        <div data-testid="import-summary" className="space-y-3">
          <p className="text-lg font-bold text-gray-900" data-testid="import-summary-count">{textPreview ? `Detectamos ${rows.length} filas · ${countLabel(equipmentCount, nouns)} para importar` : headline}</p>
          <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {summary.sheets.filter((item) => item.included).map((item) => (
              <li key={item.name} data-testid="import-sheet-summary" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-gray-500">{textPreview ? `${item.rows} filas reconocidas` : sheetLine(item.rows, nouns, item.condition)}</span>
              </li>
            ))}
          </ul>
          {summary.rowCount === 0 && (
            <p className="text-sm text-gray-600">No encontramos filas para importar. Podés ajustar el encabezado.</p>
          )}
          {rows.length > 0 && (
            <ImportPreviewList
              rows={rows}
              columns={previewColumns(fields)}
              currency={currency}
              layout={sheet ? 'cards' : 'table'}
              nouns={textPreview ? { one: 'fila', many: 'filas' } : nouns}
              review={textPreview ? review : undefined}
              excluded={excluded}
              onEdit={textPreview ? (index) => setEditing(index) : undefined}
            />
          )}
        </div>
      )}

      {step === 'summary' && textPreview && !unrelated && <div className="space-y-3 mt-3">
        <p className="text-xs text-gray-600">Revisá todos los datos. Si faltan moneda o condición se propone {currency} y USADO; el precio vacío requiere edición.</p>
        {excluded.size > 0 && <p className="text-sm text-gray-600">{excluded.size} filas excluidas · <button type="button" className="underline" onClick={() => setExcluded(new Set())}>Restaurar filas</button></p>}
        {editing !== null && rows[editing] && <fieldset ref={editorRef} className="rounded-xl border border-gray-200 p-3 space-y-3" data-testid="import-row-editor">
          <legend className="text-sm font-bold px-1">Revisar equipo · línea {review[editing]?.line}</legend>
          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{review[editing]?.original}</p>
          {review[editing]?.dudas.map((duda, index) => <p key={index} className="text-xs text-amber-900">{duda}</p>)}
          <div className="grid grid-cols-2 gap-3">
            {[...fields.filter((field) => !['grade', 'status'].includes(field.key)), { key: 'currency', label: 'Moneda' }, { key: 'serial', label: 'Serie' }, { key: 'quantity', label: 'Cantidad' }].map((field) => <label key={field.key} className="text-xs font-medium text-gray-700 min-w-0">{field.label}
              {['currency', 'condition'].includes(field.key) ? <select aria-label={field.label} value={rows[editing][field.key] ?? ''} onChange={(event) => setRows((current) => current.map((row, index) => index === editing ? { ...row, [field.key]: event.target.value } : row))} className="block w-full min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-base">
                {(field.key === 'currency' ? ['ARS', 'USD'] : ['USADO', 'NUEVO', 'PRE-OWNED', 'OUTLET']).map((value) => <option key={value}>{value}</option>)}
              </select> : <input aria-label={field.label} value={rows[editing][field.key] ?? ''} inputMode={['price', 'cost', 'quantity', 'imei'].includes(field.key) ? 'decimal' : undefined} onChange={(event) => setRows((current) => current.map((row, index) => index === editing ? { ...row, [field.key]: event.target.value } : row))} className="block w-full min-h-11 rounded-lg border border-gray-200 bg-white px-2 text-base" />}
            </label>)}
          </div>
          {textRowError(rows[editing]) && <p role="alert" className="text-sm text-red-700">{textRowError(rows[editing])}</p>}
          <div className="flex gap-3">
            <button type="button" className="btn2 s" style={{ minHeight: 44 }} onClick={() => { setExcluded((current) => new Set([...current, editing])); setEditing(null); }}>Excluir fila</button>
            <button type="button" className="btn2 p" style={{ minHeight: 44 }} onClick={() => setEditing(null)}>Listo</button>
          </div>
        </fieldset>}
        {validationError && <p role="alert" className="text-sm text-red-700">{validationError}</p>}
      </div>}
      {step === 'summary' && textPreview && discarded.length > 0 && <details className="mt-3 rounded-xl border border-gray-200 p-3" data-testid="import-discarded">
        <summary className="text-sm font-medium cursor-pointer">{discarded.length} {discarded.length === 1 ? 'línea descartada' : 'líneas descartadas'}</summary>
        <ul className="mt-2 space-y-2">{discarded.map((item) => <li key={item.line} className="text-xs text-gray-600 break-words">Línea {item.line}: {item.original} — {item.reason}</li>)}</ul>
      </details>}

      {step === 'adjust' && active && (
        <div className="space-y-5" data-testid="import-adjust">
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

          <div className="border border-gray-200 rounded-xl overflow-hidden">
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
                    <tr key={field.key}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {field.label}
                        {field.required && <span className="text-red-500 text-xs"> *</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            aria-label={field.label}
                            data-testid={`import-field-${field.key}`}
                            value={selected[field.key] ?? ''}
                            onChange={(event) => {
                              const mapping = mappingFromFields(headers, assignColumn(selected, field.key, event.target.value));
                              void reapply(plan.map((sheetPlan) => sheetPlan.name === active.name ? { ...sheetPlan, mapping } : sheetPlan), false);
                            }}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          >
                            <option value="">— Sin mapear —</option>
                            {headers.map((header) => (
                              <option key={header} value={header} disabled={selected[field.key] !== header && taken.has(header)}>{header}</option>
                            ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <CheckCircle2 size={22} className="text-green-600 shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Importación completada</p>
              <p className="text-sm text-green-700 mt-0.5">
                {result.imported} creados · {result.updated} actualizados
                {result.errors.length > 0 && ` · ${result.errors.length} errores`}
              </p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-red-50">
                  {result.errors.map((error, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-gray-500">{error.row}</td>
                      <td className="px-3 py-2 text-red-600">{toUserMessage(error, 'No se pudo importar esta fila.')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {fileError && step !== 'result' && (
        <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={15} /> {fileError}
        </div>
      )}
      {step === 'summary' && requiredMissing.length > 0 && (
        <p className="mt-3 text-sm text-red-700">Falta mapear {requiredMissing.map((field) => field.label).join(', ')}.</p>
      )}
    </div>
  );

  const importLabel = importing ? 'Importando…' : `Importar ${countLabel(equipmentCount, nouns)}`;
  const backUpload = () => {
    requestRef.current += 1;
    setStep('upload');
    setFileError(null);
    setNotice(null);
    setTextPreview(false);
    setEditing(null);
  };

  const modalFooter = (
    <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
      {step === 'upload' && <button type="button" onClick={onClose} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Cancelar</button>}
      {step === 'summary' && unrelated && (
        <button type="button" onClick={backUpload} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Volver</button>
      )}
      {step === 'summary' && !unrelated && (
        <>
          <button type="button" onClick={backUpload} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Volver</button>
          {!textPreview && <button type="button" data-testid="import-adjust-open" onClick={() => setStep('adjust')} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Ajustar importación</button>}
          <button type="button" data-testid="import-confirm" onClick={() => void handleImport()} disabled={!canImport || importing} className="btn2 p" style={{ width: 'auto', height: 44, padding: '0 18px' }}>
            {importLabel} <ArrowRight size={15} />
          </button>
        </>
      )}
      {step === 'adjust' && (
        <>
          <button type="button" onClick={() => setStep('summary')} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Volver</button>
          <button type="button" onClick={() => setStep('summary')} className="btn2 p" style={{ width: 'auto', height: 44, padding: '0 18px' }}>Listo</button>
        </>
      )}
      {step === 'result' && <button type="button" onClick={onClose} className="btn2 p" style={{ width: 'auto', height: 44, padding: '0 18px' }}>Cerrar</button>}
    </div>
  );

  const sheetFooter = step === 'upload' ? (
    <div className="sacts one"><button type="button" className="btn2 s" onClick={onClose}>Cancelar</button></div>
  ) : step === 'summary' && unrelated ? (
    <div className="sacts one"><button type="button" className="btn2 s" onClick={backUpload}>Volver</button></div>
  ) : step === 'summary' ? (
    <div className="sacts">
      <button type="button" className="btn2 s" data-testid="import-adjust-open" onClick={() => textPreview ? backUpload() : setStep('adjust')}>{textPreview ? 'Volver' : 'Ajustar importación'}</button>
      <button type="button" className="btn2 p" data-testid="import-confirm" disabled={!canImport || importing} onClick={() => void handleImport()}>{importLabel}</button>
    </div>
  ) : step === 'adjust' ? (
    <div className="sacts one"><button type="button" className="btn2 p" onClick={() => setStep('summary')}>Listo</button></div>
  ) : step === 'result' ? (
    <div className="sacts one"><button type="button" className="btn2 p" onClick={onClose}>Cerrar</button></div>
  ) : null;

  if (sheet) {
    return (
      <Sheet title={title} subtitle={subtitle} onClose={onClose} className="inv-import">
        {body}
        {sheetFooter}
      </Sheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {body}
        {modalFooter}
      </motion.div>
    </motion.div>
  );
};
