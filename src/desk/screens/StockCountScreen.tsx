import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatArTime } from '../../lib/ar-date';
import {
  closeStockCount,
  fetchCurrentStockCount,
  fetchStockCount,
  fetchStockCountPreview,
  fetchStockCounts,
  resolveStockCount,
  scanStockCount,
  startStockCount,
  type BlindCount,
  type BlindScan,
  type ClosedStockCount,
  type StockCountLine,
  type StockCountListItem,
  type StockCountPreview,
  type StockScanResult,
} from '../../services/stock-counts-api';
import { formatImei, formatMoney } from '../format';
import { ListSkeleton } from '../list-skeleton';
import { canManageStockCount } from '../stock-count-access';
import { usePhoneLayout } from '../section-notices';
import { Actions, BackButton, Sheet, useDesk } from '../ui';

type View = 'list' | 'count' | 'result';
type Bucket = 'missing' | 'surplus' | 'sold' | 'matched';

const FILTERS: { id: Bucket; label: (count: ClosedStockCount) => string }[] = [
  { id: 'missing', label: (count) => `Faltan ${count.buckets.missing.length}` },
  { id: 'surplus', label: (count) => `Sobran ${count.buckets.surplus.length}` },
  { id: 'sold', label: (count) => `Figuran vendidos ${count.buckets.sold.length}` },
  { id: 'matched', label: (count) => `Coinciden ${count.buckets.matched.length}` },
];

function deviceName(model?: string | null, capacity?: string | null) {
  return [model, capacity].filter(Boolean).join(' ');
}

function tail(imei: string) {
  return `IMEI …${imei.slice(-4)}`;
}

function scanCopy(scan: BlindScan) {
  const name = deviceName(scan.model, scan.capacity);
  const ok = scan.result === 'FOUND';
  const detail: Record<StockScanResult, string> = {
    FOUND: [tail(scan.imei), scan.color].filter(Boolean).join(' · '),
    NOT_LOADED: 'No está cargado',
    SOLD: `${tail(scan.imei)} · figura vendido`,
    REPEATED: `${tail(scan.imei)} · repetido`,
  };
  const banner: Record<StockScanResult, string> = {
    FOUND: `Encontrado${name ? ` · ${name}` : ''}`,
    NOT_LOADED: 'No está cargado',
    SOLD: `Figura vendido${name ? ` · ${name}` : ''}`,
    REPEATED: 'Repetido',
  };
  return {
    title: scan.result === 'NOT_LOADED' ? tail(scan.imei) : (name || tail(scan.imei)),
    detail: detail[scan.result],
    badge: ok ? 'Encontrado' : 'Revisar',
    tone: ok ? 'ok' : 'warn',
    banner: banner[scan.result],
    bannerDetail: `IMEI ${formatImei(scan.imei)}`,
  };
}

function yours(mine: number, total: number) {
  return `${mine} ${mine === 1 ? 'tuyo' : 'tuyos'} · ${total} en total`;
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s4-7 10-7c2 0 3.8.7 5.3 1.7M22 12s-4 7-10 7c-2 0-3.8-.7-5.3-1.7M3 3l18 18" />
    </svg>
  );
}

function ScanIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function lineDetail(line: StockCountLine) {
  return [tail(line.imei), line.color, line.note].filter(Boolean).join(' · ');
}

export function StockEntryButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="dbtn s stock-entry" type="button" data-testid="stock-count-entry" onClick={onClick}>
      <CheckIcon />
      Control de stock
    </button>
  );
}

