import { useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { imeiLoadError } from '../../lib/imei';
import { frequentModels } from '../../lib/scan-batch';
import type { Product } from '../../types';
import { useMoney } from '../exchange';
import { canSeeFinancials } from '../sections';
import { CameraScanner } from '../scan/CameraScanner';
import { draftFromCode, type ScanDraft } from '../scan/draft';
import { useDesk } from '../ui';
import type { SaleResume } from '../types';
import { formatImei, formatInputMoney, parseMoney } from '../format';
import { isUsedCondition } from '../quality';
import { Field, Segs, Sheet } from '../ui';
import { BASE_CAPS, MODELS } from './shared';

export function ScanReviewHost({
  draft,
  resume,
  run,
  busy,
  error,
}: {
  draft: ScanDraft;
  resume?: SaleResume;
  busy?: boolean;
  error?: string | null;
  run: (action: () => Promise<unknown>, ok: string, options?: { afterSuccess?: () => void }) => void;
}) {
  const { inventory, addProduct, appSession } = useAppContext();
  const money = useMoney();
  const desk = useDesk();
  const seeCosts = canSeeFinancials(appSession?.membership?.sections, appSession?.membership?.role);
  const [current, setCurrent] = useState(draft);
  const [token, setToken] = useState(0);
  const [camera, setCamera] = useState(false);
  const createdId = useRef('');
  if (camera) {
    return (
      <CameraScanner
        onClose={() => setCamera(false)}
        onManual={() => setCamera(false)}
        onUse={(parsed) => {
          setCurrent(draftFromCode(parsed, { battery: current.battery, condition: current.condition, price: current.price, cost: current.cost, notes: current.notes }));
          setToken((value) => value + 1);
          setCamera(false);
        }}
      />
    );
  }
  return (
    <ScanReviewSheet
      key={token}
      initial={current}
      frequent={frequentModels(inventory, [...MODELS], 4)}
      seeCosts={seeCosts}
      busy={busy}
      error={error}
      onClose={desk.close}
      onRescan={() => setCamera(true)}
      onSave={(next) => {
        void run(async () => {
          const created = await addProduct(scanProduct(next, money.active === 'USD' ? 'USD' : 'ARS', seeCosts), { restockRetired: true });
          createdId.current = created.id;
        }, 'Equipo cargado', {
          afterSuccess: resume ? () => desk.open({
            type: 'new-sale',
            productId: createdId.current,
            clientName: resume.clientName,
            clientId: resume.clientId,
            source: resume.source ?? 'sales',
            resumeAmount: resume.amount ?? '',
          }) : undefined,
        });
      }}
    />
  );
}
import { boxLabel, detectedWasEdited, type ScanFieldKey } from '../scan/draft';
import { PhoneIcon } from '../scan/icons';

const CONDITIONS = [
  { id: 'NUEVO', label: 'Nuevo' },
  { id: 'USADO', label: 'Usado' },
  { id: 'REACONDICIONADO', label: 'Reacondicionado' },
];

export function scanProduct(draft: ScanDraft, currency: 'ARS' | 'USD', seeCosts: boolean): Omit<Product, 'id'> {
  const battery = draft.battery.replace(/\D/g, '');
  return {
    imei: draft.imei.trim(),
    model: draft.model.trim(),
    capacity: draft.capacity,
    color: draft.color.trim(),
    condition: draft.condition,
    grade: isUsedCondition(draft.condition) ? '' : '',
    batteryHealth: battery ? `${battery}%` : '',
    cost: seeCosts ? parseMoney(draft.cost) : 0,
    price: parseMoney(draft.price),
    currency,
    status: 'DISPONIBLE',
    customFields: {
      ...(draft.serial.trim() ? { serial: draft.serial.trim() } : {}),
      ...(draft.partNumber.trim() ? { partNumber: draft.partNumber.trim() } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    },
  };
}

export function ScanReviewSheet({
  initial,
  frequent,
  seeCosts = true,
  busy,
  error,
  onClose,
  onRescan,
  onSave,
}: {
  initial: ScanDraft;
  frequent: string[];
  seeCosts?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onRescan: () => void;
  onSave: (draft: ScanDraft) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [tried, setTried] = useState(false);
  const labeled = boxLabel(draft);
  const edited = detectedWasEdited(draft);
  const missingPrice = !parseMoney(draft.price);
  const missingModel = !draft.model.trim();
  const imeiError = draft.imei ? imeiLoadError(draft.imei) : null;
  const incomplete = missingModel || missingPrice || Boolean(imeiError);

  const setField = (key: ScanFieldKey, value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
      touched: {
        ...current.touched,
        [key]: current.detected[key] ? value.trim() !== initial[key].trim() : current.touched[key],
      },
    }));
  };

  const moneyInput = (key: 'price' | 'cost', raw: string) => {
    const digits = formatInputMoney(parseMoney(raw));
    setDraft((current) => ({ ...current, [key]: digits }));
  };

  const save = () => {
    setTried(true);
    if (incomplete || busy) return;
    onSave(draft);
  };

  return (
    <Sheet
      title="Revisá el equipo"
      subtitle={labeled ? 'Leímos la etiqueta de la caja. Completá lo que falta y guardá.' : 'Este código trae solo el IMEI. Elegí el modelo y completá el resto.'}
      onClose={onClose}
      className="scan-review"
      footer={(
        <div className="scan-foot">
          {incomplete ? <p className="scan-miss"><i />Falta completar para guardar</p> : <span />}
          <div className="sacts">
            <button type="button" className="btn2 s" onClick={onRescan} disabled={busy}>Escanear otro</button>
            <button type="button" className="btn2 p" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar equipo'}</button>
          </div>
        </div>
      )}
    >
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      <div className="scan-grid" data-testid="scan-review">
        <section className="scan-card">
          <div className="scan-card-h">
            <span>Detectado del código</span>
            <em className={edited ? 'editado' : ''}>{edited ? 'editado' : 'detectado'}</em>
            <button type="button" className="wlink" onClick={() => setEditing((value) => !value)}>{editing ? 'Listo' : 'Editar'}</button>
          </div>
          {labeled ? (
            <div className="scan-device">
              <span className="scan-device-icon"><PhoneIcon /></span>
              <div>
                {editing ? (
                  <input aria-label="Modelo" value={draft.model} placeholder="Ej. iPhone 13" onChange={(event) => setField('model', event.target.value)} />
                ) : (
                  <b>{[draft.model, draft.capacity].filter(Boolean).join(' · ') || 'Completá el modelo'}</b>
                )}
                {editing ? (
                  <input aria-label="Color detectado" value={draft.color} placeholder="Color" onChange={(event) => setField('color', event.target.value)} />
                ) : (
                  <small>{draft.color || 'Completá el color'}</small>
                )}
              </div>
            </div>
          ) : null}
          <dl className="scan-kv">
            <div><dt>IMEI</dt><dd>{editing ? <input aria-label="IMEI" inputMode="numeric" value={draft.imei} onChange={(event) => setField('imei', event.target.value.replace(/\D/g, '').slice(0, 15))} /> : (draft.imei ? formatImei(draft.imei) : '—')}</dd></div>
            {labeled ? <div><dt>Serie</dt><dd>{editing ? <input aria-label="Serie" value={draft.serial} onChange={(event) => setField('serial', event.target.value.toUpperCase())} /> : (draft.serial || '—')}</dd></div> : null}
            {labeled ? <div><dt>Part number</dt><dd>{editing ? <input aria-label="Part number" value={draft.partNumber} onChange={(event) => setField('partNumber', event.target.value.toUpperCase())} /> : (draft.partNumber || '—')}</dd></div> : null}
          </dl>
          {imeiError && tried ? <p className="ferr">{imeiError}</p> : null}
          {!labeled || !draft.model ? (
            <>
              <p className="kicker">Elegí el modelo</p>
              <input className="scan-search" aria-label="Buscar modelo" value={draft.model} placeholder="Buscar modelo" onChange={(event) => setField('model', event.target.value)} />
              <div className="sgs">
                {frequent.map((model) => (
                  <button key={model} type="button" className={`sg${draft.model === model ? ' on' : ''}`} onClick={() => setField('model', model)}>{model}</button>
                ))}
              </div>
              <p className="kicker">Capacidad</p>
              <Segs options={BASE_CAPS.map((item) => ({ id: item, label: item }))} value={draft.capacity} onChange={(value) => setField('capacity', value)} allowClear />
            </>
          ) : null}
        </section>
        <section className="scan-complete">
          <div className="scan-card-h">
            <span>Completá</span>
            <small>El código no trae estos datos</small>
          </div>
          {labeled ? (
            <>
              <p className="kicker">Condición</p>
              <Segs options={CONDITIONS} value={draft.condition} onChange={(value) => setDraft((current) => ({ ...current, condition: value }))} allowClear />
              <div className="frow">
                <Field label="Batería %">
                  <input aria-label="Batería %" inputMode="numeric" placeholder="Ej. 87" value={draft.battery} onChange={(event) => setDraft((current) => ({ ...current, battery: event.target.value.replace(/\D/g, '').slice(0, 3) }))} />
                </Field>
                {seeCosts ? (
                  <Field label="Costo">
                    <input aria-label="Costo" inputMode="numeric" value={draft.cost ? `$ ${draft.cost}` : '$ 0'} onChange={(event) => moneyInput('cost', event.target.value)} />
                  </Field>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="frow">
                <Field label="Color">
                  <input aria-label="Color" value={draft.color} placeholder="Ej. Azul" onChange={(event) => setField('color', event.target.value)} />
                </Field>
                <Field label="Batería %">
                  <input aria-label="Batería %" inputMode="numeric" placeholder="Ej. 87" value={draft.battery} onChange={(event) => setDraft((current) => ({ ...current, battery: event.target.value.replace(/\D/g, '').slice(0, 3) }))} />
                </Field>
              </div>
              <p className="kicker">Condición</p>
              <Segs options={CONDITIONS} value={draft.condition} onChange={(value) => setDraft((current) => ({ ...current, condition: value }))} allowClear />
              {seeCosts ? (
                <Field label="Costo">
                  <input aria-label="Costo" inputMode="numeric" value={draft.cost ? `$ ${draft.cost}` : '$ 0'} onChange={(event) => moneyInput('cost', event.target.value)} />
                </Field>
              ) : null}
            </>
          )}
          <Field label="Precio de venta" mark="obligatorio">
            <input className={missingPrice ? 'need' : ''} aria-label="Precio de venta" inputMode="numeric" value={draft.price ? `$ ${draft.price}` : '$ 0'} onChange={(event) => moneyInput('price', event.target.value)} />
          </Field>
          <Field label="Notas">
            <textarea aria-label="Notas" placeholder="Detalles, accesorios, garantía..." value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} />
          </Field>
          {missingModel && tried ? <p className="ferr">Elegí el modelo</p> : null}
        </section>
      </div>
    </Sheet>
  );
}
