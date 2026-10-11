import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Upload, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { Sheet } from '../desk/ui';
import { assignColumn } from '../lib/import-mapping';
import type { DetectImportResponse } from '../services/import-api';
import { parseWorkbook, trimGrid } from '../utils/parse-workbook';

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

type Step = 'upload' | 'detecting' | 'summary' | 'adjust' | 'result';

type Grid = { name: string; rows: string[][] };

type AdjustSheet = {
  name: string;
  include: boolean;
  headerRow: number;
  mapping: Record<string, string>;
};

const CONDITION_LABEL: Record<string, string> = {
  NUEVO: 'Nuevo',
  USADO: 'Usado',
  OUTLET: 'Outlet',
  'PRE-OWNED': 'Pre-owned',
};

interface Props {
  fields: ImportFieldDef[];
  onImport: (rows: Record<string, string>[]) => Promise<GenericImportResult>;
  onClose: () => void;
  title?: string;
  sheet?: boolean;
  itemLabel?: { one: string; many: string };
  onDetect: (input: {
    sheets: Grid[];
    overrides?: { name: string; include: boolean; headerRow: number; mapping?: Record<string, string> }[];
  }) => Promise<DetectImportResponse>;
}

export const ImportModal: React.FC<Props> = ({
  fields, onImport, onClose, title = 'Importar', sheet = false, itemLabel = { one: 'fila', many: 'filas' }, onDetect,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [grids, setGrids] = useState<Grid[]>([]);
  const [plan, setPlan] = useState<DetectImportResponse | null>(null);
  const [adjust, setAdjust] = useState<AdjustSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GenericImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const noun = (count: number) => (count === 1 ? itemLabel.one : itemLabel.many);
  const included = plan?.sheets.filter((item) => item.include) ?? [];
  const rowCount = plan?.totals.rows ?? included.reduce((sum, item) => sum + item.rows.length, 0);
  const sheetCount = plan?.totals.sheets ?? included.length;

  const runDetect = async (
    nextGrids: Grid[],
    overrides?: { name: string; include: boolean; headerRow: number; mapping?: Record<string, string> }[],
  ) => {
    const id = requestId.current + 1;
    requestId.current = id;
    setApplying(true);
    setFileError(null);
    try {
      const detected = await onDetect({ sheets: nextGrids, overrides });
      if (requestId.current !== id) return null;
      setPlan(detected);
      setAdjust(detected.sheets.map((item) => ({
        name: item.name,
        include: item.include,
        headerRow: item.headerRow,
        mapping: item.mapping,
      })));
      setActiveSheet((current) => detected.sheets.some((item) => item.name === current) ? current : (detected.sheets.find((item) => item.include)?.name ?? detected.sheets[0]?.name ?? ''));
      setTouched({});
      return detected;
    } catch (error: unknown) {
      if (requestId.current !== id) return null;
      setFileError(error instanceof Error ? error.message : 'No se pudo leer el archivo. Probá de nuevo.');
      return null;
    } finally {
      if (requestId.current === id) setApplying(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setFileError('Formato no soportado. Usá .csv o .xlsx');
      return;
    }
    try {
      const workbook = await parseWorkbook(file);
      const next = workbook.sheetNames
        .map((name) => ({ name, rows: trimGrid(workbook.getSheet(name)).slice(0, 2000) }))
        .filter((item) => item.rows.length > 0);
      if (next.length === 0) {
        setFileError('El archivo está vacío');
        return;
      }
      setGrids(next);
      setStep('detecting');
      const detected = await runDetect(next);
      setStep(detected ? 'summary' : 'upload');
    } catch (error: unknown) {
      setFileError(error instanceof Error ? error.message : 'Error al leer el archivo');
      setStep('upload');
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const applyAdjust = async () => {
    const detected = await runDetect(grids, adjust.map((item) => ({
      name: item.name,
      include: item.include,
      headerRow: item.headerRow,
      ...(touched[item.name] ? { mapping: item.mapping } : {}),
    })));
    if (detected) setStep('summary');
  };

  const changeHeader = async (name: string, headerRow: number) => {
    const next = adjust.map((item) => (item.name === name ? { ...item, headerRow } : item));
    setAdjust(next);
    setTouched((current) => ({ ...current, [name]: false }));
    const detected = await runDetect(grids, next.map((item) => ({
      name: item.name,
      include: item.include,
      headerRow: item.headerRow,
      ...(item.name !== name && touched[item.name] ? { mapping: item.mapping } : {}),
    })));
    if (!detected) setStep('adjust');
  };

  const handleImport = async () => {
    if (!plan) return;
    setImporting(true);
    setFileError(null);
    try {
      const rows = plan.sheets.filter((item) => item.include).flatMap((item) => item.rows);
      const imported = await onImport(rows);
      setResult(imported);
      setStep('result');
    } catch (error: unknown) {
      setFileError(error instanceof Error ? error.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  const active = adjust.find((item) => item.name === activeSheet) ?? adjust[0];
  const activeGrid = grids.find((item) => item.name === active?.name);
  const headerChoices = (activeGrid?.rows ?? []).slice(0, 20);
  const columnHeaders = active ? (plan?.sheets.find((item) => item.name === active.name)?.headers ?? headerChoices[active.headerRow] ?? []) : [];

  const detected = rowCount > 0
    ? `Detectamos ${sheetCount} ${sheetCount === 1 ? 'hoja' : 'hojas'}, ${rowCount} ${noun(rowCount)}`
    : 'No encontramos filas para importar';
  const subtitle = {
    upload: 'Subí un archivo CSV o XLSX',
    detecting: 'Leyendo el archivo…',
    summary: rowCount > 0 ? 'Listo para importar' : detected,
    adjust: 'Ajustá hojas, encabezado o columnas',
    result: 'Importación completada',
  }[step];

  const preview = included.flatMap((item) => item.rows.slice(0, 2).map((row) => ({ sheet: item.name, row }))).slice(0, 4);

  const importSteps = (
    <div className={sheet ? 'inv-import-body' : 'overflow-y-auto flex-1 p-5'}>
      {step === 'upload' && (
        <div>
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`inv-drop border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
          >
            <Upload size={32} className="text-gray-400" />
            <div className="text-center">
              <p className="font-medium text-gray-700">Arrastrá un archivo o hacé click para elegir</p>
              <p className="text-sm text-gray-400 mt-1">.csv, .xlsx — máx. 2000 filas</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }}
          />
        </div>
      )}

      {step === 'detecting' && (
        <p data-testid="import-detect-status" className="text-sm text-gray-500">Leyendo el archivo…</p>
      )}

      {step === 'summary' && plan && (
        <div data-testid="import-summary" className="space-y-4">
          <p data-testid="import-summary-count" className="text-sm text-gray-700">
            {detected}
          </p>
          <div className="space-y-2">
            {plan.sheets.filter((item) => item.include).map((item) => (
              <div key={item.name} data-testid="import-sheet" className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  {item.condition ? <p className="text-xs text-gray-500">{CONDITION_LABEL[item.condition] ?? item.condition}</p> : null}
                </div>
                <p className="text-sm text-gray-600 shrink-0">{item.rows.length} {noun(item.rows.length)}</p>
              </div>
            ))}
          </div>
          {preview.length > 0 && (
            <ul data-testid="import-preview" className="text-sm text-gray-600 space-y-1">
              {preview.map((item, index) => (
                <li key={`${item.sheet}-${index}`} className="truncate">
                  {[item.row.model, item.row.capacity, item.row.color, item.row.batteryHealth].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 'adjust' && active && (
        <div data-testid="import-adjust" className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hojas</p>
            {adjust.map((item) => (
              <label key={item.name} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  data-testid={`import-sheet-toggle-${item.name}`}
                  checked={item.include}
                  onChange={(event) => {
                    const include = event.target.checked;
                    setAdjust((current) => current.map((sheetItem) => sheetItem.name === item.name ? { ...sheetItem, include } : sheetItem));
                    setActiveSheet(item.name);
                  }}
                />
                <span className="flex-1 font-medium text-gray-800">{item.name}</span>
              </label>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Encabezado · {active.name}</span>
            <select
              aria-label="Fila de encabezado"
              data-testid="import-header-row"
              value={active.headerRow}
              disabled={applying}
              onChange={(event) => { void changeHeader(active.name, Number(event.target.value)); }}
              className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700"
            >
              {headerChoices.map((row, index) => (
                <option key={index} value={index}>{index + 1}. {row.filter(Boolean).slice(0, 6).join(' · ') || 'fila vacía'}</option>
              ))}
            </select>
          </label>

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
                  const taken = new Set(Object.entries(active.mapping).filter(([key, value]) => key !== field.key && value).map(([, value]) => value));
                  return (
                    <tr key={field.key}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {field.label}
                        {field.required ? <span className="text-red-500 text-xs"> *</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <select
                            aria-label={field.label}
                            data-testid={`import-field-${field.key}`}
                            value={active.mapping[field.key] ?? ''}
                            onChange={(event) => {
                              const column = event.target.value;
                              setTouched((current) => ({ ...current, [active.name]: true }));
                              setAdjust((current) => current.map((sheetItem) => sheetItem.name === active.name
                                ? { ...sheetItem, mapping: assignColumn(sheetItem.mapping, field.key, column) }
                                : sheetItem));
                            }}
                            className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700"
                          >
                            <option value="">— Sin mapear —</option>
                            {columnHeaders.map((header) => (
                              <option key={header} value={header} disabled={active.mapping[field.key] !== header && taken.has(header)}>{header}</option>
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
    </div>
  );

  const summaryLabel = importing ? 'Importando…' : `Importar ${rowCount} ${noun(rowCount)}`;
  const modalFooter = (
    <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
      {(step === 'upload' || step === 'detecting') && (
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
      )}
      {step === 'summary' && (
        <>
          <button onClick={() => { setFileError(null); setStep('adjust'); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Ajustar importación</button>
          <button onClick={() => { void handleImport(); }} disabled={rowCount === 0 || importing} className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-40 flex items-center gap-2">
            {summaryLabel} <ArrowRight size={15} />
          </button>
        </>
      )}
      {step === 'adjust' && (
        <>
          <button onClick={() => { setFileError(null); setStep('summary'); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Volver</button>
          <button onClick={() => { void applyAdjust(); }} disabled={applying} className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-40">
            {applying ? 'Leyendo…' : 'Listo'}
          </button>
        </>
      )}
      {step === 'result' && (
        <button onClick={onClose} className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg">Cerrar</button>
      )}
    </div>
  );

  const sheetFooter = step === 'upload' || step === 'detecting' ? (
    <div className="sacts one"><button type="button" className="btn2 s" onClick={onClose}>Cancelar</button></div>
  ) : step === 'summary' ? (
    <div className="sacts">
      <button type="button" className="btn2 s" onClick={() => { setFileError(null); setStep('adjust'); }}>Ajustar importación</button>
      <button type="button" className="btn2 p" disabled={rowCount === 0 || importing} onClick={() => { void handleImport(); }}>{summaryLabel}</button>
    </div>
  ) : step === 'adjust' ? (
    <div className="sacts">
      <button type="button" className="btn2 s" onClick={() => { setFileError(null); setStep('summary'); }}>Volver</button>
      <button type="button" className="btn2 p" disabled={applying} onClick={() => { void applyAdjust(); }}>{applying ? 'Leyendo…' : 'Listo'}</button>
    </div>
  ) : (
    <div className="sacts one"><button type="button" className="btn2 p" onClick={onClose}>Cerrar</button></div>
  );

  if (sheet) {
    return (
      <Sheet title={title} subtitle={subtitle} onClose={onClose} className="inv-import">
        {importSteps}
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {importSteps}
        {modalFooter}
      </motion.div>
    </motion.div>
  );
};
