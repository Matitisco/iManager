import { columnHasData, columnLetter, importColumns, ImportColumnCards } from './ImportColumnCards';
import type { CustomFieldDefinition, CustomFieldInput } from '../services/custom-fields-api';
import { ReplayValue } from '../desk/replay-privacy';
import { DeskSelect } from '../desk/select';
import { toActionMessage } from '../lib/user-message';
import React, { useEffect, useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle2, ArrowRight, Check } from 'lucide-react';
import { Sheet } from '../desk/ui';
import { assignColumn, columnKey, fieldToColumn, mappingFromFields, planColumns, updatePlanMapping } from '../lib/import-mapping';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { parseWorkbook } from '../utils/parse-workbook';
import { expandTextRows, textRowError } from '../lib/text-import-review';
import { parseImportNumber } from '../lib/import-number';
import { ImportPreviewList, previewColumns } from './ImportPreviewList';
import { ListSkeleton } from '../desk/list-skeleton';
import './ImportModal.css';
import { IMPORT_DISCARD_REASONS, IMPORT_DISCARD_LABELS, type ImportDiagnostics } from '../lib/import-diagnostics';

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface GenericImportResult {
  warnings?: { row: number; message: string }[];
  diagnostics?: ImportDiagnostics;
  priceToDefine?: number;
  imported: number;
  updated: number;
  errors: { row: number; message: string; [key: string]: unknown }[];
}

type Step = 'upload' | 'reading' | 'summary' | 'adjust' | 'result';
type AdjustStep = 'columns' | 'summary';

export const UNRELATED_IMPORT_NOTICE = 'Este archivo no parece tener equipos para importar.';

