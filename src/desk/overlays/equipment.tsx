import { formatShortDate } from '../format';
import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { IMEI_FORMAT_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError } from '../../lib/imei';
import { getFriendlyErrorMessage } from '../../lib/utils';
import type { Product } from '../../types';
import { batteryPercent, conditionLabel, equipmentTitle, isInStock, formatImei, formatInputMoney, parseMoney } from '../format';
import { useMoney } from '../exchange';
import { FX_WARNING } from '../money';
import { CatalogEditor, catalogChoices, useCatalogs } from '../catalog';
import { canSeeFinancials } from '../sections';
import type { CatalogKind } from '../../services/catalogs-api';
import { ImanagerIcon } from '../icons';
import { usePhoneLayout } from '../section-notices';
import { QualityField } from '../QualityField';
import { displayQuality, isUsedCondition, qualityDetail } from '../quality';
import { Actions, Field, Segs, Sheet, signalDesk, useDesk } from '../ui';
import { clearBad, BASE_CAPS, BASE_CONDITIONS, MODELS, EQ_STATUS, stampedCurrency, AuditLine, type FormProps } from './shared';
import { deviceCoverageLines } from '../../lib/warranty';
import { CoverageBlock } from '../warranty';

function batteryText(value: string) {
  if (!value.trim()) return '-';
  if (/\d+\s*-\s*\d+/.test(value)) return value.includes('%') ? value : `${value}%`;
  return `${batteryPercent(value)}%`;
}

export function EquipmentDetail({ id }: { id: string }) {
  const { inventory, updateProduct, sales = [], repairOrders = [] } = useAppContext();
  const money = useMoney();
  const { close, open, toast } = useDesk();
  const catalogs = useCatalogs();
  const item = inventory.find((row) => row.id === id);
  const [status, setStatus] = useState(item?.status || 'DISPONIBLE');
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = usePhoneLayout();
  const statuses = catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', EQ_STATUS);
  if (!item) return null;
  const saveStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      if (status !== item.status) await updateProduct({ ...item, status });
      if (status === 'VENDIDO' && item.status !== 'VENDIDO') {
        open({ type: 'new-sale', productId: item.id, source: 'inventory' });
      } else {
        toast('Estado actualizado');
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={equipmentTitle(item.model, item.capacity)} subtitle={item.color || undefined} onClose={close} className="eq-sheet">
      {error && <div className="ferr">{error}</div>}
      <div className="dhero"><div className="eb">Precio de venta</div><div className="big">{item.price > 0 ? money.show(item.price, item.currency) : 'Sin precio'}</div></div>
      {item.needsCompletion ? <p className="needs-completion-label" data-testid="needs-completion">Para completar</p> : null}
      <AuditLine action="Precio cambiado" by={item.priceChangedBy} at={item.priceChangedAt} />
      <AuditLine action="Costo cambiado" by={item.costChangedBy} at={item.costChangedAt} />
      {item.status === 'VENDIDO' && item.pendingSaleRegistration ? (
        <div className="pending-sale"><div><b className="pending-sale-label"><ImanagerIcon name="venta-por-registrar" size={16} />Venta por registrar</b><small>El equipo sigue vendido hasta completar el registro.</small></div><button type="button" onClick={() => open({ type: 'new-sale', productId: item.id, source: 'inventory' })}>Retomar</button></div>
      ) : null}
      {phone ? <div className="kv"><span>IMEI</span><b>{item.imei ? formatImei(item.imei) : '—'}</b></div> : null}
      <div className="kv"><span>Color</span><b>{item.color}</b></div>
      <div className="kv"><span>Condición</span><b>{conditionLabel(item.condition)}</b></div>
      <div className="kv"><span>Calidad</span><b title={qualityDetail(displayQuality(item.condition, item.grade)) || undefined}>{displayQuality(item.condition, item.grade) || '—'}</b></div>
      <div className="kv"><span>Batería</span><b>{batteryText(item.batteryHealth)}</b></div>
      <CoverageBlock testId="device-warranties" lines={deviceCoverageLines(item, sales, repairOrders)} />
      {item.reservedDepositId ? <div className="deposit-card"><b>Reservado para {item.reservedClientName}</b><p className="eqs-note">Desde {formatShortDate(item.reservedAt)}. Para liberar el equipo, cancelá la seña desde la ficha del cliente.</p><button className="btn2 s" type="button" onClick={() => open({ type: 'cl', id: item.reservedClientId! })}>Ver cliente</button></div> : null}
      <Field label="Estado"><span /></Field>
      <Segs options={statuses} value={status} onChange={setStatus} onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <div className="sacts">
        {isInStock(item.status)
          ? <button className="btn2 s" type="button" onClick={() => open({ type: 'new-sale', productId: item.id, source: 'inventory' })}>Vender</button>
          : <button className="btn2 s" type="button" onClick={close}>Cerrar</button>}
        <button className="btn2 p" type="button" disabled={busy || Boolean(item.reservedDepositId)} onClick={() => { void saveStatus(); }}>{busy ? 'Guardando…' : 'Guardar estado'}</button>
      </div>
    </Sheet>
  );
}

