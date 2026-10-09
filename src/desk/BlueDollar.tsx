import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { formatMoney } from './format';
import { ImanagerIcon } from './icons';
import { BLUE_REFRESH_LABEL, convertUsd, exchangeHouseLabel, formatClock } from './blue-rate';
import { useExchange, type QuoteView } from './exchange';

function deltaParts(delta: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta == null) return { text: '—', tone: 'flat' };
  if (delta > 0) return { text: `▲ ${formatMoney(delta)}`, tone: 'up' };
  if (delta < 0) return { text: `▼ ${formatMoney(Math.abs(delta))}`, tone: 'down' };
  return { text: formatMoney(0), tone: 'flat' };
}

function SheetMeta({
  compact,
  phase,
  quote,
  manual,
  clock,
  sourceLine,
}: {
  compact: boolean;
  phase: 'ready' | 'loading' | 'error';
  quote: QuoteView | null;
  manual: boolean;
  clock: string;
  sourceLine: string;
}) {
  if (!compact) {
    if (quote && !manual) {
      return (
        <>
          <p className="dolar-meta">Actualizado a las {clock} · se refresca cada {BLUE_REFRESH_LABEL}</p>
          <p className="dolar-meta">{sourceLine}</p>
        </>
      );
    }
    return <p className="dolar-meta">{manual ? sourceLine : `Se refresca cada ${BLUE_REFRESH_LABEL}.`}</p>;
  }
  if (phase === 'loading') return <p className="dolar-meta" data-testid="blue-status">Actualizando la cotización…</p>;
  if (phase === 'error' && !quote) {
    return <p className="dolar-alert" data-testid="blue-alert">{manual ? 'Cargá la cotización en Configuración.' : 'No hay cotización. Reintentá en un rato.'}</p>;
  }
  if (phase === 'error' && quote) {
    return (
      <>
        <p className="dolar-alert" data-testid="blue-alert">No pudimos actualizar. Mostramos el dato de las {clock || 'la última vez'}.</p>
        {manual ? null : <p className="dolar-meta">{sourceLine}</p>}
      </>
    );
  }
  if (manual) return <p className="dolar-meta">{sourceLine}</p>;
  return (
    <>
      <p className="dolar-meta">Actualizado a las {clock} · se refresca cada {BLUE_REFRESH_LABEL}</p>
      <p className="dolar-meta">{sourceLine}</p>
    </>
  );
}

