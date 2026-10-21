import { formatShortDate } from '../format';
import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { INPUT_LIMITS } from '../../lib/input-limits';
import { parseDeviceCode } from '../../lib/device-scan';
import { IMEI_FORMAT_MESSAGE, IMEI_LUHN_MESSAGE, IMEI_OPTIONAL_LABEL, imeiFormatError, imeiPassesLuhn } from '../../lib/imei';
import { createWedgeBuffer, focusNextControl } from '../../lib/keyboard-wedge';
import { frequentModels } from '../../lib/scan-batch';
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
import { confirmScan } from '../scan/beep';
import { CameraScanner } from '../scan/CameraScanner';
import { draftFromCode, type ScanDraft } from '../scan/draft';
import { ScanCameraButton, ScanReady } from '../scan/ImeiScanField';
import { Actions, Field, Segs, Sheet, signalDesk, useDesk } from '../ui';
import { ScanReviewSheet, scanProduct } from './scan-review';
import { clearBad, BASE_CAPS, BASE_CONDITIONS, MODELS, EQ_STATUS, stampedCurrency, AuditLine, type FormProps } from './shared';
import { archivedProduct } from '../archive-cache';
import { RecordHistory } from '../screens/HistoryScreen';
import { restoreBackendInventoryItem } from '../../services/inventory-api';
import { deviceCoverageLines } from '../../lib/warranty';
import { CoverageBlock } from '../warranty';

function batteryText(value: string) {
  if (!value.trim()) return '-';
  if (/\d+\s*-\s*\d+/.test(value)) return value.includes('%') ? value : `${value}%`;
  return `${batteryPercent(value)}%`;
}

