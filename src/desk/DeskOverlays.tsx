import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User as FirebaseUser } from 'firebase/auth';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { ImportModal } from '../components/table-engine/components/ImportModal';
import { importBackendInventoryItems, type ImportRow } from '../services/inventory-import-api';
import { importBackendSales } from '../services/sales-import-api';
import { importBackendClients } from '../services/clients-import-api';
import { fetchClientPayments, type ClientPaymentRecord } from '../services/clients-api';
import { importBackendTradeIns } from '../services/trade-ins-import-api';
import { createInvitation, listInvitations, revokeInvitation, type Invitation, type InvitationRole } from '../services/invitations-api';
import type { Client, Product, Sale, TradeIn } from '../types';
import {
  batteryPercent,
  clientName,
  conditionLabel,
  saleBuyer,
  equipmentTitle,
  isInStock,
  formatInputMoney,
  formatMoney,
  formatMoneyCompact,
  formatArDate,
  formatShortDate,
  parseMoney,
  paymentLabel,
  productLabel,
  saleCode,
  statusLabel,
  tradeCode,
} from './format';
import { CatalogEditor, catalogChoices, useCatalogs } from './catalog';
import type { CatalogKind } from '../services/catalogs-api';
import { Actions, DeskIcon, Dialog, Field, Pill, Segs, Sheet, signalDesk, useDesk } from './ui';
import type { Overlay } from './types';
import { clearStoreContactOffer, storeContactErrors } from '../lib/store-contact';
import { markSessionClosed } from './screens/SessionClosed';

function clearBad(setBad: Dispatch<SetStateAction<Record<string, string>>>, key: string) {
  setBad((current) => {
    if (!current[key]) return current;
    const next = { ...current };
    delete next[key];
    return next;
  });
}

const PAYMENTS = [
  { id: 'TRANSFERENCIA', label: 'Transferencia' },
  { id: 'EFECTIVO', label: 'Efectivo' },
  { id: 'TARJETA', label: 'Tarjeta' },
  { id: 'CRIPTO', label: 'Cripto' },
];
const BASE_CAPS = ['64GB', '128GB', '256GB', '512GB'];
const BASE_CONDITIONS = [
  { id: 'NUEVO', label: 'Nuevo' },
  { id: 'USADO', label: 'Usado' },
];
const BASE_TAGS = [
  { id: 'Frecuente', label: 'Frecuente', color: '#8B5CF6' },
  { id: 'Mayorista', label: 'Mayorista', color: '#3B82F6' },
  { id: 'Nuevo', label: 'Nuevo', color: '#E8A33D' },
];
const MODELS = ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15', 'iPhone 16'];
const EQ_STATUS = [
  { id: 'DISPONIBLE', label: 'Disponible', color: '#25A66A' },
  { id: 'EN_REVISION', label: 'En revisión', color: '#E8A33D' },
  { id: 'RESERVADO', label: 'Reservado', color: '#3B82F6' },
  { id: 'VENDIDO', label: 'Vendido', color: '#737984' },
];
const SALE_STATUS = [
  { id: 'COMPLETADA', label: 'Completada', color: '#25A66A' },
  { id: 'PENDIENTE', label: 'Pendiente', color: '#E8A33D' },
  { id: 'CANCELADA', label: 'Cancelada', color: '#DC4C4C' },
];
const CJ_STATUS = [
  { id: 'PENDIENTE', label: 'Pendiente', color: '#E8A33D' },
  { id: 'PERITAJE TÉC.', label: 'Peritaje téc.', color: '#8B5CF6' },
  { id: 'EN REVISIÓN', label: 'En revisión', color: '#3B82F6' },
  { id: 'APROBADO', label: 'Aprobado', color: '#25A66A' },
  { id: 'LISTO', label: 'Completado', color: '#0F9D8A' },
  { id: 'RECHAZADO', label: 'Rechazado', color: '#DC4C4C' },
];
export function DeskOverlays({ overlay }: { overlay: Overlay | null }) {
  if (!overlay) return null;
  if (overlay.type === 'ctx') return <ContextMenu overlay={overlay} />;
  if (overlay.type === 'import') return <ImportHost kind={overlay.kind} />;
  return <OverlayBody key={`${overlay.type}-${'id' in overlay ? overlay.id : ''}`} overlay={overlay} />;
}

function ContextMenu({ overlay }: { overlay: Extract<Overlay, { type: 'ctx' }> }) {
  const { open, close } = useDesk();
  const edit = overlay.kind === 'eq' ? 'edit-eq' : overlay.kind === 'sale' ? 'edit-sale' : overlay.kind === 'cj' ? 'edit-cj' : 'edit-cl';
  return (
    <div className="ov ctxov" onMouseDown={close}>
      <div className="ctx" style={{ top: overlay.y, left: overlay.x }} onMouseDown={(event) => event.stopPropagation()}>
        <div className="ctxh">{overlay.label}</div>
        <button type="button" onClick={() => open({ type: edit, id: overlay.id } as Overlay)}><DeskIcon name="edit" size={18} />Editar</button>
        <button className="danger" type="button" onClick={() => open({ type: 'del', kind: overlay.kind, id: overlay.id, label: overlay.label })}><DeskIcon name="trash" size={18} />Eliminar</button>
      </div>
    </div>
  );
}