export function BlueDollar({ variant = 'full' }: { variant?: 'full' | 'chip' } = {}) {
  const exchange = useExchange();
  const { phase, quote, delta, title, refresh, settings } = exchange;
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'sell' | 'buy'>('sell');
  const [usd, setUsd] = useState('');
  const manual = settings.exchangeMode === 'manual';
  const compact = variant === 'chip';

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const clock = quote?.updatedAt ? formatClock(quote.updatedAt) : '';
  const deltaView = deltaParts(delta);
  const rate = quote ? (side === 'sell' ? quote.sell : quote.buy) : 0;
  const pesos = quote ? convertUsd(Number(usd || 0), rate) : 0;
  const sourceLine = manual
    ? 'Cotización cargada por la tienda.'
    : `Fuente: DolarApi (cotización ${settings.exchangeSource === 'mep' ? 'MEP' : settings.exchangeSource}).`;
  const house = manual ? 'Dólar' : exchangeHouseLabel(settings.exchangeSource);
  const skeletonStat = phase === 'loading' && (compact || !quote);

  const detail = open ? (
        <div className="ov dolar-ov" data-testid="blue-overlay" onMouseDown={() => setOpen(false)}>
          <div
            className={`sheet dolar-sheet${compact ? ' dolar-phone' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dolar-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-grab" aria-hidden="true" />
            <div className="sheet-scroll">
              <div className="dolar-head">
                <h3 id="dolar-title">{title}</h3>
                {compact ? <span className="dolar-badge" data-testid="blue-mode">{manual ? 'Manual' : 'Automática'}</span> : null}
                <button className="dolar-x" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
              </div>
              <div className="dolar-stats">
                <div className="dolar-stat"><span>Compra</span>{skeletonStat ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.buy) : '—'}</b>}</div>
                <div className="dolar-stat"><span>Venta</span>{skeletonStat ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.sell) : '—'}</b>}</div>
                <div className="dolar-stat"><span>Vs. ayer</span>{skeletonStat ? <i className="dolar-skel" /> : <b className={deltaView.tone === 'flat' ? undefined : deltaView.tone}>{deltaView.text}</b>}</div>
              </div>
              <SheetMeta compact={compact} phase={phase} quote={quote} manual={manual} clock={clock} sourceLine={sourceLine} />
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
                <b className="dolar-out" data-testid="blue-result">{quote ? formatMoney(pesos) : '—'}</b>
                <button className="dolar-side" type="button" data-testid="blue-rate-side" onClick={() => setSide((current) => current === 'sell' ? 'buy' : 'sell')}>
                  {side === 'sell' ? 'al precio de venta' : 'al precio de compra'}
                </button>
              </div>
            </div>
            <div className="sheet-foot">
              {manual ? (
                <div className="dolar-acts">
                  <button className="btn2 p" type="button" data-testid="blue-done" onClick={() => setOpen(false)}>Listo</button>
                </div>
              ) : (
                <div className="dolar-acts">
                  <button className="btn2 s" type="button" data-testid="blue-refresh-now" disabled={phase === 'loading'} onClick={() => refresh()}>
                    <RefreshCw size={16} /> {compact ? 'Actualizar' : 'Actualizar ahora'}
                  </button>
                  <button className="btn2 p" type="button" data-testid="blue-done" onClick={() => setOpen(false)}>Listo</button>
                </div>
              )}
            </div>
          </div>
        </div>
  ) : null;

  if (variant === 'chip') {
    const notice = !manual && phase === 'error'
      ? (quote
        ? `No pudimos actualizar el dólar. Mostramos el de las ${clock || 'la última vez'}.`
        : 'No pudimos actualizar el dólar.')
      : '';
    return (
      <>
        <div className={`dolar chip ${phase}`} data-testid="blue-widget" data-state={phase} data-variant="chip" data-mode={manual ? 'manual' : 'auto'} data-quote={quote ? (phase === 'error' ? 'stale' : 'live') : 'none'}>
          <button className="dolar-hit" type="button" aria-label={title} onClick={() => setOpen(true)}>
            {phase === 'error' ? <AlertTriangle size={14} aria-hidden="true" /> : <i className="dolar-dot" aria-hidden="true" />}
            <b className="dolar-chip-name">{house}</b>
            {phase === 'loading' ? (
              <>
                <i className="dolar-skel" />
                <span className="dolar-chip-bar" aria-hidden="true" />
                <i className="dolar-skel" />
              </>
            ) : phase === 'error' && !quote ? (
              <>
                <span className="dolar-chip-sep" aria-hidden="true">·</span>
                <span className="dolar-chip-miss">sin dato</span>
              </>
            ) : phase === 'error' && quote ? (
              <>
                <span className="dolar-chip-px">{formatMoney(quote.sell)}</span>
                {clock ? <><span className="dolar-chip-sep" aria-hidden="true">·</span><span className="dolar-chip-when">{clock}</span></> : null}
              </>
            ) : (
              <>
                <span className="dolar-chip-px">{quote ? formatMoney(quote.buy) : '—'}</span>
                <span className="dolar-chip-bar" aria-hidden="true" />
                <span className="dolar-chip-px">{quote ? formatMoney(quote.sell) : '—'}</span>
              </>
            )}
            {phase === 'error' && !manual ? null : <span className="dolar-chip-go" aria-hidden="true">›</span>}
          </button>
          {phase === 'error' && !manual ? (
            <button className="dolar-retry" type="button" data-testid="blue-retry" onClick={() => refresh()}>Reintentar</button>
          ) : null}
        </div>
        {notice ? (
          <div className="dolar-toast" data-testid="blue-toast" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{notice}</span>
            <button type="button" onClick={() => refresh()}>Reintentar</button>
          </div>
        ) : null}
        {detail}
      </>
    );
  }

  return (
    <>
      <div className={`dolar ${phase}`} data-testid="blue-widget" data-state={phase}>
        <button className="dolar-hit" type="button" onClick={() => setOpen(true)}>
          <span className="dolar-top">
            <i className="dolar-dot" aria-hidden="true" />
            <ImanagerIcon name="dolar" size={16} />
            <b>{title}</b>
          </span>
          <span className="dolar-cols">
            <span><small>Compra</small>{phase === 'loading' ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.buy) : '—'}</b>}</span>
            <span><small>Venta</small>{phase === 'loading' ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.sell) : '—'}</b>}</span>
          </span>
          {phase !== 'error' ? (
            <span className="dolar-foot">{phase === 'loading' ? 'Actualizando...' : manual ? 'Cotización de la tienda' : `Act. ${clock} · DolarApi`}</span>
          ) : null}
        </button>
        {manual ? null : (
          <button
            className="dolar-refresh"
            type="button"
            aria-label="Actualizar cotización"
            data-testid="blue-refresh"
            disabled={phase === 'loading'}
            onClick={() => refresh()}
          >
            <RefreshCw size={15} />
          </button>
        )}
        {phase === 'error' ? (
          <p className="dolar-foot" onClick={() => setOpen(true)}>
            {manual
              ? 'Cargá la cotización en Configuración. '
              : clock ? `No pudimos actualizar. Mostramos el dato de las ${clock} · ` : 'No pudimos actualizar. '}
            {manual ? null : (
              <button type="button" data-testid="blue-retry" onClick={(event) => { event.stopPropagation(); refresh(); }}>Reintentar</button>
            )}
          </p>
        ) : null}
      </div>
      {detail}
    </>
  );
}