export function EquipmentForm({ id, run, busy, error }: FormProps & { id?: string }) {
  const { inventory, addProduct, updateProduct, appSession } = useAppContext();
  const money = useMoney();
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const { close, open, canManageSensitive = true } = useDesk();
  const catalogs = useCatalogs();
  const [editor, setEditor] = useState<CatalogKind | null>(null);
  const current = inventory.find((item) => item.id === id);
  const lockPrice = Boolean(current) && !canManageSensitive;
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
  const [grade, setGrade] = useState<string>(displayQuality(current?.condition, current?.grade));
  const [price, setPrice] = useState(current ? money.inputValue(current.price, current.currency) : '');
  const [status, setStatus] = useState(current?.status ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  let createdProductId = '';

  return (
    <Sheet title={current ? 'Editar equipo' : 'Registrar equipo'} subtitle={current ? equipmentTitle(current.model, current.capacity) : 'Solo el modelo y el precio son obligatorios.'} onClose={close} className="eq-sheet">
      {error && <div className="ferr">{error}</div>}
      <Field label="Modelo" error={bad.model}><input list="eq-models" value={model} onChange={(event) => { setModel(event.target.value); clearBad(setBad, 'model'); }} placeholder="Ej. iPhone 13" /></Field>
      <datalist id="eq-models">{models.map((item) => <option key={item} value={item} />)}</datalist>
      <Field label="Capacidad"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_CAPACITY', caps.map((item) => ({ id: item, label: item })))} value={capacity} onChange={setCapacity} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_CAPACITY') : undefined} />
      <div className="frow">
        <Field label="Color" error={bad.color}><input value={color} onChange={(event) => { setColor(event.target.value); clearBad(setBad, 'color'); }} placeholder="Ej. Azul" /></Field>
        <Field label="Batería %"><input value={battery} inputMode="numeric" placeholder="Ej. 87" onChange={(event) => setBattery(event.target.value.replace(/\D/g, '').slice(0, 3))} /></Field>
      </div>
      <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}><input value={imei} inputMode="numeric" maxLength={15} onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" /></Field>
      <Field label="Condición"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_CONDITION', conditions)} value={condition} onChange={(next) => { setCondition(next); if (!isUsedCondition(next)) setGrade(''); }} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_CONDITION') : undefined} />
      {isUsedCondition(condition) ? <QualityField value={grade} onChange={setGrade} /> : null}
      <Field label="Precio de venta" mark={money.active} error={bad.price}><input value={price} inputMode="decimal" disabled={lockPrice} onChange={(event) => {
        const raw = event.target.value;
        if (raw.includes('-')) { setPrice(raw); return; }
        setPrice(formatInputMoney(parseMoney(raw)));
        clearBad(setBad, 'price');
      }} placeholder="$ 0" /></Field>
      <Field label="Estado"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_STATUS', EQ_STATUS)} value={status} onChange={setStatus} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_STATUS') : undefined} />
      {editor ? <CatalogEditor kind={editor} onClose={() => setEditor(null)} /> : null}
      <Actions busy={busy} primary={current ? 'Guardar cambios' : 'Guardar equipo'} onSecondary={close} onPrimary={() => {
        const next: Record<string, string> = {};
        if (!model.trim()) next.model = 'Completá este dato';
        else if (model.trim().length > INPUT_LIMITS.model) next.model = `El modelo puede tener hasta ${INPUT_LIMITS.model} caracteres`;
        if (color.trim().length > INPUT_LIMITS.color) next.color = `El color puede tener hasta ${INPUT_LIMITS.color} caracteres`;
        if (imeiFormatError(imei)) next.imei = IMEI_FORMAT_MESSAGE;
        if (!lockPrice && price.includes('-')) next.price = 'El precio no puede ser negativo';
        else if (!lockPrice && !parseMoney(price)) next.price = 'Completá este dato';
        setBad(next);
        if (Object.keys(next).length) return;
        const priced = current
          ? money.commitGroup([{ typed: lockPrice ? current.price : parseMoney(price), original: current.price, currency: current.currency }])
          : { blocked: false, amounts: [{ amount: parseMoney(price), currency: money.active }] };
        if (priced.blocked) {
          setBad({ price: FX_WARNING });
          return;
        }
        void run(async () => {
        const payload: Omit<Product, 'id'> = {
          imei: imei.trim(),
          model: model.trim(),
          capacity,
          color: color.trim(),
          condition,
          grade: isUsedCondition(condition) ? grade : '',
          batteryHealth: battery ? `${battery}%` : '',
          cost: seeCosts ? (current?.cost ?? 0) : 0,
          price: priced.amounts[0]?.amount ?? parseMoney(price),
          currency: stampedCurrency(priced.amounts[0]?.currency) ?? (current ? undefined : money.active),
          status,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
        };
        if (current) {
          const next = { ...current, ...payload };
          if (!seeCosts) delete next.cost;
          await updateProduct(next);
        }
        else {
          const created = await addProduct(payload);
          createdProductId = created.id;
          signalDesk('desk-eq-saved');
        }
        signalDesk('desk-check', 'inv');
      }, current ? 'Equipo actualizado' : 'Equipo cargado', {
        afterSuccess: status === 'VENDIDO' && current?.status !== 'VENDIDO'
          ? () => open({ type: 'new-sale', productId: current?.id ?? createdProductId, source: 'inventory' })
          : undefined,
      });
      }} />
    </Sheet>
  );
}
