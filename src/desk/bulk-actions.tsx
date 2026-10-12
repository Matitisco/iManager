import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { BulkSelection } from './bulk-selection';
import { SelectFiltered } from './bulk-selection';
import { downloadCsv } from './csv';
import { usePhoneLayout } from './section-notices';
import { Dialog, useDesk } from './ui';

export type BulkAction<T> = {
  label: string;
  explanation: string;
  execute: (row: T) => Promise<unknown>;
  unavailable?: (row: T) => string | undefined;
};

export function useBulkScope() {
  const { appSession } = useAppContext();
  return `${appSession?.store?.id ?? ''}|${appSession?.user?.id ?? ''}`;
}

export function BulkActions<T extends { id: string }>({ selection, total, name, headers, cells, label, action }: {
  selection: BulkSelection<T>; total: number; name: string; headers: string[];
  cells: (row: T) => string[]; label: (row: T) => string; action: BulkAction<T>;
}) {
  const { canManageSensitive, toast } = useDesk();
  const { backendStatus, appSession } = useAppContext();
  const ready = backendStatus === 'ready' && Boolean(appSession?.store) && !appSession?.onboardingRequired;
  const phone = usePhoneLayout();
  const [confirmation, setConfirmation] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const unavailable = selection.selected.map((row) => action.unavailable?.(row)).find(Boolean);
  const dismiss = () => {
    if (submitting.current) return;
    setConfirmation(null);
    setError('');
    selection.setLocked(false);
  };
  const confirm = async () => {
    if (submitting.current || !confirmation?.length || !ready || !canManageSensitive) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    let completed = 0;
    try {
      for (const row of confirmation) {
        if (!mounted.current) return;
        try {
          await action.execute(row);
          if (!mounted.current) return;
          selection.remove(row.id);
          completed += 1;
        } catch (cause) {
          if (!mounted.current) return;
          const message = cause instanceof Error ? cause.message : 'No se pudo guardar la acción.';
          setConfirmation(confirmation.slice(completed));
          setError(`${completed} completados · ${confirmation.length - completed} pendientes. ${label(row)}: ${message}`);
          return;
        }
      }
      setConfirmation(null);
      toast(`${completed} ${completed === 1 ? 'registro procesado' : 'registros procesados'}`);
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        selection.setLocked(false);
      }
    }
  };
  return <>
    {phone && total > 0 ? <div className="bulk-select-filter"><SelectFiltered selection={selection} total={total} /><span>Seleccionar todos los filtrados</span></div> : null}
    {selection.selected.length > 0 ? (
      <div className={`bulk-bar${phone ? ' mobile' : ''}`} role="region" aria-label="Acciones masivas" data-testid="bulk-action-bar" aria-busy={busy}>
        <div className="bulk-count"><b aria-live="polite">{selection.selected.length} {selection.selected.length === 1 ? 'seleccionado' : 'seleccionados'}</b><button type="button" disabled={selection.locked} onClick={selection.clear}>Limpiar selección</button></div>
        <div className="bulk-buttons">
          <button type="button" className="dbtn s" disabled={selection.locked} onClick={() => {
            try { downloadCsv([headers, ...selection.selected.map(cells)], `${name}-seleccion.csv`); toast('Selección exportada'); }
            catch { toast('No se pudo exportar la selección'); }
          }}>Exportar selección</button>
          {canManageSensitive ? <button type="button" className="dbtn bulk-danger" disabled={selection.locked || !ready || Boolean(unavailable)} onClick={() => {
            setError(''); setConfirmation([...selection.selected]); selection.setLocked(true);
          }}>{action.label}</button> : null}
        </div>
        {canManageSensitive && unavailable ? <small className="bulk-note">{unavailable}</small> : null}
      </div>
    ) : null}
    {confirmation ? <Dialog title={`${action.label}: ${confirmation.length} ${confirmation.length === 1 ? 'registro' : 'registros'}`} text={`${action.explanation} Se procesan uno por uno; si alguno falla, se detiene la acción y se conservan los pendientes.`}
      ok={busy ? 'Procesando…' : action.label} onOk={() => { void confirm(); }} onClose={dismiss} busy={busy} danger error={error} className="bulk-confirm" /> : null}
  </>;
}
