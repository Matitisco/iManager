import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import type { BulkSelection } from './bulk-selection';
import { SelectFiltered } from './bulk-selection';
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

export function BulkActions<T extends { id: string }>({ selection, total, label, action, children }: {
  selection: BulkSelection<T>; total: number; label: (row: T) => string; action: BulkAction<T>; children?: ReactNode;
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
    {phone && !selection.mode ? <div className="bulk-select-filter"><button className="dbtn s" type="button" disabled={total === 0} onClick={() => selection.start()}>Seleccionar</button></div> : null}
    {phone && selection.mode ? <div className="bulk-select-filter"><SelectFiltered selection={selection} total={total} /><span>Seleccionar todos</span></div> : null}
    {selection.selected.length > 0 || (phone && selection.mode) ? (
      <div className={`bulk-bar${phone ? ' mobile' : ''}`} role="region" aria-label="Acciones masivas" data-testid="bulk-action-bar" aria-busy={busy}>
        <div className="bulk-count"><b aria-live="polite">{selection.selected.length} {selection.selected.length === 1 ? 'seleccionado' : 'seleccionados'}</b><button type="button" disabled={selection.locked} onClick={selection.clear}>{phone ? 'Listo' : 'Limpiar selección'}</button></div>
        <div className="bulk-buttons">
          {children}
          {canManageSensitive ? <button type="button" className="dbtn bulk-danger" disabled={selection.locked || !ready || selection.selected.length === 0 || Boolean(unavailable)} onClick={() => {
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