function OverlayBody({ overlay }: { overlay: Overlay }) {
  const desk = useDesk();
  const ctx = useAppContext();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, ok: string, options?: { keepOpen?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (!options?.keepOpen) desk.close();
      desk.toast(ok);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };

  if (overlay.type === 'logout') {
    const google = ctx.user?.providerData?.some((provider) => provider.providerId === 'google.com');
    return (
      <Dialog
        title="¿Cerrar sesión?"
        text={google ? 'Vas a tener que volver a entrar con tu cuenta de Google.' : 'Vas a tener que volver a entrar con tu email y contraseña.'}
        ok="Cerrar sesión"
        onClose={desk.close}
        onOk={() => { markSessionClosed(ctx.appSession?.store?.name || 'tu tienda'); ctx.logout(); }}
      />
    );
  }

  if (overlay.type === 'del') {
    const copy = {
      eq: ['este equipo', 'Equipo eliminado'],
      sale: ['esta venta', 'Venta eliminada'],
      cj: ['este canje', 'Canje eliminado'],
      cl: ['este cliente', 'Cliente eliminado'],
    }[overlay.kind];
    return (
      <Dialog
        title={`¿Eliminar ${copy[0]}?`}
        text={`${overlay.label} se va a borrar y no se puede deshacer.`}
        ok="Eliminar"
        danger
        busy={busy}
        error={error}
        onClose={desk.close}
        onOk={() => run(async () => {
          if (overlay.kind === 'eq') await ctx.deleteProduct(overlay.id);
          if (overlay.kind === 'sale') await ctx.deleteSale(overlay.id);
          if (overlay.kind === 'cj') await ctx.deleteTradeIn(overlay.id);
          if (overlay.kind === 'cl') await ctx.deleteClient(overlay.id);
        }, copy[1])}
      />
    );
  }

  if (overlay.type === 'eq') return <EquipmentDetail id={overlay.id} />;
  if (overlay.type === 'new-eq' || overlay.type === 'edit-eq') return <EquipmentForm id={overlay.type === 'edit-eq' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'sale') return <SaleDetail id={overlay.id} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-sale' || overlay.type === 'edit-sale') {
    return <SaleForm id={overlay.type === 'edit-sale' ? overlay.id : undefined} preset={overlay.type === 'new-sale' ? { clientName: overlay.clientName, productId: overlay.productId } : undefined} run={run} busy={busy} error={error} />;
  }
  if (overlay.type === 'cj') return <TradeDetail id={overlay.id} run={run} busy={busy} error={error} />;
  if (overlay.type === 'new-cj' || overlay.type === 'edit-cj') return <TradeForm id={overlay.type === 'edit-cj' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'cl') return <ClientDetail id={overlay.id} />;
  if (overlay.type === 'new-cl' || overlay.type === 'edit-cl') return <ClientForm id={overlay.type === 'edit-cl' ? overlay.id : undefined} run={run} busy={busy} error={error} />;
  if (overlay.type === 'store') return <StoreForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'contact') return <ContactForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'profile') return <ProfileForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'password') return <PasswordForm run={run} busy={busy} error={error} />;
  if (overlay.type === 'invite') return <InviteForm initialUrl={overlay.url} />;
  if (overlay.type === 'invites') return <InvitesList />;
  return null;
}

function batteryText(value: string) {
  if (/\d+\s*-\s*\d+/.test(value)) return value.includes('%') ? value : `${value}%`;
  return `${batteryPercent(value)}%`;
}

function EquipmentDetail({ id }: { id: string }) {
  const { inventory, updateProduct } = useAppContext();
  const { close, open, toast } = useDesk();
  const catalogs = useCatalogs();
  const item = inventory.find((row) => row.id === id);
  const [status, setStatus] = useState(item?.status || 'DISPONIBLE');
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statuses = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', EQ_STATUS);
  if (!item) return null;
  const saveStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      if (status !== item.status) await updateProduct({ ...item, status });
      toast('Estado actualizado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={equipmentTitle(item.model, item.capacity)} subtitle={item.color || undefined} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <div className="dhero"><div className="eb">Precio de venta</div><div className="big">{formatMoney(item.price)}</div></div>
      <div className="kv"><span>Color</span><b>{item.color}</b></div>
      <div className="kv"><span>Condición</span><b>{conditionLabel(item.condition, item.grade)}</b></div>
      <div className="kv"><span>Batería</span><b>{batteryText(item.batteryHealth)}</b></div>
      <Field label="Estado"><span /></Field>
      <Segs options={statuses} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <div className="sacts">
        {isInStock(item.status)
          ? <button className="btn2 s" type="button" onClick={() => open({ type: 'new-sale', productId: item.id })}>Vender</button>
          : <button className="btn2 s" type="button" onClick={close}>Cerrar</button>}
        <button className="btn2 p" type="button" disabled={busy} onClick={() => { void saveStatus(); }}>{busy ? 'Guardando…' : 'Guardar estado'}</button>
      </div>
    </Sheet>
  );
}

