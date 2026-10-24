import { autofillImeiSpecs } from '../../lib/report-unknown-tac';
import { toActionMessage } from '../../lib/user-message';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { extractImeiLoose, parseDeviceCode, type ParsedDeviceCode } from '../../lib/device-scan';
import { imeiPassesLuhn } from '../../lib/imei';
import { batchCounts, classifyScannedImei, loadButtonLabel, rowSummary } from '../../lib/scan-batch';
import { getFriendlyErrorMessage } from '../../lib/utils';
import { createBackendInventoryBatch, fetchArchivedInventory } from '../../services/inventory-api';
import type { Product } from '../../types';
import { conditionName, formatImei, formatInputMoney, parseMoney, statusLabel } from '../format';
import { useMoney } from '../exchange';
import { QualityField } from '../QualityField';
import { isUsedCondition } from '../quality';
import { canSeeFinancials } from '../sections';
import { confirmScan } from '../scan/beep';
import { CameraScanner } from '../scan/CameraScanner';
import { ImeiScanField } from '../scan/ImeiScanField';
import { PhoneIcon } from '../scan/icons';
import { Field, Segs, Sheet, useDesk } from '../ui';
import { BASE_CAPS, MODELS } from './shared';

const CONDITIONS = [
  { id: 'NUEVO', label: 'Nuevo' },
  { id: 'USADO', label: 'Usado' },
  { id: 'REACONDICIONADO', label: 'Reacondicionado' },
];

type Shared = {
  model: string;
  capacity: string;
  color: string;
  condition: string;
  grade: string;
  price: string;
  cost: string;
  status: string;
  battery: string;
};

type Row = {
  id: string;
  order: number;
  imei: string;
  valid: boolean;
  serial: string;
  partNumber: string;
  detectedColor: string;
  color: string | null;
  battery: string | null;
  price: string | null;
  condition: string | null;
  open: boolean;
};

const EMPTY_SHARED: Shared = {
  model: '',
  capacity: '',
  color: '',
  condition: 'USADO',
  grade: 'A',
  price: '',
  cost: '',
  status: 'DISPONIBLE',
  battery: '',
};

function resolved(row: Row, shared: Shared) {
  return {
    color: row.color ?? (row.detectedColor || shared.color),
    battery: row.battery ?? shared.battery,
    price: row.price ?? shared.price,
    condition: row.condition ?? shared.condition,
  };
}