interface Props {
  onFilterPriceToDefine?: () => void;
  existingImeis?: readonly string[];
  fields: ImportFieldDef[];
  customFieldDefinitions?: CustomFieldDefinition[];
  customFieldDefinitionsError?: string | null;
  onImport: (rows: Record<string, string>[], definitions?: CustomFieldInput[]) => Promise<GenericImportResult>;
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

function DiscardNotice({ diagnostics, zeroRows = false, children }: {
  diagnostics: ImportDiagnostics | null | undefined;
  zeroRows?: boolean;
  children?: React.ReactNode;
}) {
  if (!diagnostics?.discardedRows) return null;
  const reasons = IMPORT_DISCARD_REASONS.filter(reason => (diagnostics.discardedByReason[reason] ?? 0) > 0);
  const onlyMissingModel = zeroRows && reasons.length === 1 && reasons[0] === 'missing_model';
  return <div className="import-guidance" role="status" data-testid="import-skipped-notice">
    <b>{diagnostics.discardedRows} {diagnostics.discardedRows === 1 ? 'fila descartada' : 'filas descartadas'}{onlyMissingModel ? ' por falta de modelo.' : '.'}</b>
    {!onlyMissingModel && <ul>{reasons.map(reason =>
      <li key={reason}>{IMPORT_DISCARD_LABELS[reason]}: {diagnostics.discardedByReason[reason]}{diagnostics.rejected?.filter(item => item.reason === reason).map(item => ` — fila ${item.row}: ${item.message}`).join('')}</li>)}</ul>}
    {children}
  </div>;
}

export const ImportModal: React.FC<Props> = ({
  customFieldDefinitions = [], customFieldDefinitionsError, fields, onImport, onClose, onStageChange, onFilterPriceToDefine, existingImeis = [], title = 'Importar',
  nouns = { one: 'fila', many: 'filas' }, unrelatedNotice = UNRELATED_IMPORT_NOTICE, onAnalyze, onApply, onAnalyzeText,
}) => {
  const isInventory = fields.some(field => field.key === 'model') && fields.some(field => field.key === 'price');
  const [draftDefinitions, setDraftDefinitions] = useState<CustomFieldInput[]>([]);
  const [source, setSource] = useState<'excel' | 'paste' | 'txt'>('excel');
  const [text, setText] = useState('');
  const [textPreview, setTextPreview] = useState(false);
  const [review, setReview] = useState<NonNullable<ImportAnalysis['review']>>([]);
  const [discarded, setDiscarded] = useState<NonNullable<ImportAnalysis['discarded']>>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<Step>('upload');
  const [adjustStep, setAdjustStep] = useState<AdjustStep>('columns');
  const [visibleColumns, setVisibleColumns] = useState<Set<number>>(new Set());
  const [targetColumn, setTargetColumn] = useState<number | null>(null);
  const [flashingColumn, setFlashingColumn] = useState<{ index: number } | null>(null);
  const [readingHeight, setReadingHeight] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { onStageChange?.(step === 'upload' ? 'file' : step === 'reading' ? 'analyze' : step === 'adjust' ? 'mapping' : 'review'); }, [step, onStageChange]);
  useEffect(() => {
    const scroll = bodyRef.current?.closest('.sheet-scroll');
    if (step === 'adjust' && scroll) scroll.scrollTop = 0;
  }, [step, adjustStep]);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ImportSheetPayload[]>([]);
  const [plan, setPlan] = useState<ImportSheetPlan[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [summary, setSummary] = useState<ImportAnalysis['summary'] | null>(null);
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [missingRecommendedFields, setMissingRecommendedFields] = useState<string[]>([]);
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [notice, setNotice] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState('');
  const [applying, setApplying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GenericImportResult | null>(null);
  const [targetField, setTargetField] = useState<string | null>(null);
  useEffect(() => {
    if (step !== 'adjust' || (adjustStep !== 'columns' && isInventory) || (!targetField && targetColumn === null) || applying) return;
    if (isInventory && targetColumn !== null) {
      const card = bodyRef.current?.querySelector<HTMLElement>(`[data-column-index="${targetColumn}"]`);
      if (!card) return;
      card.scrollIntoView?.({ block: 'center' });
      card.focus({ preventScroll: true });
      setFlashingColumn({ index: targetColumn });
      setTargetField(null);
      setTargetColumn(null);
      return;
    }
    const field = (targetField ? bodyRef.current?.querySelector<HTMLElement>(`[data-testid="import-field-${targetField}"]`) : null)
      ?? (targetColumn !== null ? bodyRef.current?.querySelector<HTMLElement>(`[data-column-index="${targetColumn}"] .imp-segments button`) : null)
      ?? bodyRef.current?.querySelector<HTMLElement>('.imp-card:has(.imp-discarded) .imp-segments button') ?? bodyRef.current?.querySelector<HTMLElement>('.imp-card .imp-segments button');
    field?.scrollIntoView?.({ block: 'center' });
    field?.focus({ preventScroll: true });
    setTargetField(null);
    setTargetColumn(null);
  }, [step, adjustStep, targetField, targetColumn, applying, visibleColumns, isInventory]);
  useEffect(() => {
    if (!flashingColumn) return;
    const timer = window.setTimeout(() => setFlashingColumn(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flashingColumn]);
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
    setDraftDefinitions(current => {
      const keys = new Set([...customFieldDefinitions, ...current].map(definition => definition.key));
      const additions = (analysis.suggestedDefinitions ?? []).filter(definition => {
        if (keys.has(definition.key)) return false;
        keys.add(definition.key);
        return true;
      });
      return [...current, ...additions];
    });
    setTextPreview(Boolean(analysis.review));
    setReview(analysis.review ?? []);
    setDiscarded(analysis.discarded ?? []);
    setEditing(null);
    setExcluded(new Set());
    setRows(analysis.review ? analysis.rows.map((row) => ({ ...row, currency: row.currency || analysis.currency, condition: row.condition || 'USADO' })) : analysis.rows);
    setSummary(analysis.summary);
    setDiagnostics(analysis.diagnostics ?? null);
    setMissingRequiredFields(analysis.missingRequiredFields ?? analysis.diagnostics?.missingRequiredFields ?? []);
    setMissingRecommendedFields(analysis.missingRecommendedFields ?? analysis.diagnostics?.missingRecommendedFields ?? []);
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
  const requiredMissing = fields.filter((field) => missingRequiredFields.includes(field.key)
    || (field.required && included.some((item) => !item.mapping.some((column) => column.field === field.key))));
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
  const columns = active ? planColumns(activeRows, active) : [];
  const inventoryColumns = active ? importColumns(active, activeRows) : [];
  const selected = active ? fieldToColumn(active.mapping) : {};
  const missingPriceColumn = isInventory && !textPreview && (missingRecommendedFields.includes('price')
    || included.some(item => !item.mapping.some(column => column.field === 'price')));
  const noPriceRows = isInventory ? selectedRows.filter(row => !row.price?.trim()).length : 0;
  const pendingColumns = (sheet = active) => {
    if (!sheet) return new Set<number>();
    const sheetRows = sheets.find(item => item.name === sheet.name)?.rows ?? [];
    return new Set(importColumns(sheet, sheetRows).filter(column => column.field === 'ignore'
      && (requiredMissing.some(field => field.key === 'model') || columnHasData(sheet, sheetRows, column.columnIndex))).map(column => column.columnIndex));
  };
  // Only a different sheet/header resets the review. Reapply can replace plans and
  // normalize ranges after destination edits; those responses must retain cards.
  useEffect(() => {
    if (step === 'adjust' && adjustStep === 'columns') {
      const next = pendingColumns();
      if (targetColumn !== null) next.add(targetColumn);
      setVisibleColumns(next);
    }
  }, [active?.name, active?.headerRow]);
  const showColumns = (columnIndex?: number, sheet = active) => {
    const pending = pendingColumns(sheet);
    const reset = step !== 'adjust' || sheet?.name !== active?.name;
    setVisibleColumns(current => {
      const next = new Set(reset ? pending : [...current, ...pending]);
      if (columnIndex !== undefined) next.add(columnIndex);
      return next;
    });
    setAdjustStep('columns');
    setTargetColumn(columnIndex ?? null);
  };
  const openAdjust = () => {
    showColumns();
    setTargetField(null);
    setTargetColumn(null);
    setStep('adjust');
  };
  const adjustField = (key: string) => {
    const sheet = included.find(item => !item.mapping.some(column => column.field === key));
    if (sheet) setActiveSheet(sheet.name);
    if (isInventory) {
      const nextSheet = sheet ?? active;
      const nextRows = sheets.find(item => item.name === nextSheet?.name)?.rows ?? [];
      const nextColumns = nextSheet ? importColumns(nextSheet, nextRows) : [];
      const candidate = nextColumns.find(column => column.field === key) ?? nextColumns.find(column => column.field === 'ignore') ?? nextColumns[0];
      showColumns(candidate?.columnIndex, nextSheet);
    }
    setTargetField(key);
    setStep('adjust');
  };

  const handleImport = async () => {
    if (importing || !canImport) return;
    setImporting(true);
    setFileError(null);
    try {
      const definitions = draftDefinitions.filter(definition => selectedRows.some(row => Object.hasOwn(row, `custom:${definition.key}`)));
      const importingRows = textPreview ? expandTextRows(selectedRows) : selectedRows;
      const response = definitions.length ? await onImport(importingRows, definitions) : await onImport(importingRows);
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
    <div ref={bodyRef} className="inv-import-body" style={step === 'reading' ? { minHeight: readingHeight } : undefined}>
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
          <DiscardNotice diagnostics={diagnostics} zeroRows={summary.rowCount === 0}>
            {summary.rowCount === 0 && (diagnostics?.discardedByReason.missing_model ?? 0) > 0 && <button type="button" className="wlink" onClick={() => adjustField('model')}>Asignar columna de modelo</button>}
          </DiscardNotice>
          {summary.rowCount > 0 && (diagnostics?.discardedByReason.missing_model ?? 0) > 0 && <button type="button" className="wlink" onClick={() => adjustField('model')}>Asignar columna de modelo</button>}
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
          {summary.rowCount === 0 && !diagnostics?.discardedRows && <div className="import-guidance" role="status">
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
          <p data-ph-mask className="text-xs text-gray-600 whitespace-pre-wrap break-words">{review[editing]?.original}</p>
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
        <ul className="mt-2 space-y-2">{discarded.map((item) => <li key={item.line} className="text-xs text-gray-600 break-words">Línea {item.line}: <ReplayValue>{item.original}</ReplayValue> — {item.reason}</li>)}</ul>
      </details>}

      {step === 'adjust' && active && (
        <div className={isInventory ? 'imp-adjust' : 'space-y-5'} data-testid="import-adjust">
          {isInventory && <nav className="imp-steps" aria-label="Pasos de ajuste de importación">
            {(['columns', 'summary'] as const).map((item, index) => {
              const current = ['columns', 'summary'].indexOf(adjustStep);
              const label = ['Columnas', 'Resumen'][index];
              return <button key={item} type="button" className={index === current ? 'on' : index < current ? 'done' : ''}
                aria-current={index === current ? 'step' : undefined} disabled={busy || index > current}
                onClick={() => { if (index !== current) { if (item === 'columns') showColumns(); else setAdjustStep(item); } }}>
                {index < current && <Check size={16} aria-hidden="true" />}{label}
              </button>;
            })}
          </nav>}
          {requiredMissing.length > 0 && <div className="import-guidance missing" role="alert"><b>Falta asignar {requiredMissing.map(field => field.label).join(', ')}.</b><p>Asigná los campos obligatorios para importar.</p><button type="button" className="wlink" onClick={() => adjustField(requiredMissing[0].key)}>Ir al campo obligatorio</button></div>}
          {(!isInventory || adjustStep === 'columns') && (plan.length > 1 || !active.include || !isInventory) && <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hojas</p>
            {plan.map((item) => (
              <label key={item.name} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm cursor-pointer ${active.name === item.name ? 'border-gray-900' : 'border-gray-200'}`}>
                <input
                  type="checkbox"
                  className="accent-black"
                  style={{ accentColor: '#16181D' }}
                  data-testid={`import-sheet-${item.name}`}
                  checked={item.include}
                  disabled={isInventory && busy}
                  onChange={() => {
                    void reapply(plan.map((sheetPlan) => sheetPlan.name === item.name ? { ...sheetPlan, include: !sheetPlan.include } : sheetPlan), false);
                  }}
                />
                <button type="button" disabled={isInventory && busy} className="flex-1 text-left font-medium text-gray-800" onClick={() => setActiveSheet(item.name)}>
                  {item.name}
                </button>
              </label>
            ))}
          </div>}

          {isInventory ? <>
            {customFieldDefinitionsError && <div className="ferr" role="alert">{customFieldDefinitionsError}</div>}
            {adjustStep === 'columns' && <details className="imp-header-settings">
              <summary>Encabezado · {active.headerRow === 0 ? 'Sin encabezado' : `Fila ${active.headerRow}`}</summary>
              <div className="imp-header-mode" role="group" aria-label="Encabezado del archivo">
                <button type="button" aria-pressed={active.headerRow === 0} disabled={busy} onClick={() => { void reapply(plan.map(item => item.name === active.name ? { ...item, headerRow: 0, dataStartRow: 1 } : item), true); }}>Sin encabezado</button>
                <button type="button" aria-pressed={active.headerRow > 0} disabled={busy} onClick={() => { void reapply(plan.map(item => item.name === active.name ? { ...item, headerRow: 1, dataStartRow: 2 } : item), true); }}>Fila 1 es encabezado</button>
                {active.headerRow > 0 && <label className="imp-header-row"><span>Fila de encabezado</span><input aria-label="Fila de encabezado" type="number" min={1} max={activeRows.length} value={active.headerRow} disabled={busy} onChange={event => { const headerRow = Number(event.target.value); if (headerRow >= 1 && headerRow <= activeRows.length) void reapply(plan.map(item => item.name === active.name ? { ...item, headerRow, dataStartRow: headerRow + 1 } : item), true); }} /></label>}
              </div>
            </details>}
            {adjustStep === 'columns' && (visibleColumns.size ? <ImportColumnCards key={`${active.name}:${active.headerRow}`} visibleColumns={visibleColumns} flashingColumn={flashingColumn?.index} active={active} rows={activeRows} fields={fields} definitions={customFieldDefinitions} drafts={draftDefinitions} onDraft={definition => setDraftDefinitions(current => [...current, definition])} disabled={busy || Boolean(customFieldDefinitionsError)} onChange={next => {
              const required = [...new Set([...fields.filter(field => field.required).map(field => field.key), ...missingRequiredFields])];
              const updated = updatePlanMapping(active, next.mapping, required);
              void reapply(plan.map(item => item.name === active.name ? updated : item), false);
            }} /> : <div className="wempty">No hay columnas para revisar</div>)}
            {adjustStep === 'summary' && <div className="imp-sum">
              {(['existing', 'custom', 'ignored'] as const).map(group => {
                const items = inventoryColumns.filter(column => group === 'custom' ? column.field.startsWith('custom:') : group === 'ignored' ? column.field === 'ignore' : column.field !== 'ignore' && !column.field.startsWith('custom:'));
                const label = group === 'existing' ? 'Campos existentes' : group === 'custom' ? 'Campos nuevos' : 'Descartadas';
                return <section key={group} className="imp-sg" aria-label={label}>
                  <h4>{label}<span className="imp-pend">{items.length}</span></h4>
                  {items.map(column => {
                    const destination = group === 'ignored' ? (columnHasData(active, activeRows, column.columnIndex) ? 'Con datos' : 'Sin datos')
                      : group === 'custom' ? [...customFieldDefinitions, ...draftDefinitions].find(field => `custom:${field.key}` === column.field)?.label ?? column.field
                      : fields.find(field => field.key === column.field)?.label ?? column.field;
                    return <button key={column.columnIndex} type="button" className="imp-rw" aria-label={`Cambiar columna ${columnLetter(column.columnIndex)}: ${column.header}`} disabled={busy} onClick={() => showColumns(column.columnIndex)}>
                      <span className="imp-l">{columnLetter(column.columnIndex)}</span><span className="imp-v"><ReplayValue>{column.header}</ReplayValue></span><span className="imp-d"><ReplayValue>{destination}</ReplayValue></span>
                      <span className="wlink imp-change">Cambiar</span>
                    </button>;
                  })}
                </section>;
              })}
            </div>}
          </> : (
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
                  <span data-ph-mask={selectedRow ? undefined : true} className="truncate">{row.filter(Boolean).slice(0, 5).join(' · ') || 'fila vacía'}</span>
                </button>
              );
            })}
          </div>
          )}

          {!isInventory && <div className="import-mapping border border-gray-200 rounded-xl">
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
                  const required = field.required || missingRequiredFields.includes(field.key);
                  return (
                    <tr key={field.key} className={required && !selected[field.key] ? 'import-field-missing' : field.key === 'price' && !selected.price ? 'import-field-price' : undefined}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {field.label}
                        {required && <span className="text-red-500 text-xs"> *</span>}
                        {required && !selected[field.key] && <small>Obligatorio sin asignar</small>}
                        {field.key === 'price' && !selected.price && <small>Opcional · a definir</small>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <DeskSelect label={field.label} invalid={required && !selected[field.key]} data-testid={`import-field-${field.key}`} value={selected[field.key] ?? ''}
                            onChange={(value) => {
                              const mapping = mappingFromFields(columns, assignColumn(selected, field.key, value));
                              const required = [...new Set([
                                ...fields.filter(item => item.required).map(item => item.key),
                                ...(summary.sheets.find(item => item.name === active.name)?.diagnostics?.missingRequiredFields ?? missingRequiredFields),
                              ])];
                              void reapply(plan.map(sheetPlan => sheetPlan.name === active.name
                                ? updatePlanMapping(sheetPlan, mapping, required) : sheetPlan), false);
                            }}
                            options={[{ value: '', label: '— Sin mapear —' }, ...columns.map(column => ({ value: columnKey(column), label: column.header, disabled: selected[field.key] !== columnKey(column) && taken.has(columnKey(column)) }))]} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
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
            <b>{result.priceToDefine} {result.priceToDefine === 1 ? 'equipo quedó' : 'equipos quedaron'} con precio a definir</b>
            {onFilterPriceToDefine && <button type="button" className="wlink" onClick={onFilterPriceToDefine}>Ver equipos con precio a definir</button>}
          </div>}
          <DiscardNotice diagnostics={result.diagnostics} />
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
      {step === 'summary' && summary?.rowCount !== 0 && requiredMissing.length > 0 && (
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
        {(!unrelated || isInventory) && !textPreview && <button type="button" className="import-adjust" data-testid="import-adjust-open" disabled={busy} onClick={openAdjust}>Ajustar importación</button>}
        {!unrelated && <button type="button" className="btn2 p" data-testid="import-confirm" aria-busy={importing} disabled={!canImport || importing || Boolean(customFieldDefinitionsError)} onClick={() => void handleImport()}>{importLabel} <ArrowRight size={15} aria-hidden="true" /></button>}
      </>}
      {step === 'adjust' && !isInventory && <button type="button" className="btn2 p" disabled={busy} onClick={() => setStep('summary')}>Listo</button>}
      {step === 'adjust' && isInventory && <>
        <button type="button" className="btn2 s" disabled={busy} onClick={() => adjustStep === 'columns' ? setStep('summary') : showColumns()}>Atrás</button>
        {adjustStep === 'summary' ? <button type="button" className="btn2 p" data-testid="import-confirm" disabled={busy || !canImport || Boolean(customFieldDefinitionsError)} onClick={() => void handleImport()}>{importLabel}</button>
          : <button type="button" className="btn2 p" disabled={busy || (adjustStep === 'columns' && visibleColumns.size === 0 && requiredMissing.some(field => field.key === 'model'))} onClick={() => setAdjustStep('summary')}>Siguiente</button>}
      </>}
      {step === 'result' && <button type="button" className="btn2 p" onClick={onClose}>Cerrar</button>}
    </div>
  );

  return <Sheet title={step === 'adjust' && isInventory ? 'Ajustar importación' : title} onClose={onClose} busy={importing || applying} className={`inv-import${step === 'adjust' && isInventory ? ' imp-adjust-sheet' : ''}`} footer={footer}>
    {body}
  </Sheet>;
};