function EquipmentForm({ id, run, busy, error }: FormProps & { id?: string }) {
  const { inventory, addProduct, updateProduct } = useAppContext();
  const { close } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = inventory.find((item) => item.id === id);
  const caps = [...new Set([...BASE_CAPS, ...inventory.map((item) => item.capacity).filter(Boolean)])];
  const conditions = [
    ...BASE_CONDITIONS,
    ...[...new Set(inventory.map((item) => item.condition).filter((value) => value && !BASE_CONDITIONS.some((item) => item.id === value)))].map((value) => ({ id: value, label: value === 'PRE-OWNED' ? 'Pre-owned' : value })),
  ];
  const models = [...new Set([...MODELS, ...inventory.map((item) => item.model).filter(Boolean)])];
  const [model, setModel] = useState(current?.model ?? '');
  const [capacity, setCapacity] = useState(current?.capacity ?? '');
  const [color, setColor] = useState(current?.color ?? '');
  const [battery, setBattery] = useState(current?.batteryHealth && current.batteryHealth !== '0%' ? String(batteryPercent(current.batteryHealth)) : '');
  const [imei, setImei] = useState(current?.imei ?? '');
  const [condition, setCondition] = useState(current?.condition ?? '');
  const [price, setPrice] = useState(current ? formatInputMoney(current.price) : '');
  const [status, setStatus] = useState(current?.status ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});

  return (
    <Sheet title={current ? 'Editar equipo' : 'Registrar equipo'} subtitle={current ? equipmentTitle(current.model, current.capacity) : 'Solo el modelo y el precio son obligatorios.'} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Modelo" error={bad.model}><input list="eq-models" value={model} onChange={(event) => { setModel(event.target.value); clearBad(setBad, 'model'); }} placeholder="Ej. iPhone 13" /></Field>
      <datalist id="eq-models">{models.map((item) => <option key={item} value={item} />)}</datalist>
      <Field label="Capacidad"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_CAPACITY', caps.map((item) => ({ id: item, label: item })))} value={capacity} onChange={setCapacity} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_CAPACITY') : undefined} />
      <div className="frow">
        <Field label="Color" error={bad.color}><input value={color} onChange={(event) => { setColor(event.target.value); clearBad(setBad, 'color'); }} placeholder="Ej. Azul" /></Field>
        <Field label="Batería %"><input value={battery} inputMode="numeric" placeholder="Ej. 87" onChange={(event) => setBattery(event.target.value.replace(/\D/g, '').slice(0, 3))} /></Field>
      </div>
      <Field label="IMEI" error={bad.imei}><input value={imei} inputMode="numeric" maxLength={15} onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" /></Field>
      <Field label="Condición"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_CONDITION', conditions)} value={condition} onChange={setCondition} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_CONDITION') : undefined} />
      <Field label="Precio de venta" error={bad.price}><input value={price} inputMode="numeric" onChange={(event) => { setPrice(formatInputMoney(parseMoney(event.target.value))); clearBad(setBad, 'price'); }} placeholder="$ 0" /></Field>
      <Field label="Estado"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', EQ_STATUS)} value={status} onChange={setStatus} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Guardar equipo'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!model.trim()) next.model = 'Completá este dato';
        if (imei.trim() && imei.replace(/\D/g, '').length !== 15) next.imei = 'El IMEI tiene 15 dígitos';
        if (!parseMoney(price)) next.price = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
        const payload: Omit<Product, 'id'> = {
          imei: imei.trim(),
          model: model.trim(),
          capacity,
          color: color.trim(),
          condition,
          grade: !condition ? '' : condition === 'NUEVO' ? 'N/A' : (current?.grade && current.grade !== 'N/A' ? current.grade : 'A'),
          batteryHealth: battery ? `${battery}%` : '',
          cost: current?.cost ?? 0,
          price: parseMoney(price),
          status,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) await updateProduct({ ...current, ...payload });
        else {
          await addProduct(payload);
          signalDesk('desk-eq-saved');
        }
        signalDesk('desk-check', 'inv');
      }, current ? 'Equipo actualizado' : 'Equipo cargado');
      }} />
    </Sheet>
  );
}

function SaleForm({ id, preset, run, busy, error }: FormProps & { id?: string; preset?: { clientName?: string; productId?: string } }) {
  const { sales, clients, inventory, addSale, updateSale } = useAppContext();
  const { close } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = sales.find((sale) => sale.id === id);
  const available = inventory.filter((item) => isInStock(item.status) || item.id === current?.productId || item.id === preset?.productId);
  const [productId, setProductId] = useState(current?.productId || preset?.productId || available[0]?.id || '');
  const linkedName = current?.clientId ? clients.find((client) => client.id === current.clientId)?.name : '';
  const [buyer, setBuyer] = useState(current?.clientName?.trim() || linkedName || preset?.clientName || '');
  const [payment, setPayment] = useState(current?.paymentMethod || 'TRANSFERENCIA');
  const [status, setStatus] = useState(current?.status || 'COMPLETADA');
  const [amount, setAmount] = useState(formatInputMoney(current?.amount || available.find((item) => item.id === (preset?.productId || available[0]?.id))?.price || 0));
  const [bad, setBad] = useState<Record<string, string>>({});
  const selected = available.find((item) => item.id === productId);

  return (
    <Sheet title={current ? 'Editar venta' : 'Registrar venta'} subtitle={current ? `${saleCode(current)} · ${formatShortDate(current.date)}` : 'Elegí el equipo y cómo pagó el cliente.'} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      {available.length === 0 ? <div className="wempty">No hay equipos disponibles.</div> : current ? (
        <Field label="Equipo">
          <select value={productId} onChange={(event) => {
            setProductId(event.target.value);
            const next = available.find((item) => item.id === event.target.value);
            if (next) setAmount(formatInputMoney(next.price));
          }}>
            {available.map((item) => <option key={item.id} value={item.id}>{equipmentTitle(item.model, item.capacity)}</option>)}
          </select>
        </Field>
      ) : (
        <>
          <Field label="Equipo"><span /></Field>
          {available.map((item) => (
            <button key={item.id} type="button" className={`pick${item.id === productId ? ' on' : ''}`} onClick={() => { setProductId(item.id); setAmount(formatInputMoney(item.price)); }}>
              <div>{equipmentTitle(item.model, item.capacity)}<small>{[item.color, item.imei ? `IMEI …${item.imei.slice(-4)}` : ''].filter(Boolean).join(' · ') || 'Sin detalle'}</small></div>
              <span className="r">{formatMoneyCompact(item.price)}</span>
            </button>
          ))}
        </>
      )}
      <Field label="Cliente">
        <input value={buyer} onChange={(event) => setBuyer(event.target.value)} placeholder="Nombre, si lo anotás" maxLength={120} />
      </Field>
      <Field label="Forma de pago"><span /></Field>
      <Segs options={PAYMENTS} value={payment} onChange={setPayment} />
      <Field label="Total" error={bad.amount}><input value={amount} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setAmount(formatInputMoney(parseMoney(event.target.value))); clearBad(setBad, 'amount'); }} /></Field>
      <Field label="Estado"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'SALE_STATUS', SALE_STATUS)} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('SALE_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      {available.length === 0 ? <div className="sacts one"><button className="btn2 p" type="button" onClick={close}>Entendido</button></div> : <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Confirmar venta'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!parseMoney(amount)) next.amount = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
        if (!selected) throw new Error('Seleccioná un equipo disponible.');
        const payload: Omit<Sale, 'id'> = {
          date: current?.date || formatArDate(new Date()),
          clientId: '',
          clientName: buyer.trim(),
          productId: selected.id,
          amount: parseMoney(amount),
          paymentMethod: payment,
          status,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) await updateSale({ ...current, ...payload });
        else {
          await addSale(payload);
          signalDesk('desk-check', 'ven');
        }
      }, current ? 'Venta actualizada' : 'Venta registrada');
      }} />}
    </Sheet>
  );
}

