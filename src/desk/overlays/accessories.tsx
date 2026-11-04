import { useRef, useState, type ReactNode } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACCESSORY_TYPES, accessoryError } from '../../lib/accessories';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { restoreBackendInventoryItem } from '../../services/inventory-api';
import { archivedProduct } from '../archive-cache';
import { useMoney } from '../exchange';
import { equipmentMoney, parseEquipmentMoney } from '../equipment-money';
import { PermanentDeleteButton } from '../PermanentDelete';
import { RecordHistoryButton } from '../RecordHistoryButton';
import { canSeeFinancials } from '../sections';
import { Actions, Field, Segs, Sheet, SheetActions, signalDesk, useDesk } from '../ui';
import { InlineSupplier } from './InlineSupplier';
import type { FormProps } from './shared';

export function AccessoryForm({ id, supplierId, segment, run, busy, error }: FormProps & { id?: string; supplierId?: string; segment?: ReactNode }) {
  const { inventory, addProduct, updateProduct, appSession, suppliers, reloadLedger } = useAppContext();
  const { close, canManageSensitive = true } = useDesk();
  const money = useMoney();
  const current = inventory.find(item => item.id === id);
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [name, setName] = useState(current?.model ?? '');
  const [type, setType] = useState(current?.accessoryType ?? 'Templado');
  const [compatible, setCompatible] = useState(current?.compatibleWith ?? '');
  const [quantity, setQuantity] = useState(String(current?.cantidad ?? 1));
  const [cost, setCost] = useState(current && seeCosts ? money.inputValue(current.cost ?? 0, current.currency) : '');
  const [price, setPrice] = useState(current?.price != null ? money.inputValue(current.price, current.currency) : '');
  const [supplier, setSupplier] = useState(current?.supplierId ?? supplierId ?? '');
  const [validation, setValidation] = useState('');
  const pending = useRef(false);
  const lockedPrice = Boolean(current) && !canManageSensitive;
  const save = async () => {
    if (pending.current || busy) return;
    const message = accessoryError({ accessoryType: type, cantidad: quantity.trim() ? Number(quantity) : NaN });
    if (!name.trim() || message || (price.trim() && parseEquipmentMoney(price) <= 0) || (seeCosts && cost.trim() && parseEquipmentMoney(cost) < 0)) {
      setValidation(!name.trim() ? 'Completá el nombre del accesorio' : message || 'Revisá el costo y el precio'); return;
    }
    const amounts = current ? equipmentMoney(current, price, cost, seeCosts, lockedPrice, money.commitGroup) : null;
    if (amounts?.blocked) { setValidation('Revisá la cotización antes de guardar'); return; }
    const data = {
      ...(current ?? {}), kind: 'ACCESSORY' as const, model: name.trim(), accessoryType: type, compatibleWith: compatible.trim() || null,
      cantidad: Number(quantity), imei: '', capacity: '', color: '', condition: '', grade: '', batteryHealth: '',
      price: price.trim() ? amounts?.amounts[0].amount ?? parseEquipmentMoney(price) : null,
      currency: amounts?.amounts[0].currency ?? money.active,
      status: current?.status ?? (Number(quantity) === 0 ? 'VENDIDO' : 'DISPONIBLE'), supplierId: supplier || null,
      ...(seeCosts ? { cost: amounts?.cost ?? parseEquipmentMoney(cost) } : {}),
    };
    if (!seeCosts) delete data.cost;
    setValidation(''); pending.current = true;
    try {
      await run(async () => {
        if (current) await updateProduct({ ...data, id: current.id }); else await addProduct(data);
        if (supplierId) await reloadLedger();
        signalDesk('desk-eq-saved');
      }, current ? 'Accesorio actualizado' : 'Accesorio registrado');
    } finally { pending.current = false; }
  };
  return <Sheet title={current ? 'Editar accesorio' : 'Registrar'} onClose={close} busy={busy} className="eq-sheet accessory-sheet" footer={<Actions busy={busy} primary="Guardar accesorio" onPrimary={() => { void save(); }} onSecondary={close} />}>
    {segment}
    {error || validation ? <div className="ferr" role="alert">{error || validation}</div> : null}
    <Field label="Nombre"><input aria-label="Nombre" value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder="Ej. Templado 9D iPhone 15" /></Field>
    <Field label="Tipo"><span /></Field>
    <Segs options={ACCESSORY_TYPES.map(value => ({ id: value, label: value }))} value={type} onChange={setType} />
    <Field label="Compatible con"><input aria-label="Compatible con" value={compatible} maxLength={120} onChange={event => setCompatible(event.target.value)} placeholder="Opcional" /></Field>
    <Field label="Cantidad"><input aria-label="Cantidad" type="number" min="0" max="2147483647" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></Field>
    {seeCosts ? <Field label="Costo unitario" mark={money.active}><input aria-label="Costo unitario" inputMode="decimal" value={cost} disabled={lockedPrice} onChange={event => setCost(event.target.value)} placeholder="Opcional" /></Field> : null}
    <Field label="Precio de venta" mark={money.active}><input aria-label="Precio de venta" inputMode="decimal" value={price} disabled={lockedPrice} onChange={event => setPrice(event.target.value)} placeholder="A definir" /></Field>
    {suppliers != null ? <Field label="Proveedor"><InlineSupplier disabled={Boolean(supplierId)} value={supplier} onChange={setSupplier} /></Field> : null}
  </Sheet>;
}

