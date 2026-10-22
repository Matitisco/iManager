import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Clock3, Info, Play, Scan } from 'lucide-react';
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
  type StockCountListItem,
  type StockCountPreview,
  type StockScanResult,
} from '../../services/stock-counts-api';
import { extractImeiLoose } from '../../lib/device-scan';
import { formatImei, formatMoney } from '../format';
import { ImanagerIcon } from '../icons';
import { CameraScanner } from '../scan/CameraScanner';
import { ScanCameraButton, ScanReady } from '../scan/ImeiScanField';
import { ListSkeleton } from '../list-skeleton';
import { canManageStockCount } from '../stock-count-access';
import { usePhoneLayout } from '../section-notices';
import { GroupTabs } from '../group-tabs';
import { Actions, Sheet, useDesk } from '../ui';

type View = 'list' | 'count' | 'result';
type Bucket = 'missing' | 'surplus' | 'sold' | 'matched';

const FILTERS: { id: Bucket; label: (count: ClosedStockCount) => string }[] = [
  { id: 'missing', label: (count) => `Sin escanear ${count.buckets.missing.length}` },
  { id: 'surplus', label: (count) => `Sin cargar ${count.buckets.surplus.length}` },
  { id: 'sold', label: (count) => `Figuran vendidos ${count.buckets.sold.length}` },
  { id: 'matched', label: (count) => `Coinciden ${count.buckets.matched.length}` },
];