function SaleDetail({ id, run, busy, error }: FormProps & { id: string }) {
  const { sales, clients, inventory, updateSale, updateProduct } = useAppContext();
  const { close, toast } = useDesk();
  const sale = sales.find((item) => item.id === id);
  if (!sale) return null;
  const product = inventory.find((item) => item.id === sale.productId);
  return (
    <Sheet title={saleCode(sale)} subtitle={formatShortDate(sale.date)} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <div className="dhero"><div className="eb">Total</div><div className="big">{formatMoney(sale.amount)}</div></div>
      <div className="kv"><span>Cliente</span><b>{saleBuyer(sale, clients)}</b></div>
      <div className="kv"><span>Equipo</span><b>{productLabel(product)}</b></div>
      <div className="kv"><span>Pago</span><b>{paymentLabel(sale.paymentMethod)}</b></div>
      <div className="kv"><span>Estado</span><b><Pill status={sale.status} kind="SALE_STATUS" /></b></div>
      {sale.status === 'PENDIENTE' ? (
        <Actions busy={busy} secondary="Cancelar venta" primary="Marcar cobrada" onSecondary={() => run(async () => {
          await updateSale({ ...sale, status: 'CANCELADA' });
          if (product && product.status === 'VENDIDO') await updateProduct({ ...product, status: 'DISPONIBLE' });
        }, `${saleCode(sale)} cancelada`)} onPrimary={() => run(async () => { await updateSale({ ...sale, status: 'COMPLETADA' }); }, `${saleCode(sale)} cobrada`)} />
      ) : (
        <div className="sacts">
          <button className="btn2 s" type="button" onClick={close}>Cerrar</button>
          <button className="btn2 p" type="button" onClick={() => {
            const text = `${saleCode(sale)} · ${saleBuyer(sale, clients)} · ${productLabel(product)} · ${formatMoney(sale.amount)} · ${paymentLabel(sale.paymentMethod)}`;
            const copy = () => navigator.clipboard.writeText(text).then(() => toast('Comprobante copiado'));
            if (!navigator.share) { void copy(); return; }
            navigator.share({ title: saleCode(sale), text }).catch((err: unknown) => {
              if (err instanceof DOMException && err.name === 'AbortError') return;
              void copy();
            });
          }}>Compartir comprobante</button>
        </div>
      )}
    </Sheet>
  );
}

function TradeForm({ id, run, busy, error }: FormProps & { id?: string }) {
  const { tradeIns, clients, inventory, addTradeIn, updateTradeIn } = useAppContext();
  const { close } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = tradeIns.find((item) => item.id === id);
  const available = inventory.filter((item) => isInStock(item.status));
  const [clientId, setClientId] = useState(current?.clientId || clients[0]?.id || '');
  const [received, setReceived] = useState(current?.deviceReceived ?? '');
  const [imei, setImei] = useState(current?.deviceReceivedImei ?? '');
  const [given, setGiven] = useState(current?.deviceGiven || (available[0] ? `${available[0].model} ${available[0].capacity}` : ''));
  const [take, setTake] = useState(formatInputMoney(current?.takeValue ?? 0));
  const [diff, setDiff] = useState(formatInputMoney(current?.differencePaid ?? 0));
  const [status, setStatus] = useState(current?.status || 'PENDIENTE');
  const [bad, setBad] = useState<Record<string, string>>({});

  return (
    <Sheet title={current ? 'Editar canje' : 'Nuevo canje'} subtitle={current ? `${tradeCode(tradeIns, current.id)} · ${formatShortDate(current.date)}` : 'El cliente entrega su equipo y se lleva uno del stock.'} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Cliente" error={bad.client}>
        <select value={clientId} onChange={(event) => { setClientId(event.target.value); clearBad(setBad, 'client'); }}>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </Field>
      <div className="frow">
        <Field label="Equipo que recibís" error={bad.received}><input value={received} onChange={(event) => { setReceived(event.target.value); clearBad(setBad, 'received'); }} placeholder="Ej. iPhone 11 64GB" /></Field>
        <Field label="IMEI recibido" error={bad.imei}><input value={imei} inputMode="numeric" maxLength={15} onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" /></Field>
      </div>
      <Field label="Equipo que entregás" error={bad.given}>
        <select value={given} onChange={(event) => {
          clearBad(setBad, 'given');
          setGiven(event.target.value);
          const match = available.find((item) => `${item.model} ${item.capacity}` === event.target.value);
          if (match) setDiff(formatInputMoney(Math.max(0, match.price - parseMoney(take))));
        }}>
          {!available.some((item) => `${item.model} ${item.capacity}` === given) && given && given !== 'A definir' ? <option value={given}>{given}</option> : null}
          {available.map((item) => {
            const label = `${item.model} ${item.capacity}`;
            return <option key={item.id} value={label}>{label}</option>;
          })}
          <option value="A definir">A definir</option>
        </select>
      </Field>
      <div className="frow">
        <Field label="Valor tomado"><input value={take} inputMode="numeric" placeholder="$ 0" onChange={(event) => setTake(formatInputMoney(parseMoney(event.target.value)))} /></Field>
        <Field label="Diferencia"><input value={diff} inputMode="numeric" placeholder="$ 0" onChange={(event) => setDiff(formatInputMoney(parseMoney(event.target.value)))} /></Field>
      </div>
      <Field label="Estado"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'TRADE_IN_STATUS', CJ_STATUS)} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('TRADE_IN_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Crear canje'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!clientId) next.client = 'Completá este dato';
        if (!received.trim()) next.received = 'Completá este dato';
        if (!imei.trim()) next.imei = 'Completá este dato';
        else if (imei.replace(/\D/g, '').length !== 15) next.imei = 'El IMEI tiene 15 dígitos';
        if (!given.trim()) next.given = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
        const payload: Omit<TradeIn, 'id'> = {
          date: current?.date || formatArDate(new Date()),
          clientId,
          deviceReceived: received.trim(),
          deviceReceivedImei: imei.trim(),
          takeValue: parseMoney(take),
          deviceGiven: given,
          differencePaid: parseMoney(diff),
          status,
          batteryHealth: current?.batteryHealth || '100%',
          grade: current?.grade || 'A',
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) await updateTradeIn({ ...current, ...payload });
        else await addTradeIn(payload);
      }, current ? 'Canje actualizado' : 'Canje creado');
      }} />
    </Sheet>
  );
}