export function AccessoryDetail({ id }: { id: string }) {
  const { inventory, user, reloadInventory, appSession } = useAppContext();
  const { open, close, toast, canManageSensitive = true } = useDesk();
  const money = useMoney();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const item = inventory.find(row => row.id === id) ?? archivedProduct(id);
  if (!item) return null;
  return <Sheet title={item.model} onClose={close} busy={busy} className="eq-sheet" footer={<SheetActions>
    {!item.archivedAt ? <button type="button" className="btn2 s" onClick={() => open({ type: 'edit-eq', id })}>Editar</button> : null}
    <PermanentDeleteButton kind="eq" id={id} />
    {!item.archivedAt && canManageSensitive ? <button type="button" className="btn2 s" onClick={() => open({ type: 'del', kind: 'eq', id, label: item.model })}>Archivar</button> : null}
    {!item.archivedAt && (item.cantidad ?? 0) > 0 ? <button type="button" className="btn2 p" onClick={() => open({ type: 'new-sale', productId: id, source: 'inventory' })}>Vender</button> : null}
  </SheetActions>}>
    {error ? <div role="alert" className="ferr">{error}</div> : null}
    {item.archivedAt ? <div className="pending-sale"><b>Archivado</b>{canManageSensitive ? <button type="button" disabled={busy} onClick={async () => {
      if (!user) return;
      setBusy(true); setError('');
      try { await restoreBackendInventoryItem(user, id); await reloadInventory(); toast('Accesorio restaurado'); close(); }
      catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar')); }
      finally { setBusy(false); }
    }}>Restaurar</button> : null}</div> : null}
    <RecordHistoryButton entityType="inventory" entityId={id} label={item.model} />
    <div className="kv"><span>Tipo</span><b>{item.accessoryType}</b></div>
    <div className="kv"><span>Compatible con</span><b>{item.compatibleWith || 'Todos'}</b></div>
    <div className="kv"><span>Stock</span><b>{item.cantidad ?? 0} u.</b></div>
    {canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role) ? <div className="kv"><span>Costo unitario</span><b data-ph-mask>{item.cost == null ? '—' : money.show(item.cost, item.currency)}</b></div> : null}
    <div className="kv"><span>Precio de venta</span><b data-ph-mask>{item.price == null ? 'A definir' : money.show(item.price, item.currency)}</b></div>
    {item.supplierName ? <div className="kv"><span>Proveedor</span><b>{item.supplierName}</b></div> : null}
  </Sheet>;
}