export function BatchLoad() {
  const { inventory, user, appSession, reloadInventory } = useAppContext();
  const money = useMoney();
  const { close, toast } = useDesk();
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [shared, setShared] = useState<Shared>(EMPTY_SHARED);
  const modelTouched = useRef(false);
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [archived, setArchived] = useState<Product[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchArchivedInventory(user).then((rows) => { if (active) setArchived(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  const stock = useMemo(() => [...inventory, ...archived].map((item) => ({
    imei: item.imei ?? '',
    status: item.status,
    archivedAt: item.archivedAt,
  })), [archived, inventory]);

  const ordered = [...rows].sort((left, right) => right.order - left.order);
  const classes = ordered.map((row) => classifyScannedImei(row.imei, {
    valid: row.valid,
    earlierImeis: rows.filter((item) => item.order < row.order).map((item) => item.imei),
    stock,
  }));
  const counts = batchCounts(classes);
  const missingShared = !shared.model.trim() || !parseMoney(shared.price);
  const blocked = counts.loadable === 0 || missingShared;

  const addParsed = (parsed: ParsedDeviceCode, raw = '') => {
    const imei = parsed.imei ?? extractImeiLoose(raw) ?? '';
    if (!/^\d{15}$/.test(imei)) {
      setError('El código no trae un IMEI de 15 dígitos.');
      return;
    }
    autofillImeiSpecs(imei);
    setError(null);
    setEntry('');
    setShared((current) => modelTouched.current || current.model.trim() || !parsed.model ? current : {
      ...current,
      model: parsed.model ?? '',
      capacity: parsed.capacity ?? current.capacity,
      color: parsed.color ?? current.color,
    });
    setRows((current) => {
      const order = current.reduce((max, row) => Math.max(max, row.order), 0) + 1;
      return [...current, {
      id: crypto.randomUUID(),
      order,
      imei,
      valid: imeiPassesLuhn(imei),
      serial: parsed.serial ?? '',
      partNumber: parsed.partNumber ?? '',
      detectedColor: parsed.color ?? '',
      color: null,
      battery: null,
      price: null,
      condition: null,
      open: false,
    }];
    });
    confirmScan();
  };

  const save = async () => {
    if (!user || blocked || busy) return;
    const payload = ordered
      .map((row, index) => ({ row, klass: classes[index] }))
      .filter((item) => item.klass?.loadable)
      .map(({ row }) => {
        const values = resolved(row, shared);
        const battery = values.battery.replace(/\D/g, '');
        const item: Omit<Product, 'id'> = {
          imei: row.imei,
          model: shared.model.trim(),
          capacity: shared.capacity,
          color: values.color.trim(),
          condition: values.condition,
          grade: isUsedCondition(values.condition) ? shared.grade : '',
          batteryHealth: battery ? `${battery}%` : '',
          cost: seeCosts ? parseMoney(shared.cost) : 0,
          price: parseMoney(values.price),
          currency: money.active,
          status: shared.status || 'DISPONIBLE',
          customFields: {
            ...(row.serial ? { serial: row.serial } : {}),
            ...(row.partNumber ? { partNumber: row.partNumber } : {}),
          },
        };
        return item;
      })
      .filter((item) => item.price > 0);
    if (!payload.length) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createBackendInventoryBatch(user, payload);
      await reloadInventory();
      if (result.errors.length) {
        setError(result.errors.map((item) => toActionMessage(item.message)).join(' · '));
        if (result.created.length) toast(result.created.length === 1 ? 'Cargaste 1 equipo' : `Cargaste ${result.created.length} equipos`);
        return;
      }
      toast(result.created.length === 1 ? 'Cargaste 1 equipo' : `Cargaste ${result.created.length} equipos`);
      close();
    } catch (cause) {
      setError(getFriendlyErrorMessage(cause, 'No se pudieron cargar los equipos.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        title="Carga en serie"
        onClose={close}
        className="batch-sheet"
        footer={(
          <div className="sacts">
            <button type="button" className="btn2 s" onClick={close} disabled={busy}>Cancelar</button>
            <button type="button" className="btn2 p" disabled={busy || blocked} onClick={() => void save()}>{busy ? 'Guardando…' : loadButtonLabel(counts.loadable)}</button>
          </div>
        )}
      >
        {error ? <div className="ferr" role="alert">{error}</div> : null}
        <div className="batch-layout" data-testid="batch-load">
          <section className="scan-card">
            <div className="scan-card-h">
              <span>Se aplica a todos</span>
              <button type="button" className="wlink" onClick={() => setEditing((value) => !value)}>{editing ? 'Listo' : 'Editar'}</button>
            </div>
            <div className="scan-device">
              <span className="scan-device-icon"><PhoneIcon /></span>
              <div>
                <b>{[shared.model, shared.capacity].filter(Boolean).join(' · ') || 'Elegí el modelo'}</b>
                <small>{[shared.color, [conditionName(shared.condition), isUsedCondition(shared.condition) ? shared.grade : ''].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || 'Completá los datos'}</small>
              </div>
            </div>
            {editing ? (
              <>
                <Field label="Modelo"><input aria-label="Modelo de la serie" list="batch-models" value={shared.model} placeholder="Ej. iPhone 13" onChange={(event) => { modelTouched.current = true; setShared((current) => ({ ...current, model: event.target.value })); }} /></Field>
                <datalist id="batch-models">{MODELS.map((item) => <option key={item} value={item} />)}</datalist>
                <Segs options={BASE_CAPS.map((item) => ({ id: item, label: item }))} value={shared.capacity} onChange={(capacity) => setShared((current) => ({ ...current, capacity }))} allowClear />
                <Field label="Color"><input aria-label="Color de la serie" value={shared.color} placeholder="Ej. Medianoche" onChange={(event) => setShared((current) => ({ ...current, color: event.target.value }))} /></Field>
                <p className="kicker">Condición</p>
                <Segs options={CONDITIONS} value={shared.condition} onChange={(condition) => setShared((current) => ({ ...current, condition, grade: isUsedCondition(condition) ? current.grade || 'A' : '' }))} />
                {isUsedCondition(shared.condition) ? <QualityField value={shared.grade} onChange={(grade) => setShared((current) => ({ ...current, grade }))} /> : null}
                <Field label="Batería %"><input aria-label="Batería de la serie" inputMode="numeric" placeholder="Ej. 87" value={shared.battery} onChange={(event) => setShared((current) => ({ ...current, battery: event.target.value.replace(/\D/g, '').slice(0, 3) }))} /></Field>
              </>
            ) : null}
            <dl className="scan-kv">
              <div><dt>Precio de venta</dt><dd>{editing ? <input aria-label="Precio de la serie" className={!parseMoney(shared.price) ? 'need' : ''} inputMode="numeric" value={shared.price ? `$ ${shared.price}` : '$ 0'} onChange={(event) => setShared((current) => ({ ...current, price: formatInputMoney(parseMoney(event.target.value)) }))} /> : (parseMoney(shared.price) ? `$ ${shared.price}` : '—')}</dd></div>
              {seeCosts ? <div><dt>Costo</dt><dd>{editing ? <input aria-label="Costo de la serie" inputMode="numeric" value={shared.cost ? `$ ${shared.cost}` : '$ 0'} onChange={(event) => setShared((current) => ({ ...current, cost: formatInputMoney(parseMoney(event.target.value)) }))} /> : (parseMoney(shared.cost) ? `$ ${shared.cost}` : '$ 0')}</dd></div> : null}
              <div><dt>Estado</dt><dd>{statusLabel(shared.status)}</dd></div>
            </dl>
            {missingShared ? <p className="scan-miss"><i />Falta el modelo o el precio para guardar</p> : null}
            <p className="kicker">Escaneá un IMEI tras otro</p>
            <ImeiScanField
              label="IMEI"
              value={entry}
              placeholder="15 dígitos"
              onChange={(value) => setEntry(value.replace(/\D/g, '').slice(0, 15))}
              onCamera={() => setCamera(true)}
              onEnter={() => { if (entry.trim()) addParsed(parseDeviceCode(entry), entry); }}
              onScan={(raw) => { if (raw) addParsed(parseDeviceCode(raw), raw); }}
            />
          </section>
          <section className="batch-list">
            <div className="scan-card-h">
              <b>{rows.length === 1 ? '1 escaneado' : `${rows.length} escaneados`}</b>
              <small>{counts.loadable === 1 ? '1 listo' : `${counts.loadable} listos`}{counts.warnings ? ` · ${counts.warnings === 1 ? '1 aviso' : `${counts.warnings} avisos`}` : ''}</small>
            </div>
            {ordered.map((row, index) => {
              const klass = classes[index];
              if (!klass) return null;
              const values = resolved(row, shared);
              const summary = rowSummary({
                classification: klass,
                color: values.color,
                battery: values.battery,
                editedColor: row.color !== null,
                editedBattery: row.battery !== null,
              });
              return (
                <article key={row.id} className={`batch-row ${klass.tone}${row.open ? ' open' : ''}`}>
                  <button type="button" className="batch-row-main" onClick={() => setRows((current) => current.map((item) => item.id === row.id ? { ...item, open: !item.open } : item))}>
                    <span className="batch-n">{row.order}</span>
                    <span>
                      <b>{formatImei(row.imei)}</b>
                      <small className={klass.tone}>{klass.tone === 'ok' ? '✓ ' : klass.tone === 'bad' ? '' : '⚠ '}{summary}</small>
                    </span>
                    <span className="batch-chevron" aria-hidden="true">{row.open ? '⌃' : '›'}</span>
                  </button>
                  <button type="button" className="batch-x" aria-label="Quitar equipo" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}>×</button>
                  {row.open ? (
                    <div className="batch-edit">
                      {row.partNumber ? <div className="scan-kv"><div><dt>Part number</dt><dd>{row.partNumber}</dd></div></div> : null}
                      {row.serial ? <div className="scan-kv"><div><dt>Serie</dt><dd>{row.serial}</dd></div></div> : null}
                      <div className="frow">
                        <Field label="Color"><input aria-label={`Color ${row.order}`} value={values.color} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, color: event.target.value } : item))} /></Field>
                        <Field label="Batería %"><input aria-label={`Batería ${row.order}`} inputMode="numeric" value={values.battery} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, battery: event.target.value.replace(/\D/g, '').slice(0, 3) } : item))} /></Field>
                      </div>
                      <Segs options={CONDITIONS} value={values.condition} onChange={(condition) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, condition } : item))} />
                      <Field label="Precio de venta"><input aria-label={`Precio ${row.order}`} inputMode="numeric" value={values.price ? `$ ${values.price}` : '$ 0'} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, price: formatInputMoney(parseMoney(event.target.value)) } : item))} /></Field>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        </div>
      </Sheet>
      {camera ? (
        <CameraScanner
          burst
          allowCameraSwitch={false}
          counts={{ ready: counts.loadable, scanned: rows.length }}
          onClose={() => setCamera(false)}
          onManual={() => setCamera(false)}
          onBurst={(raw, parsed) => addParsed(parsed, raw)}
        />
      ) : null}
    </>
  );
}