function TradeDetail({ id, run, busy, error }: FormProps & { id: string }) {
  const { tradeIns, clients, updateTradeIn } = useAppContext();
  const { close } = useDesk();
  const trade = tradeIns.find((item) => item.id === id);
  if (!trade) return null;
  const flow = ['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO', 'LISTO'];
  const nextLabel: Record<string, string> = { PENDIENTE: 'Enviar a peritaje', 'PERITAJE TÉC.': 'Pasar a revisión', 'EN REVISIÓN': 'Aprobar canje', APROBADO: 'Completar canje' };
  const index = flow.indexOf(trade.status);
  const next = index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
  const code = tradeCode(tradeIns, trade.id);
  return (
    <Sheet title={`${code} · ${clientName(clients, trade.clientId)}`} subtitle={`${formatShortDate(trade.date)} · ${statusLabel(trade.status)}`} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <div className="steps">{flow.map((step, stepIndex) => <i key={step} className={index >= stepIndex ? 'on' : ''} />)}</div>
      <div className="dhero"><div className="eb">Diferencia a cobrar</div><div className="big">{formatMoney(trade.differencePaid)}</div></div>
      <div className="kv"><span>Recibido</span><b>{trade.deviceReceived}</b></div>
      <div className="kv"><span>Valor tomado</span><b>{formatMoney(trade.takeValue)}</b></div>
      <div className="kv"><span>Entrega</span><b>{trade.deviceGiven}</b></div>
      <div className="kv"><span>Estado</span><b><Pill status={trade.status} kind="TRADE_IN_STATUS" /></b></div>
      {next ? (
        <div className="sacts">
          {trade.status === 'APROBADO'
            ? <button className="btn2 s" type="button" onClick={close}>Después</button>
            : <button className="btn2 s" type="button" disabled={busy} onClick={() => run(async () => { await updateTradeIn({ ...trade, status: 'RECHAZADO' }); }, `${code} rechazado`)}>Rechazar</button>}
          <button className="btn2 p" type="button" disabled={busy} onClick={() => run(async () => { await updateTradeIn({ ...trade, status: next }); }, `${code} · ${statusLabel(next)}`, { keepOpen: true })}>{nextLabel[trade.status] || 'Avanzar'}</button>
        </div>
      ) : <div className="sacts one"><button className="btn2 s" type="button" onClick={close}>Cerrar</button></div>}
    </Sheet>
  );
}

function ClientDetail({ id }: { id: string }) {
  const { clients, user, registerClientPayment } = useAppContext();
  const { close, open, toast } = useDesk();
  const client = clients.find((item) => item.id === id);
  const [method, setMethod] = useState('TRANSFERENCIA');
  const [amount, setAmount] = useState('');
  const [payments, setPayments] = useState<ClientPaymentRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setAmount(formatInputMoney(client.pendingBalance));
  }, [client?.id]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchClientPayments(user, id)
      .then((rows) => { if (!cancelled) setPayments(rows); })
      .catch(() => { if (!cancelled) setPayments([]); });
    return () => { cancelled = true; };
  }, [user, id, client?.pendingBalance]);

  if (!client) return null;
  const pay = async () => {
    const value = parseMoney(amount);
    if (!value) {
      setError('Completá el monto');
      return;
    }
    if (value > client.pendingBalance) {
      setError('El monto supera el saldo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await registerClientPayment(client.id, { amount: value, method });
      toast('Pago registrado');
      setAmount(formatInputMoney(updated.pendingBalance));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo registrar el pago.'));
    } finally {
      setBusy(false);
    }
  };
  const bought = client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A';
  return (
    <Sheet title={client.name} subtitle={bought ? `Última compra ${formatShortDate(client.lastPurchaseDate)} · DNI ${client.dni}` : `Sin compras todavía · DNI ${client.dni}`} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <div className="dhero"><div className="eb">Saldo pendiente</div><div className="big">{formatMoney(client.pendingBalance)}</div></div>
      <div className="kv"><span>Teléfono</span><b>{client.phone || '—'}</b></div>
      <div className="kv"><span>Email</span><b>{client.email || '—'}</b></div>
      {client.pendingBalance > 0 ? (
        <>
          <Field label="Monto"><input value={amount} inputMode="numeric" placeholder="$ 0" onChange={(event) => { setAmount(formatInputMoney(parseMoney(event.target.value))); setError(null); }} /></Field>
          <Field label="Forma de pago"><span /></Field>
          <Segs options={PAYMENTS} value={method} onChange={setMethod} />
        </>
      ) : null}
      {payments.length > 0 ? (
        <>
          <Field label="Pagos"><span /></Field>
          {payments.map((payment) => (
            <div className="kv" key={payment.id}><span>{formatShortDate(payment.paidAt)} · {paymentLabel(payment.method)}</span><b>{formatMoney(payment.amount)}</b></div>
          ))}
        </>
      ) : null}
      <div className="sacts">
        {client.pendingBalance > 0
          ? <button className="btn2 s" type="button" disabled={busy} onClick={() => { void pay(); }}>{busy ? 'Guardando…' : 'Registrar pago'}</button>
          : <button className="btn2 s" type="button" onClick={close}>Cerrar</button>}
        <button className="btn2 p" type="button" onClick={() => open({ type: 'new-sale', clientName: client.name })}>Nueva venta</button>
      </div>
    </Sheet>
  );
}

