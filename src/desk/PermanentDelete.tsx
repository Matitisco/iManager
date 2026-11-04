import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Client, Product, RepairOrder, Sale, TradeIn } from '../types';
import type { PermanentDeleteKind } from '../services/permanent-delete-api';
import { archivedClient, archivedProduct, archivedRepair, voidedSale, voidedTrade } from './archive-cache';
import { isVoidRow } from './format';
import { Actions, Field, Sheet, useDesk } from './ui';

type Records = { inventory?: Product[]; clients?: Client[]; sales?: Sale[]; tradeIns?: TradeIn[]; repairOrders?: RepairOrder[] };

export function permanentDeleteRecord(kind: PermanentDeleteKind, id: string, records: Records) {
  switch (kind) {
    case 'eq': {
      const row = records.inventory?.find(row => row.id === id) ?? archivedProduct(id);
      return row && { inactive: Boolean(row.archivedAt), label: [row.model, row.capacity, row.imei && `IMEI ${row.imei}`].filter(Boolean).join(' · ') };
    }
    case 'cl': {
      const row = records.clients?.find(row => row.id === id) ?? archivedClient(id);
      return row && { inactive: Boolean(row.archivedAt), label: [row.name, row.dni && `DNI ${row.dni}`].filter(Boolean).join(' · ') };
    }
    case 'sale': {
      const row = records.sales?.find(row => row.id === id) ?? voidedSale(id);
      return row && { inactive: isVoidRow(row), label: [`V-${String(row.saleNumber ?? id).padStart(4, '0')}`, row.clientName, row.deviceLabel].filter(Boolean).join(' · ') };
    }
    case 'cj': {
      const row = records.tradeIns?.find(row => row.id === id) ?? voidedTrade(id);
      return row && { inactive: isVoidRow(row), label: [`C-${String(row.tradeNumber ?? id).padStart(4, '0')}`, row.deviceReceived, row.clientName].filter(Boolean).join(' · ') };
    }
    case 'ot': {
      const row = records.repairOrders?.find(row => row.id === id) ?? archivedRepair(id);
      return row && { inactive: Boolean(row.archivedAt), label: `#${row.code} · ${row.device}` };
    }
  }
}

export function PermanentDeleteButton({ kind, id, disabled, className = 'btn2 danger' }: {
  kind: PermanentDeleteKind; id: string; disabled?: boolean; className?: string;
}) {
  const ctx = useAppContext();
  const { open } = useDesk();
  const record = permanentDeleteRecord(kind, id, ctx);
  if (ctx.appSession?.membership?.role !== 'OWNER' || !record?.inactive) return null;
  return <button className={className} type="button" disabled={disabled} onClick={() => open({ type: 'permanent-delete', kind, id })}>Borrar definitivamente</button>;
}

export function PermanentDeleteConfirmation({ kind, id, busy, error, run }: {
  kind: PermanentDeleteKind; id: string; busy: boolean; error: string | null;
  run: (action: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const ctx = useAppContext();
  const { close } = useDesk();
  const [confirmation, setConfirmation] = useState('');
  const pending = useRef(false);
  const record = permanentDeleteRecord(kind, id, ctx);
  if (ctx.appSession?.membership?.role !== 'OWNER' || !record?.inactive) return null;
  const submit = async () => {
    if (pending.current || busy || confirmation !== 'BORRAR') return;
    pending.current = true;
    try { await run(() => ctx.permanentlyDeleteRecord(kind, id), 'Registro borrado definitivamente'); }
    finally { pending.current = false; }
  };
  return <Sheet title="Borrar definitivamente" subtitle={record.label} maskSubtitle onClose={close} busy={busy}
    footer={<Actions primary="Borrar definitivamente" secondary="Cancelar" danger busy={busy} busyLabel="Borrando…" disabled={confirmation !== 'BORRAR'} onPrimary={() => { void submit(); }} onSecondary={close} />}>
    <div className="pending-sale"><div><b>Esta acción es irreversible</b><small>Vas a borrar definitivamente este registro. No vas a poder restaurarlo. El borrado queda registrado en el historial.</small></div></div>
    <div className="kv"><span>Registro</span><b data-ph-mask>{record.label}</b></div>
    <div className="kv"><span>Identificador</span><b>{id}</b></div>
    {kind === 'cl' ? <p className="sub">También se borran sus cobros, señas, planes de cuotas y notas de crédito con sus aplicaciones. Las ventas, los canjes, las reparaciones y los reclamos se conservan sin el vínculo al cliente.</p> : null}
    {kind === 'sale' ? <p className="sub">También se borran los pagos propios de la venta y sus planes de cuotas. Se conservan los movimientos de cuenta corriente y caja, el canje y los reclamos asociados.</p> : null}
    {kind === 'eq' ? <p className="sub">También se borran sus precios y preferencias de visibilidad en catálogos. Las ventas, los canjes y los reclamos asociados se conservan.</p> : null}
    {kind === 'ot' ? <p className="sub">También se borra la línea de tiempo de estados de la orden. Sus cobros y los eventos de auditoría se conservan.</p> : null}
    {kind === 'cj' ? <p className="sub">La venta y el equipo recibido se conservan sin el vínculo al canje.</p> : null}
    <Field label="Escribí BORRAR para confirmar"><input autoComplete="off" value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></Field>
    {error ? <div className="ferr" role="alert">{error}</div> : null}
  </Sheet>;
}