function deviceName(model?: string | null, capacity?: string | null) {
  return [model, capacity].filter(Boolean).join(' · ');
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

function deviceColor(color: string) {
  const colors: Record<string, string> = {
    'titanio natural': '#A5A29B', ultramarino: '#3048D8', blanco: '#F3F4F6',
    negro: '#26272B', medianoche: '#333B46', azul: '#6A91AF', rosa: '#E6B6C3',
    rojo: '#C64243', verde: '#7F9F8F', amarillo: '#F2D174', violeta: '#B8A4CA',
  };
  return colors[color.toLocaleLowerCase('es').trim()] || '#E6E8EC';
}

function countStatus(item: StockCountListItem) {
  return item.status === 'OPEN' ? 'Abierto' : item.resolution === 'ADJUSTED' ? 'Ajustado' : item.resolution === 'RECORDED' ? 'Registrado' : 'Por revisar';
}

function CountStatus({ item }: { item: StockCountListItem }) {
  return <span className={`stock-status${item.resolution ? ' done' : ''}`}>
    <Clock3 size={13} aria-hidden="true" /><i aria-hidden="true" />{countStatus(item)}
  </span>;
}

export function StockCountScreen() {
  const { user, appSession } = useAppContext();
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
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState<StockCountPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [imei, setImei] = useState('');
  const [camera, setCamera] = useState(false);
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
    Promise.all([fetchStockCounts(user), fetchCurrentStockCount(user)]).then(async ([rows, current]) => {
      if (!active) return;
      setCounts(rows);
      if (current) {
        setBlind(current);
        setView('count');
      } else if (rows[0]?.status === 'CLOSED') {
        const latest = await fetchStockCount(user, rows[0].id);
        if (active) showClosed(latest);
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

  const submitScan = async (raw?: string) => {
    if (!user || !blind || busy) return;
    const value = extractImeiLoose((raw ?? imei).trim()) ?? "";
    if (!value) {
      setError('El IMEI tiene 15 dígitos');
      return;
    }
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
    if (!user || busy) return;
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

  const resolve = async () => {
    if (!user || !closed || !canManage || busy || closed.resolution) return;
    setBusy(true);
    setError('');
    try {
      const next = await resolveStockCount(user, closed.id, {
        mode: 'RECORD',
        missingIds: [],
        surplusImeis: [],
      });
      setClosed(next);
      desk.toast('Quedó registrado, sin cambiar el inventario.');
      await loadList();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el control');
    } finally {
      setBusy(false);
    }
  };

  const hasOpen = counts.some((item) => item.status === 'OPEN') || view === 'count';
  const latest = blind?.scans[0] ? scanCopy(blind.scans[0]) : null;
  const lines = closed ? closed.buckets[filter] : [];
  const previous = counts.filter((item) => item.id !== (view === 'result' ? closed?.id : blind?.id));
  const timeZone = appSession?.store?.timezone || 'America/Argentina/Buenos_Aires';
  const date = (value: string, long = false) => new Intl.DateTimeFormat('es-AR', {
    timeZone, day: long ? 'numeric' : '2-digit', month: long ? 'long' : '2-digit', ...(long ? {} : { year: 'numeric' }),
  }).format(new Date(value));
  const closedWho = closed?.subtitle.match(/ · contaron (.*?)(?: · \d+ escaneos?)?$/)?.[1];
  const groupDescription: Record<Bucket, string> = {
    missing: 'Disponibles al iniciar que no se escanearon.',
    surplus: 'IMEI escaneados que no están cargados como disponibles.',
    sold: 'Equipos que figuran vendidos en el sistema.',
    matched: 'Equipos disponibles que se escanearon.',
  };

  return (
    <div className={`dscreen stock-page${phone ? ' has-dock' : ''}`} data-testid="stock-count-page">
      <div className="dtop">
        <div className="dtitle">
          <h1>Control de stock</h1>
        </div>
        {!phone && view === 'count' && canManage ? <div className="dright"><button className="dbtn s" type="button" data-testid="stock-close" onClick={() => void finish()} disabled={busy}>Cerrar control</button></div> : null}
        {view !== 'count' && canManage && !hasOpen && !loading && counts.length > 0 ? <div className="dright"><button className="dbtn p stock-start" type="button" onClick={openStart} disabled={busy}><Play size={12} fill="currentColor" aria-hidden="true" />Iniciar control</button></div> : null}
      </div>
      <GroupTabs />
      {error && !sheet ? <div className="ferr" role="alert">{error}</div> : null}
      {loading ? <ListSkeleton variant="cards" testId="stock-loading" /> : null}

      {!loading && view === 'list' && counts.length === 0 ? (
        <div className="stock-empty" data-testid="stock-empty">
          <div className="i"><ScanIcon size={28} /></div>
          <h2>Todavía no hiciste controles de stock</h2>
          <p>Escaneá los IMEI y compará con los disponibles.</p>
          {canManage ? <button className="dbtn p" type="button" onClick={openStart}>Iniciar control</button> : null}
        </div>
      ) : null}

      {!loading && view === 'count' && blind ? (
        <>
          <div className="blind"><EyeIcon /><span>Conteo a ciegas: escaneá todo lo que ves en el local.</span></div>
          <form onSubmit={(event) => { event.preventDefault(); void submitScan(); }}>
            <div className="scan-imei stock-scan-row">
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
              <ScanCameraButton onClick={() => setCamera(true)} />
            </div>
            <ScanReady />
          </form>
          {camera ? (
            <CameraScanner
              loose
              onClose={() => { setCamera(false); inputRef.current?.focus(); }}
              onManual={() => { setCamera(false); inputRef.current?.focus(); }}
              onUse={(parsed) => {
                setCamera(false);
                const value = parsed.imei ?? extractImeiLoose(parsed.imei ?? '') ?? '';
                if (value) void submitScan(value);
              }}
            />
          ) : null}
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
          <section className="stock-summary" aria-label="Resultado del conteo">
            <div className="stock-summary-head">
              <h2>Conteo del {date(closed.startedAt, true)}</h2>
              <CountStatus item={closed} />
            </div>
            <p className="stock-meta">Cerrado {date(closed.closedAt || closed.startedAt)} · {new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(closed.closedAt || closed.startedAt))}{closedWho ? <><span className="stock-meta-dot"> · </span><span className="stock-counters">{phone ? closedWho : `Contaron ${closedWho}`}</span></> : null}</p>
            <p className="stock-comparison">Comparación con Disponibles{phone ? '' : '.'}</p>
            {closed.scanCount === 0 ? <p className="stock-no-scans" data-testid="stock-coverage"><b>Sin escaneos</b><span>Los equipos sin escanear no confirman pérdidas.</span></p> : null}
            <div className="stock-stats">
              {[{ label: 'Coinciden', value: closed.buckets.matched.length, ok: true },
                { label: 'Sin escanear', value: closed.buckets.missing.length },
                { label: 'Sin cargar', value: closed.buckets.surplus.length },
                { label: closed.buckets.sold.length === 1 ? 'Figura vendido' : 'Figuran vendidos', value: closed.buckets.sold.length }].map((stat) => (
                <div className={`stock-stat${stat.ok ? ' ok' : ''}`} key={stat.label}><i aria-hidden="true" /><b>{stat.value}</b><span>{stat.label}</span></div>
              ))}
            </div>
            <p className="stock-excluded" data-testid="stock-excluded"><Info size={15} aria-hidden="true" />{closed.excludedNoImei} {phone ? 'sin IMEI' : `${closed.excludedNoImei === 1 ? 'equipo' : 'equipos'} sin IMEI`}, fuera del conteo.</p>
          </section>
          <div className="stock-chips" aria-label="Grupos del resultado">
            {FILTERS.map((item) => <button key={item.id} className={`wchip${filter === item.id ? ' on' : ''}`} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label(closed)}</button>)}
          </div>
          <p className="stock-group-description">{groupDescription[filter]}</p>
          <div className="stock-results">
            <div className="stock-lines">
              {lines.length === 0 ? <div className="stock-line"><span>Nada en este grupo</span></div> : lines.map((line) => (
                <div className="stock-line" key={line.key}>
                  <span className="stock-device-icon" aria-hidden="true"><ImanagerIcon name="equipo" size={24} /></span>
                  <div className="stock-device"><b>{deviceName(line.model, line.capacity) || 'Sin modelo'}</b><small>IMEI {line.imei}</small>{phone && line.color ? <small>{line.color}</small> : null}{line.note && filter === 'sold' ? <small>{line.note}</small> : null}</div>
                  {!phone && line.color ? <span className="stock-color"><i style={{ backgroundColor: deviceColor(line.color) }} aria-hidden="true" />{line.color}</span> : null}
                  {line.price != null ? <b className="stock-price">{formatMoney(line.price, line.currency === 'USD' ? 'USD' : 'ARS')}</b> : null}
                </div>
              ))}
            </div>
            <div className="stock-register">
              <p>El inventario no cambia.</p>
              {canManage && !closed.resolution ? <button className="dbtn p" type="button" data-testid="stock-record" onClick={() => void resolve()} disabled={busy}>Registrar conteo</button> : null}
            </div>
          </div>
        </>
      ) : null}

      {!loading && view !== 'count' && previous.length > 0 ? <section className="stock-previous" data-testid="stock-history">
        <h2>Controles anteriores</h2>
        <div className="stock-history-list">{previous.map((item) => <button key={item.id} className="stock-history-row" type="button" onClick={() => void openRow(item)} disabled={busy}>
          <span><b>{date(item.closedAt || item.startedAt)} · {new Intl.DateTimeFormat('es-AR', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(item.closedAt || item.startedAt))}</b><small>{item.summary || item.subtitle}</small></span>
          <CountStatus item={item} /><ChevronRight size={16} aria-hidden="true" />
        </button>)}</div>
      </section> : null}

      {sheet ? (
        <Sheet className="compact stock-start-sheet" title="Iniciar control" onClose={() => setSheet(false)} busy={busy} footer={<Actions primary="Iniciar conteo" onPrimary={() => void begin()} onSecondary={() => setSheet(false)} busy={busy} />}>
          {error ? <div className="ferr" role="alert">{error}</div> : null}
          <div className="stock-scope"><span>Comparar con</span><b><i aria-hidden="true" />Disponible</b></div>
          <div className="stock-blind"><Scan size={26} aria-hidden="true" /><div><b>Conteo a ciegas</b><p>Escaneá los IMEI. Compará al cerrar.</p></div></div>
          {previewLoading || !preview ? <ListSkeleton variant="lines" rows={1} testId="stock-preview-loading" /> : <p className="stock-start-excluded"><i aria-hidden="true" />{preview.excludedNoImei} {preview.excludedNoImei === 1 ? 'equipo sin IMEI queda fuera.' : 'equipos sin IMEI quedan fuera.'}</p>}
          <p className="stock-start-note">El inventario no cambia al cerrar.</p>
        </Sheet>
      ) : null}
    </div>
  );
}