export function StockCountScreen({ onBack }: { onBack: () => void }) {
  const { user, appSession, reloadInventory } = useAppContext();
  const desk = useDesk();
  const phone = usePhoneLayout();
  const canManage = canManageStockCount(appSession?.membership);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('list');
  const [counts, setCounts] = useState<StockCountListItem[]>([]);
  const [blind, setBlind] = useState<BlindCount | null>(null);
  const [closed, setClosed] = useState<ClosedStockCount | null>(null);
  const [filter, setFilter] = useState<Bucket>('missing');
  const [selectedMissing, setSelectedMissing] = useState<string[]>([]);
  const [selectedSurplus, setSelectedSurplus] = useState<string[]>([]);
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState<StockCountPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imei, setImei] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    if (!user) return [];
    const rows = await fetchStockCounts(user);
    setCounts(rows);
    return rows;
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([fetchStockCounts(user), fetchCurrentStockCount(user)]).then(([rows, current]) => {
      if (!active) return;
      setCounts(rows);
      if (current) {
        setBlind(current);
        setView('count');
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el control');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (view === 'count') inputRef.current?.focus();
  }, [view, blind?.scans[0]?.id]);

  const openStart = () => {
    setSheet(true);
    setPreview(null);
    setPreviewLoading(true);
    if (!user) return;
    fetchStockCountPreview(user).then((next) => setPreview(next)).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'No se pudo preparar el control');
      setSheet(false);
    }).finally(() => setPreviewLoading(false));
  };

  const begin = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await startStockCount(user);
      setBlind(next);
      setSheet(false);
      setView('count');
      await loadList();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el control');
    } finally {
      setBusy(false);
    }
  };

  const submitScan = async () => {
    if (!user || !blind || busy) return;
    const value = imei.trim();
    if (!value) return;
    setBusy(true);
    setError('');
    try {
      setBlind(await scanStockCount(user, blind.id, value));
      setImei('');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo sumar el IMEI');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const showClosed = (next: ClosedStockCount) => {
    setClosed(next);
    setFilter('missing');
    setSelectedMissing(next.buckets.missing.flatMap((line) => line.inventoryItemId ? [line.inventoryItemId] : []));
    setSelectedSurplus(next.buckets.surplus.map((line) => line.imei));
    setView('result');
  };

  const finish = async () => {
    if (!user || !blind || busy) return;
    setBusy(true);
    setError('');
    try {
      showClosed(await closeStockCount(user, blind.id));
      await loadList();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar el control');
    } finally {
      setBusy(false);
    }
  };

  const openRow = async (item: StockCountListItem) => {
    if (!user) return;
    setError('');
    if (item.status === 'OPEN') {
      setLoading(true);
      try {
        const current = await fetchCurrentStockCount(user);
        if (!current) {
          await loadList();
          return;
        }
        setBlind(current);
        setView('count');
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'No se pudo abrir el control');
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      showClosed(await fetchStockCount(user, item.id));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el control');
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (mode: 'ADJUST' | 'RECORD') => {
    if (!user || !closed || busy || closed.resolution) return;
    setBusy(true);
    setError('');
    try {
      const next = await resolveStockCount(user, closed.id, {
        mode,
        missingIds: mode === 'ADJUST' ? selectedMissing : [],
        surplusImeis: mode === 'ADJUST' ? selectedSurplus : [],
      });
      if (mode === 'ADJUST') await reloadInventory();
      desk.toast(mode === 'ADJUST' ? 'Ajustamos el conteo. Quedó en el historial.' : 'Quedó registrado, sin cambiar el inventario.');
      setClosed(next);
      await loadList();
      setView('list');
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el control');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    if (view === 'list') onBack();
    else setView('list');
  };

  const hasOpen = counts.some((item) => item.status === 'OPEN') || view === 'count';
  const subtitle = view === 'count' && blind
    ? blind.subtitle
    : view === 'result' && closed
      ? (phone ? closed.subtitle.replace(/ · \d+ escaneos?$/, '') : closed.subtitle)
      : 'Conteos físicos del local';
  const latest = blind?.scans[0] ? scanCopy(blind.scans[0]) : null;
  const lines = closed ? closed.buckets[filter] : [];
  const selectable = !closed?.resolution && (filter === 'missing' || filter === 'surplus');
  const selectedHere = filter === 'missing'
    ? lines.filter((line) => line.inventoryItemId && selectedMissing.includes(line.inventoryItemId)).length
    : filter === 'surplus'
      ? lines.filter((line) => selectedSurplus.includes(line.imei)).length
      : 0;

  const toggle = (line: StockCountLine) => {
    if (filter === 'missing' && line.inventoryItemId) {
      setSelectedMissing((current) => current.includes(line.inventoryItemId!) ? current.filter((id) => id !== line.inventoryItemId) : [...current, line.inventoryItemId!]);
    }
    if (filter === 'surplus') {
      setSelectedSurplus((current) => current.includes(line.imei) ? current.filter((id) => id !== line.imei) : [...current, line.imei]);
    }
  };

  return (
    <div className={`dscreen stock-page${phone ? ' has-dock' : ''}`} data-testid="stock-count-page">
      <div className="dtop">
        <BackButton onClick={leave} />
        <div className="dtitle">
          <h1>Control de stock</h1>
          <div className="dsub">{subtitle}</div>
        </div>
        {!phone && view === 'count' && canManage ? <div className="dright"><button className="dbtn s" type="button" data-testid="stock-close" onClick={() => void finish()} disabled={busy}>Cerrar control</button></div> : null}
        {!phone && view === 'list' && canManage && !hasOpen && counts.length > 0 ? <div className="dright"><button className="dbtn p" type="button" onClick={openStart}>Iniciar control</button></div> : null}
      </div>
      {error ? <div className="ferr" role="alert">{error}</div> : null}
      {loading ? <ListSkeleton variant="cards" testId="stock-loading" /> : null}

      {!loading && view === 'list' && counts.length === 0 ? (
        <div className="stock-empty" data-testid="stock-empty">
          <div className="i"><ScanIcon size={28} /></div>
          <h2>Todavía no hiciste controles de stock</h2>
          <p>Contá lo que hay en el local escaneando los IMEI y compará con el sistema. Sin ver cuántos hay.</p>
          {canManage ? <button className="dbtn p" type="button" onClick={openStart}>Iniciar control</button> : null}
        </div>
      ) : null}

      {!loading && view === 'list' && counts.length > 0 ? (
        <>
          {phone && canManage && !counts.some((item) => item.status === 'OPEN') ? <button className="dbtn p stock-entry" type="button" onClick={openStart}>Iniciar control</button> : null}
          <div className="card history-list" data-testid="stock-history">
            {counts.map((item) => (
              <button key={item.id} className="history-row" type="button" onClick={() => void openRow(item)}>
                <span className="info"><b>{item.subtitle}</b>{item.summary ? <small>{item.summary}</small> : null}</span>
                <span className="spill mid">{item.status === 'OPEN' ? 'Abierto' : item.resolution === 'ADJUSTED' ? 'Ajustado' : item.resolution === 'RECORDED' ? 'Registrado' : 'Pendiente'}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {!loading && view === 'count' && blind ? (
        <>
          <div className="blind"><EyeIcon /><span>Conteo a ciegas: escaneá todo lo que ves en el local.</span></div>
          <form onSubmit={(event) => { event.preventDefault(); void submitScan(); }}>
            <label className="scan">
              <ScanIcon />
              <input
                ref={inputRef}
                value={imei}
                placeholder="Escaneá o escribí el IMEI"
                inputMode="numeric"
                enterKeyHint="done"
                autoComplete="off"
                autoFocus
                aria-label="Escaneá o escribí el IMEI"
                data-testid="stock-scan-input"
                onChange={(event) => setImei(event.target.value)}
              />
              {phone ? null : <span className="k">Enter para sumar</span>}
            </label>
          </form>
          {latest ? <div className={`fb ${latest.tone}`} role="status"><span className="i">{latest.tone === 'ok' ? '✓' : '!'}</span><div><b>{latest.banner}</b><small>{latest.bannerDetail}</small></div></div> : null}
          <div className="cnt"><b>Tus escaneos</b><small>{yours(blind.mine, blind.total)}</small></div>
          <div className="dcard flush">
            {blind.scans.length === 0 ? <div className="srow"><div className="m"><b>Todavía no escaneaste</b><small>El lector suma con Enter.</small></div></div> : blind.scans.map((scan) => {
              const copy = scanCopy(scan);
              return (
                <div className="srow" key={scan.id}>
                  <span className="t">{formatArTime(scan.createdAt)}</span>
                  <div className="m"><b>{copy.title}</b><small>{copy.detail}</small></div>
                  <span className="spill cst" style={{ ['--pc' as string]: copy.tone === 'ok' ? '#25A66A' : '#E0A100' }}>{copy.badge}</span>
                </div>
              );
            })}
          </div>
          {phone && canManage ? <div className="ctl-acts"><button className="dbtn s" type="button" data-testid="stock-close" onClick={() => void finish()} disabled={busy}>Cerrar control</button></div> : null}
        </>
      ) : null}

      {!loading && view === 'result' && closed ? (
        <>
          <div className="dstats">
            <div className="dstat"><div className="eb">Coinciden</div><div className="big g">{closed.buckets.matched.length}</div></div>
            <div className="dstat"><div className="eb">Faltan</div><div className="big r">{closed.buckets.missing.length}</div><small className="mut">Disponibles que nadie escaneó</small></div>
            <div className="dstat"><div className="eb">Sobran</div><div className="big a">{closed.buckets.surplus.length}</div><small className="mut">Escaneados y no cargados</small></div>
            <div className="dstat"><div className="eb">Figuran vendidos</div><div className="big a">{closed.buckets.sold.length}</div><small className="mut">{closed.excludedNoImei} sin IMEI quedaron afuera</small></div>
          </div>
          <div className="dbar"><div className="wchips stock-chips">
            {FILTERS.map((item) => <button key={item.id} className={`wchip${filter === item.id ? ' on' : ''}`} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label(closed)}</button>)}
          </div></div>
          <div className="dcard flush">
            {selectable ? <div className="sel-bar"><span>{selectedHere} seleccionados</span><button className="dbtn s" type="button" onClick={() => void resolve('ADJUST')} disabled={busy || selectedHere === 0}>{filter === 'surplus' ? 'Cargar' : 'Archivar · Faltante'}</button></div> : null}
            {lines.length === 0 ? <div className="srow"><div className="m"><b>Nada en este grupo</b></div></div> : lines.map((line) => {
              const checked = filter === 'missing' ? Boolean(line.inventoryItemId && selectedMissing.includes(line.inventoryItemId)) : selectedSurplus.includes(line.imei);
              return (
                <div className="srow" key={line.key}>
                  {selectable ? <input className="chk" type="checkbox" checked={checked} aria-label={deviceName(line.model, line.capacity) || tail(line.imei)} onChange={() => toggle(line)} /> : null}
                  <div className="m"><b>{deviceName(line.model, line.capacity) || tail(line.imei)}</b><small>{lineDetail(line)}</small></div>
                  {line.price != null ? <b>{formatMoney(line.price, line.currency === 'USD' ? 'USD' : 'ARS')}</b> : null}
                </div>
              );
            })}
          </div>
          {canManage && !closed.resolution ? (
            <>
              <div className="ctl-acts">
                <button className="dbtn s" type="button" data-testid="stock-record" onClick={() => void resolve('RECORD')} disabled={busy}>Solo dejar registrado</button>
                <button className="dbtn p" type="button" data-testid="stock-adjust" onClick={() => void resolve('ADJUST')} disabled={busy}>Ajustar al conteo</button>
              </div>
              <p className="eqs-note stock-note">Las dos opciones quedan en Historial. Ajustar archiva los faltantes y carga los sobrantes que elijas.</p>
            </>
          ) : null}
          {closed.resolution ? <p className="eqs-note stock-note">{closed.resolution === 'ADJUSTED' ? 'Este control ya se ajustó.' : 'Este control quedó solo registrado.'}</p> : null}
        </>
      ) : null}

      {sheet ? (
        <Sheet className="compact" title="Iniciar control de stock" subtitle="Se cuenta escaneando o escribiendo el IMEI de cada equipo." onClose={() => setSheet(false)} footer={<Actions primary="Iniciar control" onPrimary={() => void begin()} onSecondary={() => setSheet(false)} busy={busy} />}>
          <div className="flab">Qué vas a contar</div>
          <div className="reasons">
            <button className="wchip on" type="button">Equipos</button>
            <button className="wchip" type="button" disabled>Accesorios · más adelante</button>
          </div>
          <div className="kv"><span>Equipos a contar</span><b>Disponibles, reservados y en revisión</b></div>
          <div className="kv"><span>Sin IMEI (no se pueden contar)</span><b>{previewLoading || !preview ? <span className="sk stock-sk" /> : `${preview.excludedNoImei} ${preview.excludedNoImei === 1 ? 'equipo' : 'equipos'}`}</b></div>
          <div className="kv"><span>Quiénes cuentan</span><b>Todo el equipo con Inventario</b></div>
          <div className="blind"><EyeIcon /><span>Mientras cuentan nadie ve cuántos equipos hay ni cuáles faltan. Lo ves vos al cerrar.</span></div>
        </Sheet>
      ) : null}
    </div>
  );
}
