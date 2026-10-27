import { ReasonSheet } from './ReasonSheet';
import { toActionMessage } from '../lib/user-message';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppContext } from '../context/AppContext';
import type { BulkSelection } from './bulk-selection';
import { SelectFiltered } from './bulk-selection';
import { usePhoneLayout } from './section-notices';
import { Sheet, useDesk } from './ui';

export type BulkAction<T> = {
  label: string;
  doneLabel?: 'archivados' | 'anulados' | 'procesados';
  explanation: string;
  execute: (row: T, reason?: string) => Promise<unknown>;
  unavailable?: (row: T) => string | undefined;
  recover?: (row: T) => void;
};

export function useBulkScope() {
  const { appSession } = useAppContext();
  return `${appSession?.store?.id ?? ''}|${appSession?.user?.id ?? ''}`;
}

export function BulkActions<T extends { id: string }>({ selection, total, label, action, children, hideStart = false }: {
  selection: BulkSelection<T>; total: number; label: (row: T) => string; action: BulkAction<T>; children?: ReactNode; hideStart?: boolean;
}) {
  const { canManageSensitive, toast } = useDesk();
  const { backendStatus, appSession } = useAppContext();
  const ready = backendStatus === 'ready' && Boolean(appSession?.store) && !appSession?.onboardingRequired;
  const phone = usePhoneLayout();
  const [confirmation, setConfirmation] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [result, setResult] = useState<{ completed: number; failures: { row: T; name: string; message: string }[] } | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const unavailable = selection.selected.map((row) => action.unavailable?.(row)).find(Boolean);
  const dismiss = () => {
    if (submitting.current) return;
    setConfirmation(null);
    setResult(null);
    setProcessed(0);
    selection.setLocked(false);
  };
  const confirm = async (reason: string) => {
    if (submitting.current || result || !confirmation?.length || !ready || !canManageSensitive) return;
    submitting.current = true;
    setBusy(true);
    setProcessed(0);
    let completed = 0;
    const failures: { row: T; name: string; message: string }[] = [];
    try {
      for (const row of confirmation) {
        if (!mounted.current) return;
        try {
          await action.execute(row, reason);
          if (!mounted.current) return;
          selection.remove(row.id);
          completed += 1;
        } catch (cause) {
          if (!mounted.current) return;
          failures.push({ row, name: label(row), message: toActionMessage(cause, 'No se pudo guardar la acción.') });
        }
        setProcessed(completed + failures.length);
      }
      if (failures.length > 0) {
        setResult({ completed, failures });
      } else {
        setConfirmation(null);
        toast(`${completed} ${completed === 1 ? 'registro procesado' : 'registros procesados'}`);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) {
        setBusy(false);
        selection.setLocked(false);
      }
    }
  };
  const doneLabel = action.doneLabel ?? 'procesados';
  const verb = { archivados: 'archivar', anulados: 'anular', procesados: 'procesar' }[doneLabel];
  const recoverable = result?.failures.find(({ message }) => message.includes('saldo a favor'));
  return <>
    {phone && !selection.mode && !hideStart ? <div className="bulk-select-filter"><button className="dbtn s" type="button" disabled={total === 0} onClick={() => selection.start()}>Seleccionar</button></div> : null}
    {phone && selection.mode ? <div className="bulk-select-filter"><SelectFiltered selection={selection} total={total} /><span>Seleccionar todos</span></div> : null}
    {selection.selected.length > 0 || (phone && selection.mode) ? (
      <div className={`bulk-bar${phone ? ' mobile' : ''}`} role="region" aria-label="Acciones masivas" data-testid="bulk-action-bar" aria-busy={busy}>
        <div className="bulk-count"><b aria-live="polite">{selection.selected.length} {selection.selected.length === 1 ? 'seleccionado' : 'seleccionados'}</b><button type="button" disabled={selection.locked} onClick={selection.clear}>{phone ? 'Listo' : 'Limpiar selección'}</button></div>
        <div className="bulk-buttons">
          {children}
          {canManageSensitive ? <button type="button" className="dbtn bulk-danger" disabled={selection.locked || !ready || selection.selected.length === 0 || Boolean(unavailable)} onClick={() => {
            setResult(null); setProcessed(0); setConfirmation([...selection.selected]); selection.setLocked(true);
          }}>{action.label}</button> : null}
        </div>
        {canManageSensitive && unavailable ? <small className="bulk-note">{unavailable}</small> : null}
      </div>
    ) : null}
    {confirmation ? result ? <Sheet title="Resultado" onClose={dismiss} className="bulk-confirm"
      footer={<div className="sacts one"><button type="button" className="btn2 p" onClick={dismiss}>Listo</button></div>}>
      <p className="bulk-result" role="status" aria-live="polite">{result.completed} {result.completed === 1 ? doneLabel.slice(0, -1) : doneLabel} · {result.failures.length} {result.failures.length === 1 ? 'no se pudo' : 'no se pudieron'} {verb}</p>
      <details className="bulk-failures">
        <summary>Ver detalle</summary>
        <ul className="bulk-failure-list" aria-label="Registros con errores" tabIndex={0}>
          {result.failures.map(({ row, name, message }) => <li key={row.id}><b>{name}</b><p className="ferr">{message}</p></li>)}
        </ul>
      </details>
      {recoverable && action.recover ? <button type="button" className="wlink" onClick={() => { dismiss(); action.recover?.(recoverable.row); }}>Registrar devolución</button> : null}
    </Sheet> : <ReasonSheet title={`${action.label}: ${confirmation.length} ${confirmation.length === 1 ? 'registro' : 'registros'}`} note={<>
      {action.explanation} Se procesan uno por uno. Los que no se puedan procesar se saltean y al final te mostramos cuáles fueron y por qué.
      {busy ? <span className="bulk-progress" role="status" aria-live="polite">Procesando {processed} de {confirmation.length}…</span> : null}
    </>}
      ok={action.label} onOk={reason => { void confirm(reason); }} onClose={dismiss} busy={busy} danger className="bulk-confirm" /> : null}
  </>;
}
