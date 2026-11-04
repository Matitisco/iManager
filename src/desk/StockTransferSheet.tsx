import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import type { Product } from '../types';
import type { AppUserStore } from '../types/app-session';
import { transferStock, type StockTransfer } from '../services/store-group-api';
import type { BulkSelection } from './bulk-selection';
import { ownedStoreGroup } from './sections';
import { storeKindLabel } from './store-group';
import { Field, Sheet, useDesk } from './ui';

export const transferQuantityLimit = (item: Product) => item.imei?.trim() ? Math.min(1, item.cantidad ?? 1) : item.cantidad ?? 1;
export function transferUnavailable(item: Product) {
  return Boolean(item.archivedAt || item.status !== 'DISPONIBLE' || item.pendingSaleRegistration || item.reservedDepositId || item.reservedAt || transferQuantityLimit(item) < 1);
}

export function TransferStockAction({ selection }: { selection: BulkSelection<Product> }) {
  const { appSession, backendStatus } = useAppContext();
  const [items, setItems] = useState<Product[] | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const destination = ownedStoreGroup(appSession).find(store => store.id !== appSession?.store?.id);
  if (!destination) return null;
  const unavailable = selection.selected.some(transferUnavailable);
  return <>
    <button ref={trigger} className="dbtn s store-transfer-button" type="button" disabled={selection.locked || !selection.selected.length || unavailable || backendStatus !== 'ready' || appSession?.billing?.readOnly} title={unavailable ? 'Seleccioná solo stock disponible, sin reservas ni ventas por registrar.' : undefined} onClick={() => setItems([...selection.selected])}>Transferir a {destination.name}</button>
    {items ? createPortal(<StockTransferSheet key={`${appSession?.store?.id}:${destination.id}`} items={items} destination={destination} onClose={() => setItems(null)} onSuccess={() => { selection.clear(); setItems(null); }} />, trigger.current?.closest('.desk-app') ?? document.body) : null}
  </>;
}

export function StockTransferSheet({ items, destination, onClose, onSuccess }: { items: Product[]; destination: AppUserStore; onClose: () => void; onSuccess: () => void }) {
  const { user, appSession, reloadInventory } = useAppContext();
  const { toast } = useDesk();
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(items.map(item => [item.id, '1'])));
  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [receipt, setReceipt] = useState<StockTransfer | null>(null);
  const pending = useRef(false);
  const authorized = ownedStoreGroup(appSession).some(store => store.id === destination.id && store.id !== appSession?.store?.id);
  const submit = async () => {
    if (!user || pending.current || !authorized || appSession?.billing?.readOnly) return;
    if (!receipt && items.some(item => !Number.isInteger(Number(quantities[item.id])) || Number(quantities[item.id]) < 1 || Number(quantities[item.id]) > transferQuantityLimit(item))) {
      setError('Ingresá una cantidad entera entre 1 y el stock disponible de cada ítem.'); return;
    }
    pending.current = true; setBusy(true); setError('');
    let saved = receipt;
    try {
      if (!saved) {
        setAttempted(true);
        const result = await transferStock(user, { toStoreId: destination.id, items: items.map(item => ({ inventoryItemId: item.id, quantity: Number(quantities[item.id]) })), requestKey });
        saved = result.transfer; setReceipt(saved);
      }
      await reloadInventory();
      const count = saved.items.reduce((total, item) => total + item.quantity, 0);
      toast(`${count} ${count === 1 ? 'unidad transferida' : 'unidades transferidas'} a ${destination.name}`);
      onSuccess();
    } catch (cause) {
      setError(saved ? 'La transferencia se guardó. No se pudo actualizar el inventario; reintentá la actualización.' : getFriendlyErrorMessage(cause, 'No se pudo transferir el stock.'));
    } finally { pending.current = false; setBusy(false); }
  };
  return <Sheet title={`Transferir a ${destination.name}`} busy={busy} onClose={() => { if (!pending.current) onClose(); }} className="transfer-sheet"
    footer={<div className="sacts"><button type="button" className="btn2 s" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="btn2 p" disabled={busy || !authorized || appSession?.billing?.readOnly} onClick={() => void submit()}>{busy ? 'Procesando…' : receipt ? 'Actualizar inventario' : 'Transferir'}</button></div>}>
    <p className="sheet-note">Destino: <b>{destination.name}</b> · {storeKindLabel(destination.kind)}</p>
    <p className="balance-warning">Se mueve a costo; en esta tienda deja de estar disponible.</p>
    <div className="transfer-list">{items.map(item => <div className="transfer-item" key={item.id}><div><b>{[item.model, item.capacity, item.color].filter(Boolean).join(' · ')}</b>{item.imei ? <small data-ph-mask>IMEI {item.imei}</small> : null}<small>Disponible: {transferQuantityLimit(item)}</small></div>
      <Field label={`Cantidad de ${item.model}`}><input type="number" inputMode="numeric" min={1} max={transferQuantityLimit(item)} step={1} disabled={busy || attempted || transferQuantityLimit(item) === 1} value={quantities[item.id]} onChange={event => setQuantities(current => ({ ...current, [item.id]: event.target.value }))} /></Field>
    </div>)}</div>
    {error ? <p className="ferr" role="alert">{error}</p> : null}
    {attempted && error && !receipt ? <p className="sheet-note">Reintentar conserva las cantidades y evita duplicar la transferencia. Para cambiarlas, cerrá esta hoja.</p> : null}
  </Sheet>;
}
