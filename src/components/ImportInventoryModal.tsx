import React, { useRef, useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import { importBackendInventoryItems, type ImportRow, type ImportResult } from '../services/inventory-import-api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'result';

interface FieldDef {
  key: keyof ImportRow;
  label: string;
  required: boolean;
  hint?: string;
}

const INVENTORY_FIELDS: FieldDef[] = [
  { key: 'imei',          label: 'IMEI',        required: true },
  { key: 'model',         label: 'Modelo',       required: true },
  { key: 'price',         label: 'Precio',       required: true },
  { key: 'capacity',      label: 'Capacidad',    required: false, hint: 'ej: 128GB' },
  { key: 'color',         label: 'Color',        required: false },
  { key: 'condition',     label: 'Condición',    required: false, hint: 'NUEVO / USADO / PRE-OWNED' },
  { key: 'grade',         label: 'Estética',     required: false, hint: 'A+ / A / B / C / N/A' },
  { key: 'batteryHealth', label: 'Batería %',    required: false, hint: '0–100' },
  { key: 'cost',          label: 'Costo',        required: false },
  { key: 'status',        label: 'Estado',       required: false, hint: 'DISPONIBLE / VENDIDO / EN_REVISION' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (raw.length === 0) return resolve({ headers: [], rows: [] });
        const headers = Object.keys(raw[0]);
        resolve({ headers, rows: raw });
      } catch (err) {
        reject(new Error('No se pudo leer el archivo'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

function autoMap(headers: string[]): Record<string, string> {
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
  const aliases: Record<string, string> = {
    imei: 'imei', serial: 'imei',
    modelo: 'model', model: 'model',
    precio: 'price', price: 'price', pvp: 'price',
    capacidad: 'capacity', capacity: 'capacity', almacenamiento: 'capacity', storage: 'capacity',
    color: 'color', colour: 'color',
    condicion: 'condition', condition: 'condition', estado2: 'condition',
    estetica: 'grade', grade: 'grade', grado: 'grade',
    bateria: 'batteryHealth', battery: 'batteryHealth', batt: 'batteryHealth',
    costo: 'cost', cost: 'cost', costounitario: 'cost',
    estado: 'status', status: 'status', disponibilidad: 'status',
  };

  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const key = aliases[normalize(h)];
    if (key) mapping[key] = h;
  }
  return mapping;
}

function buildRows(
  fileRows: Record<string, string>[],
  fieldToColumn: Record<string, string>
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

    return {
      imei: get('imei'),
      model: get('model'),
      price: num('price') ?? 0,
      capacity: get('capacity') || undefined,
      color: get('color') || undefined,
      condition: get('condition') || undefined,
      grade: get('grade') || undefined,
      batteryHealth: num('batteryHealth'),
      cost: num('cost'),
      status: get('status') || undefined,
    };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export const ImportInventoryModal: React.FC<Props> = ({ onClose }) => {
  const { user, reloadInventory } = useAppContext();

  const [step, setStep] = useState<Step>('upload');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<Record<string, string>[]>([]);
  // fieldKey → fileColumnName
  const [fieldToColumn, setFieldToColumn] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Upload ──────────────────────────────────────────────────────────

  const handleFile = async (file: File) => {
    setFileError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setFileError('Formato no soportado. Usá .csv, .xlsx o .xls');
      return;
    }
    try {
      const { headers: h, rows } = await parseFile(file);
      if (h.length === 0) { setFileError('El archivo no tiene columnas'); return; }
      setHeaders(h);
      setFileRows(rows);
      setFieldToColumn(autoMap(h));
      setStep('mapping');
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

  // ── Step 2: Mapping helpers ─────────────────────────────────────────────────

  const requiredMapped = INVENTORY_FIELDS
    .filter(f => f.required)
    .every(f => !!fieldToColumn[f.key]);

  const previewRows = fileRows.slice(0, 3);

  // ── Step 3: Import ──────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!user) return;
    setImporting(true);
    try {
      const rows = buildRows(fileRows, fieldToColumn);
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Importar inventario</h2>
            <p className="text-sm text-gray-500">
              {step === 'upload' && 'Subí un archivo CSV, XLSX o XLS'}
              {step === 'mapping' && `${fileRows.length} filas detectadas — mapeá las columnas`}
              {step === 'result' && 'Importación completada'}
            </p>
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
                  <p className="text-sm text-gray-400 mt-1">.csv, .xlsx, .xls — máx. 2000 filas</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
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

          {/* ── Step: Mapping ── */}
          {step === 'mapping' && (
            <div className="space-y-5">
              {/* Column mapping table */}
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
                  Mapeá los campos requeridos (IMEI, Modelo, Precio) para continuar.
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

          {step === 'mapping' && (
            <>
              <button
                onClick={() => { setStep('upload'); setFileError(null); }}
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
      </div>
    </div>
  );
};
