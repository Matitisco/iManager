import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatMoney } from './format';
import { ImanagerIcon } from './icons';
import {
  BLUE_REFRESH_LABEL,
  BLUE_REFRESH_MS,
  BLUE_SOURCES,
  blueSourceLabel,
  convertUsd,
  formatClock,
  isFreshQuote,
  quoteFromState,
  readBlueState,
  refreshBlueQuote,
  saveBlueSource,
  sellDelta,
  type BlueDay,
  type BlueQuote,
  type BlueSourceId,
} from './blue-rate';

type Phase = 'ready' | 'loading' | 'error';

function deltaParts(delta: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta == null) return { text: '—', tone: 'flat' };
  if (delta > 0) return { text: `▲ ${formatMoney(delta)}`, tone: 'up' };
  if (delta < 0) return { text: `▼ ${formatMoney(Math.abs(delta))}`, tone: 'down' };
  return { text: formatMoney(0), tone: 'flat' };
}

export function BlueDollar() {
  const initial = readBlueState();
  const initialQuote = quoteFromState(initial, initial.source);
  const [source, setSource] = useState<BlueSourceId>(initial.source);
  const [quote, setQuote] = useState<BlueQuote | null>(initialQuote);
  const [days, setDays] = useState<Record<string, BlueDay>>(initial.days[initial.source] ?? {});
  const [phase, setPhase] = useState<Phase>(initialQuote ? 'ready' : 'loading');
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'sell' | 'buy'>('sell');
  const [usd, setUsd] = useState('');
  const request = useRef(0);
  const selected = useRef(source);
  selected.current = source;

  const load = useCallback(async (next: BlueSourceId, mode: 'silent' | 'visible') => {
    const id = ++request.current;
    if (mode === 'visible') setPhase('loading');
    try {
      const result = await refreshBlueQuote(next);
      if (request.current !== id || selected.current !== next) return;
      setQuote(result.quote);
      setDays(result.days);
      setPhase('ready');
    } catch {
      if (request.current !== id || selected.current !== next) return;
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    const state = readBlueState();
    const snap = state.quotes[source];
    if (!snap || !isFreshQuote(snap.fetchedAt)) {
      void load(source, snap ? 'silent' : 'visible');
    }
    const timer = window.setInterval(() => { void load(source, 'silent'); }, BLUE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [source, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = (next: BlueSourceId) => {
    if (next === source) return;
    const state = saveBlueSource(next);
    setSource(next);
    setQuote(quoteFromState(state, next));
    setDays(state.days[next] ?? {});
    setPhase(state.quotes[next] ? 'ready' : 'loading');
  };

  const label = blueSourceLabel(source);
  const clock = quote ? formatClock(quote.updatedAt) : '';
  const delta = quote ? sellDelta(quote.sell, days) : null;
  const deltaView = deltaParts(delta);
  const rate = quote ? (side === 'sell' ? quote.sell : quote.buy) : 0;
  const pesos = convertUsd(Number(usd || 0), rate);

  return (
    <>
      <div className={`dolar ${phase}`} data-testid="blue-widget" data-state={phase}>
        <button className="dolar-hit" type="button" onClick={() => setOpen(true)}>
          <span className="dolar-top">
            <i className="dolar-dot" aria-hidden="true" />
            <ImanagerIcon name="dolar" size={16} />
            <b>Dólar blue</b>
          </span>
          <span className="dolar-cols">
            <span><small>Compra</small>{phase === 'loading' ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.buy) : '—'}</b>}</span>
            <span><small>Venta</small>{phase === 'loading' ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.sell) : '—'}</b>}</span>
          </span>
          {phase !== 'error' ? (
            <span className="dolar-foot">{phase === 'loading' ? 'Actualizando...' : `Act. ${clock} · ${label}`}</span>
          ) : null}
        </button>
        <button
          className="dolar-refresh"
          type="button"
          aria-label="Actualizar cotización"
          data-testid="blue-refresh"
          disabled={phase === 'loading'}
          onClick={() => { void load(source, 'visible'); }}
        >
          <RefreshCw size={15} />
        </button>
        {phase === 'error' ? (
          <p className="dolar-foot" onClick={() => setOpen(true)}>
            {clock ? `No pudimos actualizar. Mostramos el dato de las ${clock} · ` : 'No pudimos actualizar. '}
            <button type="button" data-testid="blue-retry" onClick={(event) => { event.stopPropagation(); void load(source, 'visible'); }}>Reintentar</button>
          </p>
        ) : null}
      </div>
      {open ? (
        <div className="ov" data-testid="blue-overlay" onMouseDown={() => setOpen(false)}>
          <div
            className="sheet dolar-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dolar-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dolar-head">
              <h3 id="dolar-title">Dólar blue</h3>
              <button className="dolar-x" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="dolar-stats">
              <div className="dolar-stat"><span>Compra</span>{phase === 'loading' && !quote ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.buy) : '—'}</b>}</div>
              <div className="dolar-stat"><span>Venta</span>{phase === 'loading' && !quote ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.sell) : '—'}</b>}</div>
              <div className="dolar-stat"><span>Vs. ayer</span><b className={deltaView.tone === 'flat' ? undefined : deltaView.tone}>{deltaView.text}</b></div>
            </div>
            {quote ? (
              <>
                <p className="dolar-meta">Actualizado a las {clock} · se refresca cada {BLUE_REFRESH_LABEL}</p>
                <p className="dolar-meta">Fuente: {label} (cotización blue).</p>
              </>
            ) : (
              <p className="dolar-meta">Se refresca cada {BLUE_REFRESH_LABEL}.</p>
            )}
            <div className="dolar-kicker">Calculadora rápida</div>
            <div className="dolar-calc">
              <label className="dolar-usd">
                <span>US$</span>
                <input
                  aria-label="Dólares"
                  data-testid="blue-usd"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={usd}
                  onChange={(event) => setUsd(event.target.value.replace(/\D/g, '').slice(0, 7))}
                />
              </label>
              <span className="dolar-eq">=</span>
              <b className="dolar-out" data-testid="blue-result">{formatMoney(pesos)}</b>
              <button className="dolar-side" type="button" data-testid="blue-rate-side" onClick={() => setSide((current) => current === 'sell' ? 'buy' : 'sell')}>
                {side === 'sell' ? 'al precio de venta' : 'al precio de compra'}
              </button>
            </div>
            <div className="dolar-kicker">Fuente de la cotización</div>
            <div className="sgs" role="group" aria-label="Fuente de la cotización">
              {BLUE_SOURCES.map((item) => (
                <button
                  key={item.id}
                  className={`sg${item.id === source ? ' on' : ''}`}
                  type="button"
                  aria-pressed={item.id === source}
                  data-testid={`blue-source-${item.id}`}
                  onClick={() => choose(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="dolar-acts">
              <button className="btn2 s" type="button" data-testid="blue-refresh-now" disabled={phase === 'loading'} onClick={() => { void load(source, 'visible'); }}>
                <RefreshCw size={16} /> Actualizar ahora
              </button>
              <button className="btn2 p" type="button" data-testid="blue-done" onClick={() => setOpen(false)}>Listo</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
