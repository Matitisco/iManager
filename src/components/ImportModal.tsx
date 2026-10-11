import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { Sheet } from '../desk/ui';
import { assignColumn, fieldToColumn, mappingFromFields } from '../lib/import-mapping';
import type { ImportAnalysis, ImportSheetPayload, ImportSheetPlan } from '../services/import-api';
import { parseWorkbook } from '../utils/parse-workbook';
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
  title?: string;
  sheet?: boolean;
  nouns?: { one: string; many: string };
  unrelatedNotice?: string;
  onAnalyze: (sheets: ImportSheetPayload[]) => Promise<ImportAnalysis>;
  onApply: (sheets: ImportSheetPayload[], plan: ImportSheetPlan[], refreshMapping: boolean) => Promise<ImportAnalysis>;
}

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
  fields, onImport, onClose, title = 'Importar', sheet = false,
  nouns = { one: 'fila', many: 'filas' }, unrelatedNotice = UNRELATED_IMPORT_NOTICE, onAnalyze, onApply,
}) => {
  const [step, setStep] = useState<Step>('upload');
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

  const applyResult = (analysis: ImportAnalysis) => {
    setPlan(analysis.plan);
    setRows(analysis.rows);
    setSummary(analysis.summary);
    setCurrency(analysis.currency);
    setNotice(analysis.notice);
    setActiveSheet((current) => analysis.plan.some((item) => item.name === current) ? current : analysis.plan[0]?.name ?? '');
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setFileError('Formato no soportado. Usá .csv o .xlsx');
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
      setFileError(error instanceof Error ? error.message : 'Error al leer el archivo');
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
      setFileError(error instanceof Error ? error.message : 'No se pudo actualizar la importación.');
    } finally {
      if (requestRef.current === requestId) setApplying(false);
    }
  };

  const included = plan.filter((item) => item.include);
  const requiredMissing = fields.filter((field) => field.required && included.some((item) => !item.mapping.some((column) => column.field === field.key)));
  const canImport = !applying && rows.length > 0 && requiredMissing.length === 0 && included.length > 0;
  const unrelated = rows.length === 0 && notice === unrelatedNotice;
  const active = plan.find((item) => item.name === activeSheet) ?? plan[0];
  const activeRows = sheets.find((item) => item.name === active?.name)?.rows ?? [];
  const headerIndex = Math.max(0, (active?.headerRow ?? 1) - 1);
  const headers = (activeRows[headerIndex] ?? []).filter((header) => header.trim());
  const selected = active ? fieldToColumn(active.mapping) : {};

  const handleImport = async () => {
    setImporting(true);
    setFileError(null);
    try {
      const response = await onImport(rows);
      setResult(response);
      setStep('result');
    } catch (error: unknown) {
      setFileError(error instanceof Error ? error.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const headline = summary
    ? `Detectamos ${summary.sheetCount} ${summary.sheetCount === 1 ? 'hoja' : 'hojas'}, ${countLabel(summary.rowCount, nouns)}`
    : '';

  const subtitle = {
    upload: 'Subí un archivo CSV o XLSX',
    reading: 'Leyendo la planilla…',
    summary: unrelated
      ? (unrelatedNotice.includes('ventas') ? 'Sin ventas para importar' : unrelatedNotice.includes('clientes') ? 'Sin clientes para importar' : 'Sin equipos para importar')
      : 'Listo para importar',
    adjust: 'Ajustá hojas, encabezado o columnas',
    result: 'Importación completada',
  }[step];

  const body = (
    <div className={sheet ? 'inv-import-body' : 'overflow-y-auto flex-1 p-5'}>
      {step === 'upload' && (
        <div>
          <div
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
              <p className="text-sm text-gray-400 mt-1">.csv, .xlsx — máx. 5000 filas</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>
      )}

      {step === 'reading' && (
        <p className="text-sm text-gray-500" data-testid="import-reading">Leyendo la planilla…</p>
      )}

      {step === 'summary' && summary && unrelated && (
        <div data-testid="import-unrelated" role="status" className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5">
          <p className="text-sm font-medium text-gray-900">{unrelatedNotice}</p>
        </div>
      )}

      {step === 'summary' && summary && !unrelated && (
        <div data-testid="import-summary" className="space-y-3">
          <p className="text-lg font-bold text-gray-900" data-testid="import-summary-count">{headline}</p>
          <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100">
            {summary.sheets.filter((item) => item.included).map((item) => (
              <li key={item.name} data-testid="import-sheet-summary" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-gray-800">{item.name}</span>
                <span className="text-gray-500">{sheetLine(item.rows, nouns, item.condition)}</span>
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
              nouns={nouns}
            />
          )}
        </div>
      )}

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
                      <td className="px-3 py-2 text-red-600">{error.message}</td>
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

  const importLabel = importing ? 'Importando…' : `Importar ${countLabel(rows.length, nouns)}`;
  const backUpload = () => {
    requestRef.current += 1;
    setStep('upload');
    setFileError(null);
    setNotice(null);
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
          <button type="button" data-testid="import-adjust-open" onClick={() => setStep('adjust')} className="btn2 s" style={{ width: 'auto', height: 44, padding: '0 16px' }}>Ajustar importación</button>
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
      <button type="button" className="btn2 s" data-testid="import-adjust-open" onClick={() => setStep('adjust')}>Ajustar importación</button>
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
