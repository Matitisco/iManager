import React, { useRef, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Upload, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { importBackendInventoryItems, type ImportRow, type ImportResult } from '../services/inventory-import-api';
import { parseWorkbook } from '../utils/parse-workbook';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'sheet-select' | 'header-select' | 'mapping' | 'result';

interface FieldDef {
  key: keyof ImportRow;
  label: string;
  required: boolean;
  hint?: string;
}

const INVENTORY_FIELDS: FieldDef[] = [
  { key: 'model',         label: 'Modelo',       required: true },
  { key: 'imei',          label: 'IMEI (opcional)', required: false },
  { key: 'price',         label: 'Precio',       required: false },
  { key: 'capacity',      label: 'Capacidad',    required: false, hint: 'ej: 128GB' },
  { key: 'color',         label: 'Color',        required: false },
  { key: 'condition',     label: 'Condición',    required: false, hint: 'NUEVO / USADO / PRE-OWNED' },
  { key: 'grade',         label: 'Estética',     required: false, hint: 'A+ / A / B / C / N/A' },
  { key: 'batteryHealth', label: 'Batería %',    required: false, hint: '0–100' },
  { key: 'cost',          label: 'Costo',        required: false },
  { key: 'status',        label: 'Estado',       required: false, hint: 'DISPONIBLE / VENDIDO / EN_REVISION' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find the most likely header row index: first row with ≥2 non-empty, non-numeric cells */
function autoDetectHeaderRow(rawRows: string[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    const textCells = row.filter(cell => cell && isNaN(Number(cell)));
    if (textCells.length >= 2) return i;
  }
  return 0;
}

function autoMap(headers: string[]): Record<string, string> {
  const n = (s: string) => s.toLowerCase().replace(/[\s_\-\.áéíóúàèìòùäëïöü]/g, (c) => {
    const acc: Record<string, string> = { á:'a',é:'e',í:'i',ó:'o',ú:'u',à:'a',è:'e',ì:'i',ò:'o',ù:'u',ä:'a',ë:'e',ï:'i',ö:'o',ü:'u' };
    return acc[c] ?? '';
  });

  // Alias map: normalized string → field key
  const aliases: Record<string, keyof ImportRow> = {
    imei:'imei', serial:'imei', numeroserie:'imei', ns:'imei', sn:'imei',
    modelo:'model', model:'model', equipo:'model', dispositivo:'model', nombre:'model', producto:'model',
    precio:'price', price:'price', pvp:'price', precioventa:'price', venta:'price', preciofinal:'price',
    capacidad:'capacity', capacity:'capacity', almacenamiento:'capacity', storage:'capacity', rom:'capacity', memoria:'capacity',
    color:'color', colour:'color', colores:'color',
    condicion:'condition', condition:'condition', tipo:'condition',
    estetica:'grade', grade:'grade', grado:'grade', calidad:'grade', cosmetica:'grade', estado2:'grade',
    bateria:'batteryHealth', battery:'batteryHealth', batt:'batteryHealth', saludbateria:'batteryHealth',
    salud:'batteryHealth', health:'batteryHealth', bateriasalud:'batteryHealth',
    costo:'cost', cost:'cost', costounitario:'cost', preciocompra:'cost', compra:'cost',
    estado:'status', status:'status', disponibilidad:'status', disponible:'status',
  };

  // Substring keywords for fallback matching
  const substrings: [string, keyof ImportRow][] = [
    ['imei','imei'], ['serial','imei'],
    ['model','model'], ['equipo','model'],
    ['preci','price'], ['venta','price'],
    ['capac','capacity'], ['almac','capacity'], ['memor','capacity'],
    ['color','color'],
    ['condic','condition'],
    ['estetica','grade'], ['grado','grade'], ['grade','grade'],
    ['bater','batteryHealth'], ['battery','batteryHealth'], ['salud','batteryHealth'],
    ['costo','cost'], ['compra','cost'],
    ['estado','status'], ['dispon','status'],
  ];

  const mapping: Record<string, string> = {};

  // Pass 1: exact alias match
  for (const h of headers) {
    const key = aliases[n(h)];
    if (key && !mapping[key]) mapping[key] = h;
  }

  // Pass 2: substring fallback for unmatched fields
  for (const h of headers) {
    const nh = n(h);
    for (const [substr, key] of substrings) {
      if (!mapping[key] && nh.includes(substr)) {
        mapping[key] = h;
        break;
      }
    }
  }

  return mapping;
}

function buildDataRows(rawRows: string[][], headerRowIndex: number): {
  headers: string[];
  fileRows: Record<string, string>[];
} {
  const headers = rawRows[headerRowIndex].map((h, i) => h || `Columna ${i + 1}`);
  const fileRows = rawRows
    .slice(headerRowIndex + 1)
    .filter(row => row.some(cell => cell !== ''))
    .map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
  return { headers, fileRows };
}

/** Detect if a column is mostly numeric (>50% of non-empty values parse as numbers) */
function detectColumnType(fileRows: Record<string, string>[], colName: string): 'text' | 'number' {
  const values = fileRows.map(r => String(r[colName] ?? '').trim()).filter(Boolean);
  if (values.length === 0) return 'text';
  const numCount = values.filter(v => !isNaN(parseFloat(v.replace(',', '.')))).length;
  return numCount / values.length > 0.5 ? 'number' : 'text';
}

function buildRows(
  fileRows: Record<string, string>[],
  fieldToColumn: Record<string, string>,
  extraCols: { fileColumn: string; colId: string }[]
): ImportRow[] {
  return fileRows.map((row) => {
    const get = (field: string) => {
      const col = fieldToColumn[field];
      return col ? String(row[col] ?? '').trim() : '';
    };
    const num = (field: string) => {
      const v = get(field).replace(',', '.');
      const n = parseFloat(v);
      return isNaN(n) ? undefined : n;
    };

    const customFields: Record<string, unknown> = {};
    for (const { fileColumn, colId } of extraCols) {
      const val = String(row[fileColumn] ?? '').trim();
      if (val) customFields[colId] = val;
    }

    return {
      imei: get('imei'),
      model: get('model'),
      price: num('price') ?? 0,
      capacity: get('capacity') || undefined,
      color: get('color') || undefined,
      condition: get('condition') || undefined,
      grade: get('grade') || undefined,
      batteryHealth: get('batteryHealth') || undefined,
      cost: num('cost'),
      status: get('status') || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

const PREVIEW_ROWS = 12; // how many raw rows to show in header-select step

export const ImportInventoryModal: React.FC<Props> = ({ onClose }) => {
  const { user, reloadInventory, customColumns, addCustomColumn } = useAppContext();
  const inventoryCustomColumns = useMemo(
    () => customColumns.filter((column) => column.entity === 'inventory'),
    [customColumns],
  );

  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Sheet selection
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [getSheet, setGetSheet] = useState<((name: string) => string[][]) | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Raw parsed state
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);

  // Derived after confirming header row
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  const [fieldToColumn, setFieldToColumn] = useState<Record<string, string>>({});

  // Extra columns: file columns not mapped to any standard field
  // key = fileColumn, value = enabled (true = will be imported as custom column)
  const [extraEnabled, setExtraEnabled] = useState<Record<string, boolean>>({});

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File columns that are NOT mapped to any standard inventory field
  const unmappedColumns = useMemo(() => {
    const mapped = new Set(Object.values(fieldToColumn).filter(Boolean));
    return headers.filter(h => !mapped.has(h));
  }, [headers, fieldToColumn]);

  // ── Step 1: Upload ──────────────────────────────────────────────────────────

  const loadSheet = (getter: (name: string) => string[][], name: string) => {
    const rows = getter(name);
    if (rows.length === 0) { setFileError('La hoja está vacía'); return; }
    const suggested = autoDetectHeaderRow(rows);
    setRawRows(rows);
    setHeaderRowIndex(suggested);
    setStep('header-select');
  };

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx'].includes(ext ?? '')) {
      setFileError('Formato no soportado. Usá .csv o .xlsx');
      return;
    }
    try {
      const wb = await parseWorkbook(file);
      if (wb.sheetNames.length === 0) { setFileError('El archivo está vacío'); return; }
      if (wb.sheetNames.length === 1) {
        loadSheet(wb.getSheet, wb.sheetNames[0]);
      } else {
        setSheetNames(wb.sheetNames);
        setGetSheet(() => wb.getSheet);
        setSelectedSheet(wb.sheetNames[0]);
        setStep('sheet-select');
      }
    } catch (e: unknown) {
      setFileError(e instanceof Error ? e.message : 'Error al leer el archivo');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Step 2: Confirm header row → go to mapping ──────────────────────────────

  const confirmHeaderRow = () => {
    const { headers: h, fileRows: rows } = buildDataRows(rawRows, headerRowIndex);
    if (h.every(col => col.startsWith('Columna '))) {
      setFileError('La fila seleccionada parece estar vacía. Elegí la fila con los nombres de columna.');
      return;
    }
    const mapped = new Set(Object.values(autoMap(h)).filter(Boolean));
    const extra: Record<string, boolean> = {};
    for (const col of h) {
      if (!mapped.has(col)) extra[col] = true;
    }
    setHeaders(h);
    setFileRows(rows);
    setFieldToColumn(autoMap(h));
    setExtraEnabled(extra);
    setFileError(null);
    setStep('mapping');
  };

  // ── Step 3: Mapping helpers ─────────────────────────────────────────────────

  const requiredMapped = INVENTORY_FIELDS
    .filter(f => f.required)
    .every(f => !!fieldToColumn[f.key]);

  const previewRows = fileRows.slice(0, 3);

  // ── Step 4: Import ──────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      // Resolve extra columns: find or create custom columns, get their IDs
      const extraCols: { fileColumn: string; colId: string }[] = [];
      for (const fileColumn of unmappedColumns) {
        if (!extraEnabled[fileColumn]) continue;
        // Check if a custom column with this label already exists
        const existing = inventoryCustomColumns.find(
          c => c.label.toLowerCase() === fileColumn.toLowerCase()
        );
        if (existing) {
          extraCols.push({ fileColumn, colId: existing.id });
        } else {
          const type = detectColumnType(fileRows, fileColumn);
          const id = await addCustomColumn({ label: fileColumn, type, entity: 'inventory' });
          if (id) extraCols.push({ fileColumn, colId: id });
        }
      }

      const rows = buildRows(fileRows, fieldToColumn, extraCols);
      const res = await importBackendInventoryItems(user, rows);
      await reloadInventory();
      setResult(res);
      setStep('result');
    } catch (e: unknown) {
      setFileError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  // ── Subtitle per step ───────────────────────────────────────────────────────

  const subtitle = {
    'upload': 'Subí un archivo CSV o XLSX',
    'sheet-select': `${sheetNames.length} hojas encontradas — elegí cuál importar`,
    'header-select': 'Indicá cuál fila tiene los nombres de columna',
    'mapping': `${fileRows.length} filas detectadas — mapeá las columnas`,
    'result': 'Importación completada',
  }[step];

  // ── Render ──────────────────────────────────────────────────────────────────

  // Slice of raw rows to display in header-select
  const displayRawRows = rawRows.slice(0, PREVIEW_ROWS);
  const maxCols = Math.min(8, Math.max(...displayRawRows.map(r => r.length)));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importar inventario</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
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
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {fileError && (
                <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={15} /> {fileError}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Sheet selection ── */}
          {step === 'sheet-select' && (
            <div className="space-y-3">
              {sheetNames.map(name => (
                <button
                  key={name}
                  onClick={() => setSelectedSheet(name)}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-medium transition-colors ${selectedSheet === name ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'}`}
                >
                  <span>{name}</span>
                  {selectedSheet === name && <CheckCircle2 size={16} />}
                </button>
              ))}
            </div>
          )}

          {/* ── Step: Header row selection ── */}
          {step === 'header-select' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-gray-400" />
                <span>Hacé click en la fila que contiene los <strong className="text-gray-700">nombres de las columnas</strong>. Las filas de arriba se ignoran.</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {displayRawRows.map((row, i) => {
                        const isHeader = i === headerRowIndex;
                        const isAbove = i < headerRowIndex;
                        return (
                          <tr
                            key={i}
                            onClick={() => { setHeaderRowIndex(i); setFileError(null); }}
                            className={`cursor-pointer transition-colors border-b border-gray-100 last:border-b-0
                              ${isHeader
                                ? 'bg-black text-white'
                                : isAbove
                                  ? 'bg-gray-50 text-gray-300 hover:bg-gray-100 hover:text-gray-500'
                                  : 'text-gray-600 hover:bg-blue-50'
                              }`}
                          >
                            {/* Row number */}
                            <td className={`px-3 py-2.5 font-mono text-right w-10 select-none ${isHeader ? 'text-gray-300' : 'text-gray-300'}`}>
                              {i + 1}
                            </td>
                            {/* Tag for selected header row */}
                            <td className="px-2 py-2.5 w-20 select-none">
                              {isHeader && (
                                <span className="text-[10px] font-bold tracking-wider bg-white/20 rounded px-1.5 py-0.5 uppercase whitespace-nowrap">
                                  Encabezado
                                </span>
                              )}
                            </td>
                            {/* Cell values */}
                            {Array.from({ length: maxCols }).map((_, j) => (
                              <td key={j} className={`px-3 py-2.5 max-w-[120px] truncate ${isHeader ? 'font-semibold' : ''}`}>
                                {row[j] ?? ''}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rawRows.length > PREVIEW_ROWS && (
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                    Mostrando las primeras {PREVIEW_ROWS} filas de {rawRows.length}
                  </div>
                )}
              </div>

              {fileError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={15} /> {fileError}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Mapping ── */}
          {step === 'mapping' && (
            <div className="space-y-5">
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">
                        Campo de inventario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/2">
                        Columna del archivo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {INVENTORY_FIELDS.map((field) => (
                      <tr key={field.key} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-800">{field.label}</span>
                            {field.required && <span className="text-red-500 text-xs">*</span>}
                          </div>
                          {field.hint && (
                            <span className="text-xs text-gray-400">{field.hint}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select
                              value={fieldToColumn[field.key] ?? ''}
                              onChange={(e) =>
                                setFieldToColumn((prev) => ({
                                  ...prev,
                                  [field.key]: e.target.value,
                                }))
                              }
                              className="w-full appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            >
                              <option value="">— Sin mapear —</option>
                              {headers.map((h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Extra columns → custom columns */}
              {unmappedColumns.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Columnas adicionales</p>
                      <p className="text-xs text-gray-400 mt-0.5">Se agregarán como columnas personalizadas en la tabla</p>
                    </div>
                    <button
                      onClick={() => {
                        const allOn = unmappedColumns.every(c => extraEnabled[c]);
                        const next: Record<string, boolean> = {};
                        for (const c of unmappedColumns) next[c] = !allOn;
                        setExtraEnabled(next);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    >
                      {unmappedColumns.every(c => extraEnabled[c]) ? 'Desmarcar todas' : 'Marcar todas'}
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {unmappedColumns.map(col => {
                      const alreadyExists = inventoryCustomColumns.some(
                        c => c.label.toLowerCase() === col.toLowerCase()
                      );
                      return (
                        <label key={col} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={!!extraEnabled[col]}
                            onChange={e => setExtraEnabled(prev => ({ ...prev, [col]: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                          />
                          <span className="text-sm font-medium text-gray-700 flex-1">{col}</span>
                          {alreadyExists
                            ? <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">ya existe</span>
                            : <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">nueva</span>
                          }
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview */}
              {previewRows.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Vista previa (primeras {previewRows.length} filas)
                  </p>
                  <div className="border border-gray-200 rounded-xl overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {INVENTORY_FIELDS.filter(f => fieldToColumn[f.key]).map(f => (
                            <th key={f.key} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {INVENTORY_FIELDS.filter(f => fieldToColumn[f.key]).map(f => (
                              <td key={f.key} className="px-3 py-2 text-gray-600 whitespace-nowrap max-w-[140px] truncate">
                                {String(row[fieldToColumn[f.key]] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!requiredMapped && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 rounded-lg px-3 py-2">
                  <AlertCircle size={15} />
                  El campo <strong>Modelo</strong> es obligatorio para continuar.
                </div>
              )}

              {fileError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={15} /> {fileError}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Result ── */}
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
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Filas con errores</p>
                  <div className="border border-red-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50 border-b border-red-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-red-600 font-semibold">Fila</th>
                          <th className="px-3 py-2 text-left text-red-600 font-semibold">IMEI</th>
                          <th className="px-3 py-2 text-left text-red-600 font-semibold">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {result.errors.map((err, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-gray-500">{err.row}</td>
                            <td className="px-3 py-2 font-mono text-gray-600">{err.imei || '—'}</td>
                            <td className="px-3 py-2 text-red-600">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancelar
            </button>
          )}

          {step === 'sheet-select' && (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Volver
              </button>
              <button
                onClick={() => getSheet && loadSheet(getSheet, selectedSheet)}
                disabled={!selectedSheet}
                className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                Usar esta hoja <ArrowRight size={15} />
              </button>
            </>
          )}

          {step === 'header-select' && (
            <>
              <button
                onClick={() => { setStep(sheetNames.length > 1 ? 'sheet-select' : 'upload'); setFileError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                onClick={confirmHeaderRow}
                className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2"
              >
                Confirmar encabezado
                <ArrowRight size={15} />
              </button>
            </>
          )}

          {step === 'mapping' && (
            <>
              <button
                onClick={() => { setStep('header-select'); setFileError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleImport}
                disabled={!requiredMapped || importing}
                className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Importando…
                  </>
                ) : (
                  <>
                    Importar {fileRows.length} filas
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-gray-900 transition-colors"
            >
              Cerrar
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
