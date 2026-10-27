import { useState } from 'react';
import { DeskSelect } from '../desk/select';
import { Field, Segs, Sheet } from '../desk/ui';
import type { ImportFieldDef } from './ImportModal';
import type { ImportSheetPlan } from '../services/import-api';
import type { CustomFieldDefinition, CustomFieldInput } from '../services/custom-fields-api';
import { ReplayValue } from '../desk/replay-privacy';
import { Check } from 'lucide-react';

export function columnLetter(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
export function importColumns(active: ImportSheetPlan, rows: string[][]) {
  const width = Math.max(0, ...rows.map(row => row.length));
  return Array.from({ length: width }, (_, columnIndex) => {
    const header = active.headerRow === 0 ? columnLetter(columnIndex) : rows[active.headerRow - 1]?.[columnIndex] || columnLetter(columnIndex);
    const column = active.mapping.find(item => item.columnIndex === columnIndex)
      ?? active.mapping.find(item => item.columnIndex === undefined && item.header === header);
    return { header, columnIndex, field: column?.field || 'ignore' };
  });
}

export function columnHasData(active: ImportSheetPlan, rows: string[][], index: number) {
  return rows.slice(Math.max(active.headerRow, active.dataStartRow - 1), active.dataEndRow)
    .some(row => Boolean(row[index]?.trim()));
}

export function ImportColumnCards({ active, rows, fields, definitions, drafts, onDraft, onChange, disabled, visibleColumns, flashingColumn }: {
  active: ImportSheetPlan; rows: string[][]; fields: ImportFieldDef[]; definitions: CustomFieldDefinition[]; drafts: CustomFieldInput[];
  onDraft: (draft: CustomFieldInput) => void; onChange: (plan: ImportSheetPlan) => void; disabled: boolean;
  visibleColumns?: ReadonlySet<number>;
  flashingColumn?: number;
}) {
  const [editingColumns, setEditingColumns] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldInput['type']>('text');
  const [error, setError] = useState('');
  const mapping = importColumns(active, rows);
  const all = [...definitions, ...drafts];
  const assign = (index: number, field: string) => {
    setEditingColumns(current => { const next = new Set(current); next.delete(`${active.name}:${index}`); return next; });
    onChange({ ...active, mapping: mapping.map((column, i) => ({ ...column, columnIndex: i, field: i === index ? field : field !== 'ignore' && column.field === field ? 'ignore' : column.field })) });
  };
  const create = () => {
    const label = name.trim();
    if (!label) { setError('Ingresá un nombre'); return; }
    if (all.some(item => item.label.toLocaleLowerCase() === label.toLocaleLowerCase())) { setError('Ya existe un campo con ese nombre'); return; }
    const base = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 45) || 'campo';
    const key = `cf_${base}_${crypto.randomUUID().slice(0, 8)}`;
    const draft: CustomFieldInput = { entity: 'inventory', key, label, type, order: all.length };
    onDraft(draft);
    assign(creating!, `custom:${key}`);
    setCreating(null);
  };
  return <>
    <div className="imp-grid">
      {mapping.map((column, index) => {
        if (visibleColumns && !visibleColumns.has(index)) return null;
        const header = column.header;
        const columnId = `${active.name}:${index}`;
        const mode = editingColumns.has(columnId) ? 'field' : column.field.startsWith('custom:') ? 'new' : !column.field || column.field === 'ignore' ? 'ignore' : 'field';
        const examples = rows.slice(Math.max(active.headerRow, active.dataStartRow - 1), active.dataEndRow).slice(0, 3);
        return <article key={`${active.name}:${index}`} data-column-index={index} tabIndex={-1} className={`imp-card${visibleColumns ? ' rev' : ''}${mode === 'new' ? ' new' : ''}${flashingColumn === index ? ' flash' : ''}`} aria-label={`Columna ${header}`}>
          <div className="imp-card-head"><b className="imp-column-title" title={header}><ReplayValue>{header}</ReplayValue></b>{column.field !== 'ignore' && <Check className="imp-column-ok" size={16} aria-label="Asignada" />}</div>
          <div className="imp-prev">{Array.from({ length: 3 }, (_, n) => <span key={n}><ReplayValue>{examples[n]?.[index]?.trim() || '—'}</ReplayValue></span>)}</div>
          <div className="imp-segments" role="group" aria-label={`Destino de ${header}`}>
            <button type="button" disabled={disabled} aria-pressed={mode === 'field'} onClick={() => setEditingColumns(current => new Set([...current, columnId]))}>Campo existente</button>
            <button type="button" disabled={disabled} aria-pressed={mode === 'new'} onClick={() => { setCreating(index); setName(''); setType('text'); setError(''); }}>Nuevo campo</button>
            <button type="button" disabled={disabled} aria-pressed={mode === 'ignore'} onClick={() => { setEditingColumns(current => { const next = new Set(current); next.delete(columnId); return next; }); assign(index, 'ignore'); }}>Descartar</button>
          </div>
          {mode !== 'ignore' ? <DeskSelect data-testid={fields.some(field => field.key === column.field) ? `import-field-${column.field}` : undefined} label={`Importar ${header} como`} value={column.field} disabled={disabled}
            onChange={value => assign(index, value)} options={[...fields.map(field => ({ value: field.key, label: field.label })), ...all.map(field => ({ value: `custom:${field.key}`, label: `${field.label} · ${field.type === 'date' ? 'Fecha' : field.type === 'number' ? 'Número' : 'Texto'}` }))]} /> : <span className="imp-discarded">Descartada</span>}
        </article>;
      })}
    </div>
    {creating !== null && <div className="imp-new-layer"><Sheet title="Nuevo campo" overlayClassName="subov" className="imp-new-field" onClose={() => setCreating(null)} footer={<div className="sacts"><button type="button" className="btn2 s" onClick={() => setCreating(null)}>Cancelar</button><button type="button" className="btn2 p" onClick={create}>Crear campo</button></div>}>
      <Field label="Nombre" error={error}><input autoFocus maxLength={100} value={name} onChange={event => { setName(event.target.value); setError(''); }} /></Field>
      <Field label="Tipo"><span /></Field><Segs options={[{ id: 'text', label: 'Texto' }, { id: 'date', label: 'Fecha' }, { id: 'number', label: 'Número' }]} value={type} onChange={value => setType(value as CustomFieldInput['type'])} />
    </Sheet></div>}
  </>;
}