export function EquipmentDetail({ id }: { id: string }) {
  const { inventory, updateProduct, sales = [], repairOrders = [], user, reloadInventory } = useAppContext();
  const money = useMoney();
  const { close, open, toast } = useDesk();
  const catalogs = useCatalogs();
  const item = inventory.find((row) => row.id === id) ?? archivedProduct(id);
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
      {item.archivedAt ? <div className="pending-sale" data-testid="archived-banner"><div><b>Archivado</b><small>{item.archivedBy ? `por ${item.archivedBy}` : 'Este equipo está archivado'}{item.archiveReason ? ` · ${item.archiveReason}` : ''}</small></div><button type="button" disabled={busy} onClick={async () => { if (!user) return; setBusy(true); try { await restoreBackendInventoryItem(user, item.id); await reloadInventory(); toast('Equipo restaurado'); close(); } catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo restaurar.')); } finally { setBusy(false); } }}>Restaurar</button></div> : null}
      <RecordHistory entityType="inventory" entityId={item.id} />
      <div className="dhero"><div className="eb">Precio de venta</div><div className="big">{item.price > 0 ? money.show(item.price, item.currency) : 'Sin precio'}</div></div>
      {typeof item.customFields?.onboardingReview === 'string' && item.customFields.onboardingReview && <div className="pending-sale"><div><b>Para revisar</b><small>{item.customFields.onboardingReview}</small></div><button type="button" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { await updateProduct({ ...item, customFields: { ...item.customFields, onboardingReview: null } }); toast('Equipo revisado'); }
        catch (cause) { setError(getFriendlyErrorMessage(cause, 'No se pudo guardar la revisión.')); }
        finally { setBusy(false); }
      }}>Marcar revisado</button></div>}
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
      <div className="kv" data-testid="equipment-supplier"><span>Proveedor</span><b>{item.supplierName || 'Sin proveedor cargado.'}</b></div>
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

export function EquipmentForm({ id, run, busy, error, supplierId }: FormProps & { id?: string; supplierId?: string }) {
  const { inventory, addProduct, updateProduct, appSession, suppliers, reloadLedger } = useAppContext();
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
  const [cost, setCost] = useState(current && seeCosts ? money.inputValue(current.cost, current.currency) : '');
  const [status, setStatus] = useState(current?.status || 'DISPONIBLE');
  const [supplier, setSupplier] = useState(current?.supplierId ?? supplierId ?? '');
  const [bad, setBad] = useState<Record<string, string>>({});
  const [review, setReview] = useState<ScanDraft | null>(null);
  const [camera, setCamera] = useState(false);
  const phone = usePhoneLayout();
  const imeiRef = useRef<HTMLInputElement>(null);
  const wedge = useRef(createWedgeBuffer());
  let createdProductId = '';
  useEffect(() => {
    if (!current && !phone) imeiRef.current?.focus();
  }, [current, phone]);

  const openReview = (parsed: ReturnType<typeof parseDeviceCode>) => {
    setCamera(false);
    setReview(draftFromCode(parsed, { battery, condition, price }));
  };

  if (review && !current) {
    return (
      <>
        <ScanReviewSheet
          initial={review}
          frequent={frequentModels(inventory, models, 4)}
          seeCosts={seeCosts}
          busy={busy}
          error={error}
          onClose={() => setReview(null)}
          onRescan={() => { setReview(null); setCamera(true); }}
          onSave={(draft) => {
            const payload = scanProduct(draft, money.active === 'USD' ? 'USD' : 'ARS', seeCosts);
            void run(async () => {
              await addProduct(payload, { restockRetired: true });
              signalDesk('desk-eq-saved');
              signalDesk('desk-check', 'inv');
            }, 'Equipo cargado');
          }}
        />
        {camera ? <CameraScanner allowCameraSwitch={false} onClose={() => setCamera(false)} onManual={() => setCamera(false)} onUse={openReview} /> : null}
      </>
    );
  }

  return (
    <>
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
      <div className="scan-block">
        <div className="scan-imei">
          <Field label={IMEI_OPTIONAL_LABEL} error={bad.imei}>
            <input ref={imeiRef} value={imei} inputMode="numeric" maxLength={15} autoComplete="off" onChange={(event) => { setImei(event.target.value.replace(/\D/g, '').slice(0, 15)); clearBad(setBad, 'imei'); }} placeholder="15 dígitos" onKeyDown={(event) => {
              const pushed = wedge.current.push(event.key);
              if (current) return;
              if (pushed.type === 'enter') {
                const digits = event.currentTarget.value.replace(/\D/g, '');
                if (digits.length === 15 && !imeiPassesLuhn(digits)) {
                  event.preventDefault();
                  setImei('');
                  setBad((prev) => ({ ...prev, imei: IMEI_LUHN_MESSAGE }));
                }
                return;
              }
              if (pushed.type !== 'scan') return;
              event.preventDefault();
              const parsed = parseDeviceCode(pushed.value);
              confirmScan();
              if (parsed.rich) openReview(parsed);
              else if (parsed.imei) {
                setImei(parsed.imei);
                focusNextControl(event.currentTarget);
              }
            }} />
          </Field>
          {current ? null : <ScanCameraButton onClick={() => setCamera(true)} />}
        </div>
        {current ? null : <ScanReady />}
      </div>
      <Field label="Proveedor">
        {suppliers === null ? <input disabled value="Cargando proveedores…" /> : (
          <select aria-label="Proveedor" value={supplier} onChange={(event) => setSupplier(event.target.value)}>
            <option value="">Sin proveedor</option>
            {(suppliers ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        )}
      </Field>
      <Field label="Condición"><span /></Field>
      <Segs options={catalogChoices(catalogs?.options ?? [], 'INVENTORY_CONDITION', conditions)} value={condition} onChange={(next) => { setCondition(next); if (!isUsedCondition(next)) setGrade(''); }} allowClear onEdit={catalogs?.canEdit ? () => setEditor('INVENTORY_CONDITION') : undefined} />
      {isUsedCondition(condition) ? <QualityField value={grade} onChange={setGrade} /> : null}
      {seeCosts ? <Field label="Costo" mark={money.active} error={bad.cost}><input aria-label="Costo" value={cost} inputMode="decimal" onChange={(event) => {
        const raw = event.target.value;
        if (raw.includes('-')) { setCost(raw); return; }
        setCost(formatInputMoney(parseMoney(raw)));
        clearBad(setBad, 'cost');
      }} placeholder="Opcional" /></Field> : null}
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
        if (seeCosts && cost.includes('-')) next.cost = 'El costo no puede ser negativo';
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
          cost: seeCosts ? parseMoney(cost) : (current?.cost ?? 0),
          price: priced.amounts[0]?.amount ?? parseMoney(price),
          currency: stampedCurrency(priced.amounts[0]?.currency) ?? (current ? undefined : money.active),
          status,
          categoryId: current?.categoryId,
          customFields: current?.customFields,
          ...(suppliers === null ? {} : supplier ? { supplierId: supplier } : current ? { supplierId: null } : {}),
        };
        if (current) {
          const next = { ...current, ...payload };
          if (!seeCosts) delete next.cost;
          await updateProduct(next);
        }
        else {
          const created = await addProduct(payload);
          createdProductId = created.id;
          if (supplier) await reloadLedger();
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
    {camera && !current ? <CameraScanner allowCameraSwitch={false} onClose={() => setCamera(false)} onManual={() => { setCamera(false); imeiRef.current?.focus(); }} onUse={openReview} /> : null}
    </>
  );
}