function ClientForm({ id, run, busy, error }: FormProps & { id?: string }) {
  const { clients, addClient, updateClient } = useAppContext();
  const { close } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = clients.find((item) => item.id === id);
  const tags = catalogChoices(catalogs?.options ?? [], 'CLIENT_TAG', BASE_TAGS);
  const [name, setName] = useState(current?.name ?? '');
  const [dni, setDni] = useState(current?.dni ?? '');
  const [phone, setPhone] = useState(current?.phone ?? '');
  const [email, setEmail] = useState(current?.email ?? '');
  const [balance, setBalance] = useState(formatInputMoney(current?.pendingBalance ?? 0));
  const [tag, setTag] = useState(current?.tag ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});

  return (
    <Sheet title={current ? 'Editar cliente' : 'Nuevo cliente'} subtitle={current?.dni ? `DNI ${current.dni}` : undefined} onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Nombre y apellido" error={bad.name}><input value={name} placeholder="Ej. Ana Gómez" onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      {current ? (
        <Field label="Teléfono"><input value={phone} placeholder="Ej. 11 5555 5555" onChange={(event) => setPhone(event.target.value)} /></Field>
      ) : (
        <div className="frow">
          <Field label="DNI" error={bad.dni}><input value={dni} placeholder="Sin puntos" onChange={(event) => { setDni(event.target.value); clearBad(setBad, 'dni'); }} /></Field>
          <Field label="Teléfono"><input value={phone} placeholder="Ej. 11 5555 5555" onChange={(event) => setPhone(event.target.value)} /></Field>
        </div>
      )}
      <Field label="Email"><input value={email} placeholder="ana@correo.com" onChange={(event) => setEmail(event.target.value)} /></Field>
      {current ? <Field label="Saldo pendiente"><input value={balance} inputMode="numeric" placeholder="$ 0" onChange={(event) => setBalance(formatInputMoney(parseMoney(event.target.value)))} /></Field> : null}
      <Field label="Etiqueta"><span /></Field>
      <Segs options={tags} value={tag} onChange={setTag} allowClear onEdit={catalogs?.canEdit ? () => setEditor('CLIENT_TAG') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Guardar cliente'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!name.trim()) next.name = 'Completá este dato';
        if (!dni.trim()) next.dni = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        void run(async () => {
        const payload: Omit<Client, 'id'> = {
          name: name.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
          email: email.trim(),
          lastPurchaseDate: current?.lastPurchaseDate || 'N/A',
          totalSpent: current?.totalSpent ?? 0,
          pendingBalance: parseMoney(balance),
          tag: tag || null,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) await updateClient({ ...current, ...payload });
        else await addClient(payload);
      }, current ? 'Cliente actualizado' : 'Cliente guardado');
      }} />
    </Sheet>
  );
}

function StoreForm({ run, busy, error }: FormProps) {
  const { appSession, updateStore } = useAppContext();
  const { close } = useDesk();
  const store = appSession?.store;
  const [name, setName] = useState(store?.name ?? '');
  const [taxId, setTaxId] = useState(store?.taxId ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [phone, setPhone] = useState(store?.phone ?? '');
  const [email, setEmail] = useState(store?.email ?? '');
  const [instagram, setInstagram] = useState(store?.instagram ?? '');
  const [currency, setCurrency] = useState(store?.currency || 'ARS');
  const [bad, setBad] = useState<Record<string, string>>({});
  return (
    <Sheet title="Datos de la tienda" onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Nombre" error={bad.name}><input value={name} onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      <Field label="CUIT"><input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></Field>
      <Field label="Dirección"><input value={address} onChange={(event) => setAddress(event.target.value)} /></Field>
      <ContactFields phone={phone} email={email} instagram={instagram} bad={bad} onPhone={setPhone} onEmail={setEmail} onInstagram={setInstagram} onClear={(key) => clearBad(setBad, key)} />
      <Field label="Moneda">
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>ARS</option><option>USD</option></select>
      </Field>
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        const contact = storeContactErrors({ email, instagram });
        if (!name.trim() || contact.email || contact.instagram) {
          setBad({ ...contact, ...(!name.trim() ? { name: 'Completá este dato' } : {}) });
          return;
        }
        setBad({});
        void run(async () => {
        await updateStore({
          name: name.trim(),
          taxId: taxId.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          instagram: instagram.trim() || null,
          currency,
        });
        if (store?.id) clearStoreContactOffer(store.id);
      }, 'Tienda actualizada');
      }} />
    </Sheet>
  );
}

