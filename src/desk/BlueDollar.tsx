import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { formatMoney } from './format';
import { ImanagerIcon } from './icons';
import { BLUE_REFRESH_LABEL, convertUsd, formatClock } from './blue-rate';
import { useExchange } from './exchange';

function deltaParts(delta: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta == null) return { text: '—', tone: 'flat' };
  if (delta > 0) return { text: `▲ ${formatMoney(delta)}`, tone: 'up' };
  if (delta < 0) return { text: `▼ ${formatMoney(Math.abs(delta))}`, tone: 'down' };
  return { text: formatMoney(0), tone: 'flat' };
}

export function BlueDollar() {
  const exchange = useExchange();
  const { phase, quote, delta, title, refresh, settings } = exchange;
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<'sell' | 'buy'>('sell');
  const [usd, setUsd] = useState('');
  const manual = settings.exchangeMode === 'manual';

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
              <h3 id="dolar-title">{title}</h3>
              <button className="dolar-x" type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="dolar-stats">
              <div className="dolar-stat"><span>Compra</span>{phase === 'loading' && !quote ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.buy) : '—'}</b>}</div>
              <div className="dolar-stat"><span>Venta</span>{phase === 'loading' && !quote ? <i className="dolar-skel" /> : <b>{quote ? formatMoney(quote.sell) : '—'}</b>}</div>
              <div className="dolar-stat"><span>Vs. ayer</span><b className={deltaView.tone === 'flat' ? undefined : deltaView.tone}>{deltaView.text}</b></div>
            </div>
            {quote && !manual ? (
              <>
                <p className="dolar-meta">Actualizado a las {clock} · se refresca cada {BLUE_REFRESH_LABEL}</p>
                <p className="dolar-meta">{sourceLine}</p>
              </>
            ) : (
              <p className="dolar-meta">{manual ? sourceLine : `Se refresca cada ${BLUE_REFRESH_LABEL}.`}</p>
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
              <b className="dolar-out" data-testid="blue-result">{quote ? formatMoney(pesos) : '—'}</b>
              <button className="dolar-side" type="button" data-testid="blue-rate-side" onClick={() => setSide((current) => current === 'sell' ? 'buy' : 'sell')}>
                {side === 'sell' ? 'al precio de venta' : 'al precio de compra'}
              </button>
            </div>
            {manual ? null : (
              <div className="dolar-acts">
                <button className="btn2 s" type="button" data-testid="blue-refresh-now" disabled={phase === 'loading'} onClick={() => refresh()}>
                  <RefreshCw size={16} /> Actualizar ahora
                </button>
                <button className="btn2 p" type="button" data-testid="blue-done" onClick={() => setOpen(false)}>Listo</button>
              </div>
            )}
            {manual ? (
              <div className="dolar-acts">
                <button className="btn2 p" type="button" data-testid="blue-done" onClick={() => setOpen(false)}>Listo</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
