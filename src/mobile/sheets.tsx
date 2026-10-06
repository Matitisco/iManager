import { useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User as FirebaseUser } from 'firebase/auth';
import { useAppContext } from '../context/AppContext';
import { getFriendlyErrorMessage } from '../lib/utils';
import { importBackendInventoryItems } from '../services/inventory-import-api';
import { importBackendSales } from '../services/sales-import-api';
import { importBackendClients } from '../services/clients-import-api';
import { importBackendTradeIns } from '../services/trade-ins-import-api';
import { createInvitation, listInvitations, revokeInvitation, type Invitation } from '../services/invitations-api';
import { parseWorkbook } from '../utils/parse-workbook';
import {
  ROLE_LABEL,
  clientName,
  formatMoney,
  mapImportRows,
  parseMoneyInput,
  paymentLabel,
  productLabel,
  saleCode,
  statusLabel,
  type ImportField,
} from './logic';
import { useMobileUi, type ImportEntity, type MenuEntity } from './state';
import { ContextMenu, Dialog, ErrorNote, Field, PopMenu, Segments, SelectField, Sheet, SheetActions } from './ui';

const PAYMENTS = ['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CANJE / PAGO'];
const CAPACITIES = ['64GB', '128GB', '256GB', '512GB', '1TB'];
const CONDITIONS = ['NUEVO', 'USADO', 'PRE-OWNED'];
const PRODUCT_STATUSES = ['DISPONIBLE', 'EN_REVISION', 'VENDIDO'];
const SALE_STATUSES = ['COMPLETADA', 'PENDIENTE'];
const TRADE_STATUSES = ['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO', 'LISTO', 'RECHAZADO'];