function ContactForm({ run, busy, error }: FormProps) {
  const { appSession, updateStore } = useAppContext();
  const { close } = useDesk();
  const store = appSession?.store;
  const [phone, setPhone] = useState(store?.phone ?? '');
  const [email, setEmail] = useState(store?.email ?? '');
  const [instagram, setInstagram] = useState(store?.instagram ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const dismiss = () => {
    if (store?.id) clearStoreContactOffer(store.id);
    close();
  };
  return (
    <Sheet title="Datos de contacto" subtitle="Podés completarlos ahora o más tarde desde Configuración." onClose={dismiss}>
      {error && <div className="ferr">{error}</div>}
      <ContactFields phone={phone} email={email} instagram={instagram} bad={bad} onPhone={setPhone} onEmail={setEmail} onInstagram={setInstagram} onClear={(key) => clearBad(setBad, key)} />
      <Actions busy={busy} primary="Guardar" secondary="Ahora no" onSecondary={dismiss} onPrimary={() => {
        const contact = storeContactErrors({ email, instagram });
        if (contact.email || contact.instagram) { setBad(contact); return; }
        setBad({});
        void run(async () => {
          await updateStore({
            phone: phone.trim() || null,
            email: email.trim() || null,
            instagram: instagram.trim() || null,
          });
          if (store?.id) clearStoreContactOffer(store.id);
        }, 'Datos de contacto guardados');
      }} />
    </Sheet>
  );
}

function ContactFields({ phone, email, instagram, bad, onPhone, onEmail, onInstagram, onClear }: {
  phone: string;
  email: string;
  instagram: string;
  bad: Record<string, string>;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
  onInstagram: (value: string) => void;
  onClear: (key: string) => void;
}) {
  return (
    <>
      <Field label="Teléfono"><input value={phone} inputMode="tel" placeholder="Ej. 11 5555 5555" onChange={(event) => onPhone(event.target.value)} /></Field>
      <Field label="Correo electrónico" error={bad.email}><input type="email" value={email} placeholder="hola@tienda.com" onChange={(event) => { onEmail(event.target.value); onClear('email'); }} /></Field>
      <Field label="Instagram" error={bad.instagram}><input value={instagram} placeholder="@tienda" onChange={(event) => { onInstagram(event.target.value); onClear('instagram'); }} /></Field>
    </>
  );
}

function ProfileForm({ run, busy, error }: FormProps) {
  const { appSession, updateUserProfile } = useAppContext();
  const { close } = useDesk();
  const [name, setName] = useState(appSession?.user.displayName ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  return (
    <Sheet title="Perfil" onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Nombre" error={bad.name}><input value={name} onChange={(event) => { setName(event.target.value); clearBad(setBad, 'name'); }} /></Field>
      <Field label="Email"><input type="email" value={appSession?.user.email ?? ''} disabled /></Field>
      <Actions busy={busy} primary="Guardar" onSecondary={close} onPrimary={() => {
        if (!name.trim()) { setBad({ name: 'Completá este dato' }); return; }
        setBad({});
        void run(async () => {
        await updateUserProfile({ displayName: name.trim() });
      }, 'Perfil actualizado');
      }} />
    </Sheet>
  );
}

function PasswordForm({ run, busy, error }: FormProps) {
  const { user } = useAppContext();
  const { close } = useDesk();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [bad, setBad] = useState<Record<string, string>>({});
  const emailUser = user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
  if (!emailUser) {
    return <Sheet title="Seguridad" subtitle="Esta cuenta entra con Google. La contraseña se administra ahí." onClose={close}><div className="sacts one"><button className="btn2 p" type="button" onClick={close}>Entendido</button></div></Sheet>;
  }
  return (
    <Sheet title="Cambiar contraseña" subtitle="Usá al menos 8 caracteres." onClose={close}>
      {error && <div className="ferr">{error}</div>}
      <Field label="Contraseña actual" error={bad.current}><input type="password" value={current} onChange={(event) => { setCurrent(event.target.value); clearBad(setBad, 'current'); }} /></Field>
      <Field label="Nueva contraseña" error={bad.next}><input type="password" value={next} onChange={(event) => { setNext(event.target.value); clearBad(setBad, 'next'); }} /></Field>
      <Field label="Repetir nueva" error={bad.repeat}><input type="password" value={repeat} onChange={(event) => { setRepeat(event.target.value); clearBad(setBad, 'repeat'); }} /></Field>
      <Actions busy={busy} primary="Actualizar" onSecondary={close} onPrimary={() => {
        const fields: Record<string, string> = {};
        if (!current) fields.current = 'Completá este dato';
        if (!next) fields.next = 'Completá este dato';
        else if (next.length < 8) fields.next = 'Mínimo 8 caracteres';
        if (!repeat) fields.repeat = 'Completá este dato';
        else if (next && next !== repeat) fields.repeat = 'No coinciden';
        setBad(fields);
        if (Object.keys(fields).length) return;
        void run(async () => {
        if (!user?.email || !('reload' in user)) throw new Error('No se pudo validar la sesión.');
        const firebaseUser = user as FirebaseUser;
        const credential = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(firebaseUser, credential);
        await updatePassword(firebaseUser, next);
      }, 'Contraseña actualizada');
      }} />
    </Sheet>
  );
}

function InviteForm({ initialUrl }: { initialUrl?: string }) {
  const { user, appSession } = useAppContext();
  const { close, toast } = useDesk();
  const [role, setRole] = useState<InvitationRole>('STAFF');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const store = appSession?.store?.name || 'la tienda';
  const roleLabel = role === 'MANAGER' ? 'Socio' : 'Empleado';
  const copy = () => navigator.clipboard.writeText(url).then(() => toast('Link copiado'));
  const share = () => {
    if (!navigator.share) { void copy(); return; }
    navigator.share({ title: 'Invitación a iManager', url }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      void copy();
    });
  };
  return (
    <Sheet
      title={url ? 'Link listo' : 'Invitar al equipo'}
      subtitle={url ? `Pasáselo a quien quieras sumar como ${roleLabel}. Sirve para una sola persona${expires ? ` y vence el ${expires}` : ''}.` : `Generá un link de un solo uso para sumar a alguien a ${store}.`}
      onClose={close}
    >
      {error && <div className="ferr">{error}</div>}
      {url ? (
        <>
          <div className="linkrow"><span>{url}</span><button className="copy" type="button" onClick={() => { void copy(); }}>Copiar</button></div>
          <p className="sheet-note">Cuando alguien entra con el link, deja de funcionar. Lo podés cancelar desde Configuración.</p>
        </>
      ) : (
        <>
          <Field label="Rol"><span /></Field>
          <Segs options={[{ id: 'STAFF', label: 'Empleado' }, { id: 'MANAGER', label: 'Socio' }]} value={role} onChange={(value) => setRole(value as InvitationRole)} />
          <p className="sheet-note">El Empleado carga equipos y ventas. El Socio además ve reportes y aprueba canjes.</p>
        </>
      )}
      {url ? (
        <div className="sacts">
          <button className="btn2 s" type="button" onClick={close}>Listo</button>
          <button className="btn2 p" type="button" onClick={share}>Compartir link</button>
        </div>
      ) : (
        <Actions busy={busy} primary="Generar link" onSecondary={close} onPrimary={() => {
          if (!user) return;
          setBusy(true);
          setError(null);
          createInvitation(user, undefined, role)
            .then((created) => {
              setUrl(created.inviteUrl);
              setExpires(formatArDate(new Date(created.expiresAt)));
              window.dispatchEvent(new Event('desk-invites'));
            })
            .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo crear la invitación.')))
            .finally(() => setBusy(false));
        }} />
      )}
    </Sheet>
  );
}

function InvitesList() {
  const { user } = useAppContext();
  const { close, toast } = useDesk();
  const [rows, setRows] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    if (!user) return;
    listInvitations(user).then(setRows).catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudieron cargar las invitaciones.')));
  };
  useEffect(() => { load(); }, [user]);
  const roleName = (value: string) => (value === 'MANAGER' ? 'Socio' : value === 'OWNER' ? 'Propietario' : 'Empleado');
  const when = (value: string) => formatArDate(new Date(value));
  return (
    <Sheet title="Links de invitación" subtitle="Cada link sirve una sola vez y vence solo." onClose={close}>
      {error && <div className="ferr">{error}</div>}
      {rows.length === 0 ? <div className="wempty">No quedan invitaciones.</div> : rows.map((invite) => (
        <div className="kv" key={invite.id}>
          <span>{roleName(invite.role)} · un solo uso · vence {when(invite.expiresAt)}</span>
          <button className="mbtn" type="button" onClick={() => {
            if (!user) return;
            revokeInvitation(user, invite.id)
              .then(() => { toast('Invitación cancelada'); load(); window.dispatchEvent(new Event('desk-invites')); })
              .catch((err) => setError(getFriendlyErrorMessage(err, 'No se pudo cancelar.')));
          }}>Cancelar</button>
        </div>
      ))}
      <div className="sacts one"><button className="btn2 s" type="button" onClick={close}>Listo</button></div>
    </Sheet>
  );
}

function ImportHost({ kind }: { kind: 'inv' | 'sale' | 'cl' | 'cj' }) {
  const { user, reloadInventory, reloadSales, reloadClients, reloadTradeIns } = useAppContext();
  const { close, toast } = useDesk();
  const config = useMemo(() => importConfig(kind, async () => {
    if (kind === 'inv') await reloadInventory();
    if (kind === 'sale') await reloadSales();
    if (kind === 'cl') await reloadClients();
    if (kind === 'cj') await reloadTradeIns();
  }), [kind, reloadInventory, reloadSales, reloadClients, reloadTradeIns]);
  if (!user) return null;
  const noun: Record<typeof kind, [string, string]> = {
    inv: ['equipo importado', 'equipos importados'],
    sale: ['venta importada', 'ventas importadas'],
    cl: ['cliente importado', 'clientes importados'],
    cj: ['canje importado', 'canjes importados'],
  };
  return <ImportModal title={config.title} fields={config.fields} mapHints={config.hints} onClose={close} onImport={async (rows) => {
    const result = await config.onImport(user, rows);
    const count = (result.imported ?? 0) + (result.updated ?? 0);
    toast(`${count} ${count === 1 ? noun[kind][0] : noun[kind][1]}`);
    if (kind === 'inv') signalDesk('desk-check', 'inv');
    if (kind === 'sale') signalDesk('desk-check', 'ven');
    return result;
  }} />;
}

type FormProps = { run: (action: () => Promise<void>, ok: string, options?: { keepOpen?: boolean }) => Promise<void>; busy: boolean; error: string | null };

function importConfig(kind: 'inv' | 'sale' | 'cl' | 'cj', after: () => Promise<void>) {
  if (kind === 'inv') {
    return {
      title: 'Importar equipos',
      fields: [
        { key: 'model', label: 'Modelo', required: true },
        { key: 'imei', label: 'IMEI', required: false },
        { key: 'price', label: 'Precio', required: false },
        { key: 'capacity', label: 'Capacidad', required: false },
        { key: 'color', label: 'Color', required: false },
        { key: 'condition', label: 'Condición', required: false },
        { key: 'grade', label: 'Grado', required: false },
        { key: 'batteryHealth', label: 'Batería', required: false },
        { key: 'cost', label: 'Costo', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      hints: { modelo: 'model', imei: 'imei', precio: 'price', capacidad: 'capacity', color: 'color', condicion: 'condition', grado: 'grade', bateria: 'batteryHealth', costo: 'cost', estado: 'status' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const parseNum = (value?: string) => value ? Number(value.replace(/\./g, '').replace(',', '.')) || 0 : undefined;
        const payload: ImportRow[] = rows.map((row) => ({
          imei: row.imei ?? '',
          model: row.model ?? '',
          price: parseNum(row.price) ?? 0,
          capacity: row.capacity,
          color: row.color,
          condition: row.condition,
          grade: row.grade,
          batteryHealth: row.batteryHealth,
          cost: parseNum(row.cost),
          status: row.status,
        }));
        const result = await importBackendInventoryItems(user, payload);
        await after();
        return result;
      },
    };
  }
  if (kind === 'sale') {
    return {
      title: 'Importar ventas',
      fields: [
        { key: 'clientName', label: 'Cliente', required: false },
        { key: 'productImei', label: 'IMEI', required: true },
        { key: 'amount', label: 'Total', required: false },
        { key: 'date', label: 'Fecha', required: false },
        { key: 'paymentMethod', label: 'Pago', required: false },
        { key: 'status', label: 'Estado', required: false },
      ],
      hints: { cliente: 'clientName', imei: 'productImei', total: 'amount', fecha: 'date', pago: 'paymentMethod', estado: 'status' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const result = await importBackendSales(user, rows);
        await after();
        return result;
      },
    };
  }
  if (kind === 'cl') {
    return {
      title: 'Importar clientes',
      fields: [
        { key: 'name', label: 'Nombre', required: true },
        { key: 'dni', label: 'DNI', required: false },
        { key: 'phone', label: 'Teléfono', required: false },
        { key: 'email', label: 'Email', required: false },
      ],
      hints: { nombre: 'name', dni: 'dni', telefono: 'phone', email: 'email' },
      onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
        const result = await importBackendClients(user, rows);
        await after();
        return result;
      },
    };
  }
  return {
    title: 'Importar canjes',
    fields: [
      { key: 'clientName', label: 'Cliente', required: true },
      { key: 'deviceReceived', label: 'Equipo recibido', required: true },
      { key: 'deviceReceivedImei', label: 'IMEI recibido', required: true },
      { key: 'takeValue', label: 'Valor tomado', required: true },
      { key: 'deviceGiven', label: 'Equipo entregado', required: true },
      { key: 'differencePaid', label: 'Diferencia', required: true },
      { key: 'status', label: 'Estado', required: false },
    ],
    hints: { cliente: 'clientName', recibido: 'deviceReceived', imei: 'deviceReceivedImei', valor: 'takeValue', entrega: 'deviceGiven', diferencia: 'differencePaid', estado: 'status' },
    onImport: async (user: NonNullable<ReturnType<typeof useAppContext>['user']>, rows: Record<string, string>[]) => {
      const result = await importBackendTradeIns(user, rows);
      await after();
      return result;
    },
  };
}