function todayLabel() {
  return new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function moneyField(value: number) {
  return value ? String(Math.round(value)) : '';
}

export function OverlayHost() {
  const ui = useMobileUi();
  const overlay = ui.overlay;
  if (!overlay) return null;

  if (overlay.type === 'menu') {
    return (
      <ContextMenu
        title={overlay.label}
        top={overlay.top}
        onClose={ui.closeOverlay}
        onEdit={() => ui.openOverlay(editOverlay(overlay.entity, overlay.id))}
        onDelete={() => ui.openOverlay({ type: 'delete', entity: overlay.entity, id: overlay.id, label: overlay.label })}
      />
    );
  }
  if (overlay.type === 'delete') return <DeleteDialog entity={overlay.entity} id={overlay.id} label={overlay.label} />;
  if (overlay.type === 'product') return <ProductDetail id={overlay.id} />;
  if (overlay.type === 'product-edit') return <ProductForm id={overlay.id} />;
  if (overlay.type === 'product-new') return <ProductForm />;
  if (overlay.type === 'sale') return <SaleDetail id={overlay.id} />;
  if (overlay.type === 'sale-edit') return <SaleForm id={overlay.id} />;
  if (overlay.type === 'sale-new') return <SaleForm productId={overlay.productId} clientId={overlay.clientId} />;
  if (overlay.type === 'trade') return <TradeDetail id={overlay.id} />;
  if (overlay.type === 'trade-edit') return <TradeForm id={overlay.id} />;
  if (overlay.type === 'trade-new') return <TradeForm />;
  if (overlay.type === 'client') return <ClientDetail id={overlay.id} />;
  if (overlay.type === 'client-edit') return <ClientForm id={overlay.id} />;
  if (overlay.type === 'client-new') return <ClientForm />;
  if (overlay.type === 'import') return <ImportSheet entity={overlay.entity} />;
  if (overlay.type === 'invite') return <InviteSheet />;
  if (overlay.type === 'invite-link') return <InviteLinkSheet invitation={overlay.invitation} />;
  if (overlay.type === 'invites') return <InvitesSheet />;
  if (overlay.type === 'store') return <StoreSheet />;
  if (overlay.type === 'profile') return <ProfileSheet />;
  if (overlay.type === 'password') return <PasswordSheet />;
  if (overlay.type === 'billing') return <BillingSheet />;
  if (overlay.type === 'sort') {
    return (
      <PopMenu
        items={['Recientes', 'Precio ↑', 'Precio ↓']}
        current={ui.invSort}
        onClose={ui.closeOverlay}
        onPick={(value) => {
          ui.setInvSort(value as typeof ui.invSort);
          ui.closeOverlay();
        }}
      />
    );
  }
  if (overlay.type === 'sale-period') {
    return (
      <PopMenu
        items={['Semana', 'Mes', 'Año']}
        current={ui.salePeriod}
        onClose={ui.closeOverlay}
        onPick={(value) => {
          ui.setSalePeriod(value as typeof ui.salePeriod);
          ui.closeOverlay();
        }}
      />
    );
  }
  if (overlay.type === 'logout') return <LogoutDialog />;
  return null;
}

function editOverlay(entity: MenuEntity, id: string) {
  if (entity === 'product') return { type: 'product-edit' as const, id };
  if (entity === 'sale') return { type: 'sale-edit' as const, id };
  if (entity === 'trade') return { type: 'trade-edit' as const, id };
  return { type: 'client-edit' as const, id };
}

function DeleteDialog({ entity, id, label }: { entity: MenuEntity; id: string; label: string }) {
  const { deleteProduct, deleteSale, deleteTradeIn, deleteClient } = useAppContext();
  const ui = useMobileUi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const what = { product: 'este equipo', sale: 'esta venta', trade: 'este canje', client: 'este cliente' }[entity];

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (entity === 'product') await deleteProduct(id);
      if (entity === 'sale') await deleteSale(id);
      if (entity === 'trade') await deleteTradeIn(id);
      if (entity === 'client') await deleteClient(id);
      await ui.refresh();
      ui.closeOverlay();
      ui.toast('Eliminado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo eliminar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ov center" onClick={ui.closeOverlay}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <h3>¿Eliminar {what}?</h3>
        <p>{label} se va a borrar y no se puede deshacer.</p>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="row">
          <button type="button" className="cancel" onClick={ui.closeOverlay} disabled={busy}>Cancelar</button>
          <button type="button" className="ok danger" onClick={() => { void confirm(); }} disabled={busy}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ id }: { id: string }) {
  const { inventory, updateProduct } = useAppContext();
  const ui = useMobileUi();
  const product = inventory.find((item) => item.id === id);
  const [status, setStatus] = useState(product?.status ?? 'DISPONIBLE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!product) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProduct({ ...product, status });
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(`${product.model} · ${statusLabel(status)}`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el estado'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`${product.model} · ${product.capacity}`} subtitle={`IMEI ${product.imei}`} onClose={ui.closeOverlay}>
      <div className="dhero"><div className="eb">Precio de venta</div><div className="big">{formatMoney(product.price)}</div></div>
      <div className="kv"><span>Color</span><b>{product.color}</b></div>
      <div className="kv"><span>Condición</span><b>{product.condition}{product.grade ? ` · Grado ${product.grade}` : ''}</b></div>
      <div className="kv"><span>Batería</span><b>{product.batteryHealth}</b></div>
      <div className="kv"><span>Costo</span><b>{formatMoney(product.cost)}</b></div>
      <Segments label="Estado" value={status} options={PRODUCT_STATUSES.map(statusLabel)} onChange={(label) => {
        const match = PRODUCT_STATUSES.find((item) => statusLabel(item) === label);
        if (match) setStatus(match);
      }} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="sacts">
        {product.status === 'DISPONIBLE' ? (
          <button type="button" className="btn2 s" onClick={() => ui.openOverlay({ type: 'sale-new', productId: product.id })}>Vender</button>
        ) : (
          <button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button>
        )}
        <button type="button" className="btn2 p" onClick={() => { void save(); }} disabled={busy}>{busy ? 'Guardando…' : 'Guardar estado'}</button>
      </div>
    </Sheet>
  );
}

function ProductForm({ id }: { id?: string }) {
  const { inventory, addProduct, updateProduct } = useAppContext();
  const ui = useMobileUi();
  const existing = inventory.find((item) => item.id === id);
  const [model, setModel] = useState(existing?.model ?? '');
  const [capacity, setCapacity] = useState(existing?.capacity || '128GB');
  const [color, setColor] = useState(existing?.color ?? '');
  const [battery, setBattery] = useState(existing?.batteryHealth ?? '');
  const [imei, setImei] = useState(existing?.imei ?? '');
  const [condition, setCondition] = useState(existing?.condition || 'USADO');
  const [grade, setGrade] = useState(existing?.grade || 'A');
  const [price, setPrice] = useState(moneyField(existing?.price ?? 0));
  const [cost, setCost] = useState(moneyField(existing?.cost ?? 0));
  const [status, setStatus] = useState(existing?.status || 'DISPONIBLE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!model.trim() || !imei.trim() || !color.trim() || !battery.trim()) {
      setError('Completá modelo, IMEI, color y batería.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      imei: imei.trim(),
      model: model.trim(),
      capacity,
      color: color.trim(),
      condition,
      grade: grade.trim() || 'N/A',
      batteryHealth: battery.trim(),
      cost: parseMoneyInput(cost),
      price: parseMoneyInput(price),
      status,
      categoryId: existing?.categoryId ?? null,
      customFields: existing?.customFields,
    };
    try {
      if (existing) await updateProduct({ ...existing, ...payload });
      else await addProduct(payload);
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(existing ? 'Equipo actualizado' : 'Equipo cargado');
      if (!existing) ui.go('inv');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el equipo'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={existing ? 'Editar equipo' : 'Registrar equipo'} subtitle={existing ? `IMEI ${existing.imei}` : 'Completá los datos del equipo. Lo podés editar después.'} onClose={ui.closeOverlay}>
      <Field label="Modelo" value={model} onChange={setModel} placeholder="Ej. iPhone 13" />
      <Segments label="Capacidad" value={capacity} options={CAPACITIES} onChange={setCapacity} />
      <div className="frow">
        <Field label="Color" value={color} onChange={setColor} placeholder="Ej. Azul" />
        <Field label="Batería" value={battery} onChange={setBattery} placeholder="85% o 83-85%" />
      </div>
      <Field label="IMEI" value={imei} onChange={setImei} placeholder="Serial o IMEI" />
      <Segments label="Condición" value={condition} options={CONDITIONS} onChange={setCondition} />
      <Field label="Grado" value={grade} onChange={setGrade} placeholder="A+" />
      <div className="frow">
        <Field label="Costo" value={cost} onChange={setCost} placeholder="$ 0" inputMode="numeric" />
        <Field label="Precio de venta" value={price} onChange={setPrice} placeholder="$ 0" inputMode="numeric" />
      </div>
      <Segments label="Estado" value={statusLabel(status)} options={PRODUCT_STATUSES.map(statusLabel)} onChange={(label) => {
        const match = PRODUCT_STATUSES.find((item) => statusLabel(item) === label);
        if (match) setStatus(match);
      }} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel={existing ? 'Guardar cambios' : 'Guardar equipo'} busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
    </Sheet>
  );
}

function SaleDetail({ id }: { id: string }) {
  const { sales, clients, inventory, updateSale } = useAppContext();
  const ui = useMobileUi();
  const sale = sales.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sale) return null;
  const product = inventory.find((item) => item.id === sale.productId);

  const markPaid = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateSale({ ...sale, status: 'COMPLETADA' });
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(`${saleCode(sale)} cobrada`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo actualizar la venta'));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `${saleCode(sale)} · ${clientName(clients, sale.clientId)} · ${productLabel(product)} · ${formatMoney(sale.amount)}`;
    try {
      if (navigator.share) await navigator.share({ title: saleCode(sale), text });
      else await navigator.clipboard.writeText(text);
      ui.toast('Comprobante listo para compartir');
    } catch {
      ui.toast('No se pudo compartir');
    }
  };

  return (
    <Sheet title={saleCode(sale)} subtitle={sale.date} onClose={ui.closeOverlay}>
      <div className="dhero"><div className="eb">Total</div><div className="big">{formatMoney(sale.amount)}</div></div>
      <div className="kv"><span>Cliente</span><b>{clientName(clients, sale.clientId)}</b></div>
      <div className="kv"><span>Equipo</span><b>{productLabel(product)}</b></div>
      <div className="kv"><span>Pago</span><b>{paymentLabel(sale.paymentMethod)}</b></div>
      <div className="kv"><span>Estado</span><b>{statusLabel(sale.status)}</b></div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="sacts">
        {sale.status === 'PENDIENTE' ? (
          <button type="button" className="btn2 s" onClick={() => { void markPaid(); }} disabled={busy}>Marcar cobrada</button>
        ) : (
          <button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button>
        )}
        <button type="button" className="btn2 p" onClick={() => { void share(); }}>Compartir comprobante</button>
      </div>
    </Sheet>
  );
}

function SaleForm({ id, productId, clientId }: { id?: string; productId?: string; clientId?: string }) {
  const { sales, clients, inventory, addSale, updateSale, addClient } = useAppContext();
  const ui = useMobileUi();
  const existing = sales.find((item) => item.id === id);
  const available = inventory.filter((item) => item.status === 'DISPONIBLE' || item.id === existing?.productId || item.id === productId);
  const [chosenProduct, setChosenProduct] = useState(existing?.productId || productId || available[0]?.id || '');
  const [chosenClient, setChosenClient] = useState(existing?.clientId || clientId || clients[0]?.id || '');
  const [payment, setPayment] = useState(existing?.paymentMethod || 'TRANSFERENCIA');
  const [amount, setAmount] = useState(moneyField(existing?.amount ?? inventory.find((item) => item.id === (productId || available[0]?.id))?.price ?? 0));
  const [status, setStatus] = useState(existing?.status || 'COMPLETADA');
  const [newName, setNewName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const product = inventory.find((item) => item.id === chosenProduct);

  const save = async () => {
    if (!product) {
      setError('Seleccioná un equipo disponible.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let nextClientId = chosenClient;
      if (!nextClientId) {
        if (!newName.trim() || !newDni.trim()) {
          setError('Elegí un cliente o cargá nombre y DNI.');
          setBusy(false);
          return;
        }
        const created = await addClient({
          name: newName.trim(),
          dni: newDni.trim(),
          email: '',
          phone: '',
          lastPurchaseDate: 'N/A',
          totalSpent: 0,
          pendingBalance: 0,
        });
        nextClientId = created.id;
      }
      if (existing) {
        await updateSale({
          ...existing,
          clientId: nextClientId,
          productId: product.id,
          amount: parseMoneyInput(amount) || product.price,
          paymentMethod: payment,
          status,
        });
      } else {
        await addSale({
          date: todayLabel(),
          clientId: nextClientId,
          productId: product.id,
          amount: parseMoneyInput(amount) || product.price,
          paymentMethod: payment,
          status,
        });
      }
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(existing ? 'Venta actualizada' : 'Venta registrada');
      ui.go('ven');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar la venta'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={existing ? 'Editar venta' : 'Registrar venta'} subtitle={existing ? `${saleCode(existing)} · ${existing.date}` : 'Elegí el equipo y cómo pagó el cliente.'} onClose={ui.closeOverlay}>
      {available.length ? (
        <>
          <label className="fl"><span>Equipo</span></label>
          {available.map((item) => (
            <button key={item.id} type="button" className={`pick${item.id === chosenProduct ? ' on' : ''}`} onClick={() => { setChosenProduct(item.id); if (!existing) setAmount(moneyField(item.price)); }}>
              <div>{item.model} · {item.capacity}<small>{item.color} · IMEI …{item.imei.slice(-4)}</small></div>
              <span className="r">{formatMoney(item.price)}</span>
            </button>
          ))}
          {clients.length ? (
            <SelectField label="Cliente" value={chosenClient} onChange={setChosenClient} options={clients.map((client) => ({ value: client.id, label: client.name }))} />
          ) : (
            <div className="frow">
              <Field label="Nombre del cliente" value={newName} onChange={setNewName} />
              <Field label="DNI" value={newDni} onChange={setNewDni} />
            </div>
          )}
          <Segments label="Forma de pago" value={paymentLabel(payment)} options={PAYMENTS.map(paymentLabel)} onChange={(label) => {
            const match = PAYMENTS.find((item) => paymentLabel(item) === label);
            if (match) setPayment(match);
          }} />
          <Field label="Total" value={amount} onChange={setAmount} inputMode="numeric" />
          <Segments label="Estado" value={statusLabel(status)} options={SALE_STATUSES.map(statusLabel)} onChange={(label) => {
            const match = SALE_STATUSES.find((item) => statusLabel(item) === label);
            if (match) setStatus(match);
          }} />
        </>
      ) : <div className="wempty">No hay equipos disponibles. Cargá uno en Inventario.</div>}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {available.length ? (
        <SheetActions confirmLabel={existing ? 'Guardar cambios' : 'Confirmar venta'} busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
      ) : (
        <div className="sacts one"><button type="button" className="btn2 p" onClick={ui.closeOverlay}>Entendido</button></div>
      )}
    </Sheet>
  );
}

function TradeDetail({ id }: { id: string }) {
  const { tradeIns, clients, updateTradeIn } = useAppContext();
  const ui = useMobileUi();
  const trade = tradeIns.find((item) => item.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!trade) return null;
  const flow = ['PENDIENTE', 'PERITAJE TÉC.', 'EN REVISIÓN', 'APROBADO', 'LISTO'];
  const index = flow.indexOf(trade.status);

  const advance = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      await updateTradeIn({ ...trade, status });
      await ui.refresh();
      ui.toast(`${statusLabel(status)}`);
      ui.openOverlay({ type: 'trade', id });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo actualizar el canje'));
    } finally {
      setBusy(false);
    }
  };

  let action = <div className="sacts one"><button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button></div>;
  if (index >= 0 && index < flow.length - 1) {
    const next = flow[index + 1];
    action = (
      <div className="sacts">
        <button type="button" className="btn2 s" disabled={busy} onClick={() => { void advance('RECHAZADO'); }}>Rechazar</button>
        <button type="button" className="btn2 p" disabled={busy} onClick={() => { void advance(next); }}>{next === 'LISTO' ? 'Completar canje' : `Pasar a ${statusLabel(next).toLowerCase()}`}</button>
      </div>
    );
  }

  return (
    <Sheet title={clientName(clients, trade.clientId)} subtitle={`${trade.date} · ${statusLabel(trade.status)}`} onClose={ui.closeOverlay}>
      <div className="steps">{flow.map((step, stepIndex) => <i key={step} className={index >= stepIndex ? 'on' : ''} />)}</div>
      <div className="dhero"><div className="eb">Diferencia a cobrar</div><div className="big">{formatMoney(trade.differencePaid)}</div></div>
      <div className="kv"><span>Recibido</span><b>{trade.deviceReceived}</b></div>
      <div className="kv"><span>IMEI</span><b>{trade.deviceReceivedImei}</b></div>
      <div className="kv"><span>Valor tomado</span><b>{formatMoney(trade.takeValue)}</b></div>
      <div className="kv"><span>Entrega</span><b>{trade.deviceGiven}</b></div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {action}
    </Sheet>
  );
}

function TradeForm({ id }: { id?: string }) {
  const { tradeIns, clients, inventory, addTradeIn, updateTradeIn, addClient } = useAppContext();
  const ui = useMobileUi();
  const existing = tradeIns.find((item) => item.id === id);
  const available = inventory.filter((item) => item.status === 'DISPONIBLE');
  const [clientId, setClientId] = useState(existing?.clientId || clients[0]?.id || '');
  const [received, setReceived] = useState(existing?.deviceReceived ?? '');
  const [imei, setImei] = useState(existing?.deviceReceivedImei ?? '');
  const [given, setGiven] = useState(existing?.deviceGiven || (available[0] ? productLabel(available[0]) : ''));
  const [take, setTake] = useState(moneyField(existing?.takeValue ?? 0));
  const [diff, setDiff] = useState(moneyField(existing?.differencePaid ?? 0));
  const [status, setStatus] = useState(existing?.status || 'PENDIENTE');
  const [newName, setNewName] = useState('');
  const [newDni, setNewDni] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!received.trim() || !imei.trim() || !given.trim()) {
      setError('Completá el equipo recibido, su IMEI y el equipo que entregás.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let nextClient = clientId;
      if (!nextClient) {
        if (!newName.trim() || !newDni.trim()) {
          setError('Elegí un cliente o cargá nombre y DNI.');
          setBusy(false);
          return;
        }
        const created = await addClient({
          name: newName.trim(), dni: newDni.trim(), email: '', phone: '', lastPurchaseDate: 'N/A', totalSpent: 0, pendingBalance: 0,
        });
        nextClient = created.id;
      }
      const payload = {
        date: existing?.date || todayLabel(),
        clientId: nextClient,
        deviceReceived: received.trim(),
        deviceReceivedImei: imei.trim(),
        takeValue: parseMoneyInput(take),
        deviceGiven: given.trim(),
        differencePaid: parseMoneyInput(diff),
        status,
        batteryHealth: existing?.batteryHealth || '100',
        grade: existing?.grade || 'A',
        categoryId: existing?.categoryId ?? null,
        customFields: existing?.customFields,
      };
      if (existing) await updateTradeIn({ ...existing, ...payload });
      else await addTradeIn(payload);
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(existing ? 'Canje actualizado' : 'Canje creado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el canje'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={existing ? 'Editar canje' : 'Nuevo canje'} subtitle="El cliente entrega su equipo y se lleva uno del stock." onClose={ui.closeOverlay}>
      {clients.length ? (
        <SelectField label="Cliente" value={clientId} onChange={setClientId} options={clients.map((client) => ({ value: client.id, label: client.name }))} />
      ) : (
        <div className="frow">
          <Field label="Nombre" value={newName} onChange={setNewName} />
          <Field label="DNI" value={newDni} onChange={setNewDni} />
        </div>
      )}
      <Field label="Equipo que recibís" value={received} onChange={setReceived} placeholder="Ej. iPhone 11 64GB" />
      <Field label="IMEI recibido" value={imei} onChange={setImei} placeholder="Obligatorio" />
      <SelectField
        label="Equipo que entregás"
        value={given}
        onChange={setGiven}
        options={[
          ...available.map((item) => ({ value: productLabel(item), label: productLabel(item) })),
          ...(given && !available.some((item) => productLabel(item) === given) ? [{ value: given, label: given }] : []),
        ]}
      />
      <div className="frow">
        <Field label="Valor tomado" value={take} onChange={setTake} inputMode="numeric" />
        <Field label="Diferencia" value={diff} onChange={setDiff} inputMode="numeric" />
      </div>
      <Segments label="Estado" value={statusLabel(status)} options={TRADE_STATUSES.map(statusLabel)} onChange={(label) => {
        const match = TRADE_STATUSES.find((item) => statusLabel(item) === label);
        if (match) setStatus(match);
      }} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel={existing ? 'Guardar cambios' : 'Crear canje'} busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
    </Sheet>
  );
}

function ClientDetail({ id }: { id: string }) {
  const { clients } = useAppContext();
  const ui = useMobileUi();
  const client = clients.find((item) => item.id === id);
  if (!client) return null;
  return (
    <Sheet title={client.name} subtitle={client.lastPurchaseDate && client.lastPurchaseDate !== 'N/A' ? `Última compra ${client.lastPurchaseDate} · DNI ${client.dni}` : `DNI ${client.dni}`} onClose={ui.closeOverlay}>
      <div className="dhero"><div className="eb">Saldo pendiente</div><div className="big">{formatMoney(client.pendingBalance)}</div></div>
      <div className="kv"><span>Teléfono</span><b>{client.phone || '—'}</b></div>
      <div className="kv"><span>Email</span><b>{client.email || '—'}</b></div>
      <div className="kv"><span>Gastó</span><b>{formatMoney(client.totalSpent)}</b></div>
      <div className="sacts">
        <button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button>
        <button type="button" className="btn2 p" onClick={() => ui.openOverlay({ type: 'sale-new', clientId: client.id })}>Nueva venta</button>
      </div>
    </Sheet>
  );
}

function ClientForm({ id }: { id?: string }) {
  const { clients, addClient, updateClient } = useAppContext();
  const ui = useMobileUi();
  const existing = clients.find((item) => item.id === id);
  const [name, setName] = useState(existing?.name ?? '');
  const [dni, setDni] = useState(existing?.dni ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [balance, setBalance] = useState(moneyField(existing?.pendingBalance ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !dni.trim()) {
      setError('Completá nombre y DNI.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (existing) {
        await updateClient({
          ...existing,
          name: name.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
          email: email.trim(),
          pendingBalance: parseMoneyInput(balance),
        });
      } else {
        await addClient({
          name: name.trim(),
          dni: dni.trim(),
          phone: phone.trim(),
          email: email.trim(),
          lastPurchaseDate: 'N/A',
          totalSpent: 0,
          pendingBalance: parseMoneyInput(balance),
        });
      }
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(existing ? 'Cliente actualizado' : 'Cliente guardado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el cliente'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={existing ? 'Editar cliente' : 'Nuevo cliente'} onClose={ui.closeOverlay}>
      <Field label="Nombre y apellido" value={name} onChange={setName} />
      <div className="frow">
        <Field label="DNI" value={dni} onChange={setDni} />
        <Field label="Teléfono" value={phone} onChange={setPhone} type="tel" />
      </div>
      <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="opcional" />
      <Field label="Saldo pendiente" value={balance} onChange={setBalance} inputMode="numeric" />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel="Guardar cambios" busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
    </Sheet>
  );
}

const IMPORTS: Record<ImportEntity, { title: string; noun: string; fields: ImportField[]; hints: Record<string, string> }> = {
  inv: {
    title: 'Importar equipos',
    noun: 'equipos',
    fields: [
      { key: 'model', label: 'Modelo', required: true },
      { key: 'imei', label: 'IMEI', required: true },
      { key: 'price', label: 'Precio' },
      { key: 'capacity', label: 'Capacidad' },
      { key: 'color', label: 'Color' },
      { key: 'condition', label: 'Condición' },
      { key: 'grade', label: 'Grado' },
      { key: 'batteryHealth', label: 'Batería' },
      { key: 'cost', label: 'Costo' },
      { key: 'status', label: 'Estado' },
    ],
    hints: { modelo: 'model', equipo: 'model', imei: 'imei', serial: 'imei', precio: 'price', capacidad: 'capacity', color: 'color', condicion: 'condition', grado: 'grade', bateria: 'batteryHealth', costo: 'cost', estado: 'status' },
  },
  ven: {
    title: 'Importar ventas',
    noun: 'ventas',
    fields: [
      { key: 'clientName', label: 'Cliente', required: true },
      { key: 'productImei', label: 'IMEI', required: true },
      { key: 'amount', label: 'Monto' },
      { key: 'date', label: 'Fecha' },
      { key: 'paymentMethod', label: 'Pago' },
      { key: 'status', label: 'Estado' },
    ],
    hints: { cliente: 'clientName', nombre: 'clientName', imei: 'productImei', monto: 'amount', total: 'amount', fecha: 'date', pago: 'paymentMethod', estado: 'status' },
  },
  cl: {
    title: 'Importar clientes',
    noun: 'clientes',
    fields: [
      { key: 'name', label: 'Nombre', required: true },
      { key: 'dni', label: 'DNI' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Teléfono' },
    ],
    hints: { nombre: 'name', cliente: 'name', documento: 'dni', dni: 'dni', correo: 'email', mail: 'email', telefono: 'phone', celular: 'phone' },
  },
  cj: {
    title: 'Importar canjes',
    noun: 'canjes',
    fields: [
      { key: 'clientName', label: 'Cliente', required: true },
      { key: 'deviceReceived', label: 'Equipo recibido', required: true },
      { key: 'deviceReceivedImei', label: 'IMEI', required: true },
      { key: 'takeValue', label: 'Valor toma', required: true },
      { key: 'deviceGiven', label: 'Equipo entregado', required: true },
      { key: 'differencePaid', label: 'Diferencia', required: true },
      { key: 'date', label: 'Fecha' },
      { key: 'status', label: 'Estado' },
    ],
    hints: { cliente: 'clientName', equipo: 'deviceReceived', imei: 'deviceReceivedImei', tomado: 'takeValue', entrega: 'deviceGiven', diferencia: 'differencePaid', fecha: 'date', estado: 'status' },
  },
};

function ImportSheet({ entity }: { entity: ImportEntity }) {
  const { user } = useAppContext();
  const ui = useMobileUi();
  const spec = IMPORTS[entity];
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const book = await parseWorkbook(file);
      const raw = book.getSheet(book.sheetNames[0] ?? '');
      const mapped = mapImportRows(raw, spec.fields, spec.hints);
      if (mapped.missingRequired.length) {
        setError(`Faltan columnas: ${mapped.missingRequired.join(', ')}`);
        setRows(null);
        return;
      }
      if (!mapped.rows.length) {
        setError('El archivo no tiene filas para importar.');
        return;
      }
      setRows(mapped.rows);
      setPreview(mapped.preview);
      setFileName(file.name);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo leer el archivo'));
    }
  };

  const run = async () => {
    if (!user || !rows) return;
    setBusy(true);
    setError(null);
    try {
      let imported = 0;
      if (entity === 'inv') {
        const result = await importBackendInventoryItems(user, rows.map((row) => ({
          imei: row.imei ?? '',
          model: row.model ?? '',
          price: parseMoneyInput(row.price ?? ''),
          capacity: row.capacity || undefined,
          color: row.color || undefined,
          condition: row.condition || undefined,
          grade: row.grade || undefined,
          batteryHealth: row.batteryHealth || undefined,
          cost: row.cost ? parseMoneyInput(row.cost) : undefined,
          status: row.status || undefined,
        })));
        imported = result.imported;
      } else if (entity === 'ven') {
        imported = (await importBackendSales(user, rows)).imported;
      } else if (entity === 'cl') {
        imported = (await importBackendClients(user, rows)).imported;
      } else {
        imported = (await importBackendTradeIns(user, rows)).imported;
      }
      await ui.refresh();
      ui.closeOverlay();
      ui.toast(`${imported} ${spec.noun} importados`);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo importar'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={spec.title} subtitle={`Subí un Excel o CSV con una fila por ${spec.noun.slice(0, -1)}.`} onClose={ui.closeOverlay}>
      {rows ? (
        <>
          <div className="drop ok"><b>{fileName}</b><small>{rows.length} {spec.noun} detectados · listo para importar</small></div>
          {preview.map((line) => <div key={line} className="kv"><span>{line}</span></div>)}
        </>
      ) : (
        <label className="drop">
          <b>Elegir archivo</b>
          <small>Columnas: {spec.fields.map((field) => field.label.toLowerCase()).join(', ')}</small>
          <input type="file" accept=".csv,.xlsx" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }} />
        </label>
      )}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {rows ? (
        <SheetActions confirmLabel={`Importar ${rows.length} ${spec.noun}`} busy={busy} cancelLabel="Otro archivo" onCancel={() => { setRows(null); setPreview([]); }} onConfirm={() => { void run(); }} />
      ) : (
        <div className="sacts one"><button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cancelar</button></div>
      )}
    </Sheet>
  );
}

function InviteSheet() {
  const { user } = useAppContext();
  const ui = useMobileUi();
  const [role, setRole] = useState<'Agente' | 'Socio'>('Agente');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const invitation = await createInvitation(user, undefined, role === 'Socio' ? 'MANAGER' : 'STAFF');
      await ui.refresh();
      ui.openOverlay({ type: 'invite-link', invitation });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo generar el link'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Invitar al equipo" subtitle="Generá un link de un solo uso. No hace falta email." onClose={ui.closeOverlay}>
      <Segments label="Rol" value={role} options={['Agente', 'Socio']} onChange={(value) => setRole(value === 'Socio' ? 'Socio' : 'Agente')} />
      <div className="sheet-note">El Agente carga equipos y ventas. El Socio además ve reportes y el equipo.</div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel="Generar link" busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void create(); }} />
    </Sheet>
  );
}

function InviteLinkSheet({ invitation }: { invitation: { inviteUrl: string; role: 'MANAGER' | 'STAFF'; expiresAt: string } }) {
  const ui = useMobileUi();
  const copy = async (share: boolean) => {
    try {
      if (share && navigator.share) {
        await navigator.share({ title: 'Sumate al equipo', url: invitation.inviteUrl });
        return;
      }
      await navigator.clipboard.writeText(invitation.inviteUrl);
      ui.toast('Link copiado');
    } catch {
      ui.toast('No se pudo copiar el link');
    }
  };
  const expires = new Date(invitation.expiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return (
    <Sheet title="Link listo" subtitle={`Sirve para una sola persona como ${ROLE_LABEL[invitation.role]} y vence el ${expires}.`} onClose={ui.closeOverlay}>
      <div className="linkrow"><span>{invitation.inviteUrl}</span><button type="button" onClick={() => { void copy(false); }}>Copiar</button></div>
      <div className="sheet-note">Cuando alguien entra con el link, deja de funcionar. Lo podés cancelar desde Configuración.</div>
      <div className="sacts">
        <button type="button" className="btn2 s" onClick={ui.closeOverlay}>Listo</button>
        <button type="button" className="btn2 p" onClick={() => { void copy(true); }}>Compartir link</button>
      </div>
    </Sheet>
  );
}

function InvitesSheet() {
  const { user, appSession } = useAppContext();
  const canRevoke = appSession?.membership?.role === 'OWNER';
  const ui = useMobileUi();
  const [items, setItems] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setItems(await listInvitations(user));
  };

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se pudieron cargar'));
  }, [user, ui.revision]);

  const cancel = async (id: string) => {
    if (!user) return;
    try {
      await revokeInvitation(user, id);
      await load();
      await ui.refresh();
      ui.toast('Invitación cancelada');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo cancelar'));
    }
  };

  return (
    <Sheet title="Links de invitación" subtitle="Cada link sirve una sola vez y vence solo." onClose={ui.closeOverlay}>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {items.length ? items.map((invite) => (
        <div key={invite.id} className="kv">
          <span>{ROLE_LABEL[invite.role]} · vence {new Date(invite.expiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
          {canRevoke ? <button type="button" className="mbtn" onClick={() => { void cancel(invite.id); }}>Cancelar</button> : null}
        </div>
      )) : <div className="wempty">No quedan invitaciones.</div>}
      <div className="sacts one"><button type="button" className="btn2 s" onClick={ui.closeOverlay}>Listo</button></div>
    </Sheet>
  );
}

function StoreSheet() {
  const { appSession, updateStore } = useAppContext();
  const ui = useMobileUi();
  const store = appSession?.store;
  const [name, setName] = useState(store?.name ?? '');
  const [taxId, setTaxId] = useState(store?.taxId ?? '');
  const [address, setAddress] = useState(store?.address ?? '');
  const [currency, setCurrency] = useState(store?.currency || 'ARS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('La tienda necesita un nombre.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateStore({ name: name.trim(), taxId: taxId.trim() || null, address: address.trim() || null, currency });
      await ui.refresh();
      ui.closeOverlay();
      ui.toast('Tienda actualizada');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar la tienda'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Datos de la tienda" onClose={ui.closeOverlay}>
      <Field label="Nombre" value={name} onChange={setName} />
      <Field label="CUIT" value={taxId} onChange={setTaxId} />
      <Field label="Dirección" value={address} onChange={setAddress} />
      <Segments label="Moneda" value={currency} options={['ARS', 'USD']} onChange={setCurrency} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel="Guardar" busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
    </Sheet>
  );
}

function ProfileSheet() {
  const { appSession, user, updateUserProfile } = useAppContext();
  const ui = useMobileUi();
  const [name, setName] = useState(appSession?.user.displayName || user?.displayName || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('El nombre no puede quedar vacío.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateUserProfile({ displayName: name.trim() });
      await ui.refresh();
      ui.closeOverlay();
      ui.toast('Perfil actualizado');
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar el perfil'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Perfil" onClose={ui.closeOverlay}>
      <Field label="Nombre" value={name} onChange={setName} />
      <label className="fl"><span>Email</span><input value={user?.email ?? ''} readOnly /></label>
      <p className="disabled-note">El email lo administra el inicio de sesión y no se cambia desde acá.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <SheetActions confirmLabel="Guardar" busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
    </Sheet>
  );
}

function PasswordSheet() {
  const { user } = useAppContext();
  const ui = useMobileUi();
  const emailUser = user?.providerData?.some((provider) => provider.providerId === 'password') ?? false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!user?.email || !('reload' in user)) return;
    if (next.length < 8) {
      setError('Usá al menos 8 caracteres.');
      return;
    }
    if (next !== repeat) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const firebaseUser = user as FirebaseUser;
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(firebaseUser.email!, current));
      await updatePassword(firebaseUser, next);
      ui.closeOverlay();
      ui.toast('Contraseña actualizada');
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === 'auth/wrong-password' || code === 'auth/invalid-credential'
        ? 'La contraseña actual es incorrecta.'
        : getFriendlyErrorMessage(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Cambiar contraseña" subtitle="Usá al menos 8 caracteres." onClose={ui.closeOverlay}>
      {emailUser ? (
        <>
          <Field label="Contraseña actual" value={current} onChange={setCurrent} type="password" />
          <Field label="Nueva contraseña" value={next} onChange={setNext} type="password" />
          <Field label="Repetir nueva" value={repeat} onChange={setRepeat} type="password" />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <SheetActions confirmLabel="Actualizar" busy={busy} onCancel={ui.closeOverlay} onConfirm={() => { void save(); }} />
        </>
      ) : (
        <>
          <p className="disabled-note">Tu cuenta usa inicio de sesión con Google. La contraseña se cambia desde Google, no desde iManager.</p>
          <div className="sacts one"><button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button></div>
        </>
      )}
    </Sheet>
  );
}

function BillingSheet() {
  const ui = useMobileUi();
  return (
    <Sheet title="Facturación" subtitle="Usuario Beta" onClose={ui.closeOverlay}>
      <div className="dhero"><div className="eb">Plan</div><div className="big">Acceso anticipado</div></div>
      <p className="disabled-note">Sos parte del programa beta de iManager. Esta pantalla no cobra ni guarda un medio de pago: igual que en el escritorio, la facturación todavía no persiste.</p>
      <div className="sacts one"><button type="button" className="btn2 s" onClick={ui.closeOverlay}>Cerrar</button></div>
    </Sheet>
  );
}

function LogoutDialog() {
  const { logout } = useAppContext();
  const ui = useMobileUi();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      title="¿Cerrar sesión?"
      body="Vas a tener que volver a entrar para ver la tienda."
      confirmLabel={busy ? 'Saliendo…' : 'Cerrar sesión'}
      busy={busy}
      onCancel={ui.closeOverlay}
      onConfirm={() => {
        setBusy(true);
        void logout().finally(() => setBusy(false));
      }}
    />
  );
}
