import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Check, CreditCard } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { BillingQuote } from '../../types/billing';
import { toUserMessage } from '../../lib/user-message';
import { redirectToMercadoPago } from '../../services/mercadopago-url';
import { BILLING_RETURN_CONFIRMING_MS, BILLING_RETURN_POLL_MS, BILLING_RETURN_WINDOW_MS, billingPathFromLocation, billingReturnStep, isBillingReturn } from '../billing-return';
import { PageHead, useDesk } from '../ui';
import { usePhoneLayout } from '../section-notices';
import type { BillingDetails } from '../../types/billing';
import './billing.css';

export const billingPlanName = (plan?: string) => ({ INTERNAL: 'Interno', TRIAL: 'Prueba gratuita · Plan Básico', BASIC: 'Básico', BUSINESS: 'Negocio' }[plan ?? ''] ?? 'Tu plan');
const statusName = (status?: string) => ({ ACTIVE: 'Activa', TRIAL: 'En prueba', EXPIRED: 'Vencida', CANCELLED: 'Cancelada' }[status ?? ''] ?? '');
const ars = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(amount);
const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

let sharedReturnRefresh: { key: string; promise: Promise<BillingDetails | undefined> } | null = null;

/** One return refresh per store. A remount or StrictMode replay must not start a second one. */
function shareReturnRefresh(key: string, load: () => Promise<BillingDetails | undefined>) {
  if (sharedReturnRefresh?.key !== key) {
    const promise = load().finally(() => {
      if (sharedReturnRefresh?.promise === promise) sharedReturnRefresh = null;
    });
    sharedReturnRefresh = { key, promise };
  }
  return sharedReturnRefresh.promise;
}

export function BillingScreen() {
  const { appSession, billingDetails, loadBilling, quoteSubscription, openSubscriptionCheckout, cancelSubscription, reloadSession } = useAppContext();
  const { go } = useDesk();
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState(appSession?.user.email ?? '');
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(() => isBillingReturn(window.location.hash, window.location.search));
  const [paymentPending, setPaymentPending] = useState(false);
  const [returnAttempt, setReturnAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const returningRef = useRef(confirming);
  const reloadSessionRef = useRef(reloadSession);
  reloadSessionRef.current = reloadSession;
  const busyRef = useRef(false);
  const phone = usePhoneLayout();
  const storeId = appSession?.store?.id;
  useEffect(() => {
    alive.current = true;
    const returning = returningRef.current;
    const started = Date.now();
    let timer = 0;
    let stopped = false;
    setLoading(true); setQuote(null); setCheckoutError(''); setError(''); setPaymentPending(false);
    setConfirming(returning);
    const finish = (apply: () => void) => {
      if (!alive.current || stopped) return;
      const wait = returning ? Math.max(0, BILLING_RETURN_CONFIRMING_MS - (Date.now() - started)) : 0;
      const run = () => {
        if (!alive.current || stopped) return;
        apply();
      };
      if (wait === 0) run();
      else timer = window.setTimeout(run, wait);
    };
    const settle = (path: string, apply: () => void = () => undefined) => {
      finish(() => {
        history.replaceState(null, '', path);
        setConfirming(false);
        setLoading(false);
        apply();
      });
    };
    const tick = async () => {
      if (stopped || !alive.current) return;
      let details: BillingDetails | undefined;
      try { details = await (returning ? shareReturnRefresh(`${storeId ?? ''}:${returnAttempt}`, () => loadBilling(true)) : loadBilling(true)); }
      catch (cause) {
        if (!alive.current || stopped) return;
        if (returning && Date.now() - started < BILLING_RETURN_WINDOW_MS) {
          timer = window.setTimeout(() => void tick(), BILLING_RETURN_POLL_MS);
          return;
        }
        finish(() => {
          setConfirming(false); setLoading(false);
          if (returning) { setPaymentPending(true); history.replaceState(null, '', billingPathFromLocation(window.location.href)); }
          else setError(toUserMessage(cause));
        });
        return;
      }
      if (!alive.current || stopped) return;
      if (!returning) { setLoading(false); return; }
      const step = billingReturnStep(details, Date.now() - started);
      if (step === 'success') {
        settle(billingPathFromLocation(window.location.href), () => {
          setNotice(`Listo. Tu plan ${billingPlanName(details?.plan)} ya está activo.`);
          void reloadSessionRef.current();
        });
        return;
      }
      if (step === 'confirming') {
        setConfirming(true); setLoading(false);
        timer = window.setTimeout(() => void tick(), BILLING_RETURN_POLL_MS);
        return;
      }
      if (step === 'pending') {
        settle(billingPathFromLocation(window.location.href), () => setPaymentPending(true));
        return;
      }
      settle(billingPathFromLocation(window.location.href));
    };
    void tick();
    return () => { stopped = true; alive.current = false; window.clearTimeout(timer); };
  }, [loadBilling, returnAttempt, storeId]);
  const billing = billingDetails ?? appSession?.billing;
  const internal = billing?.plan === 'INTERNAL';
  const subscribed = billing?.canCancel || (!!billing?.paidThrough && new Date(billing.paidThrough) > new Date());
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { if (alive.current) setError(toUserMessage(cause)); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const closeQuote = () => { if (busyRef.current) return; setQuote(null); setCheckoutError(''); };
  const continueCheckout = async () => {
    if (busyRef.current || !quote) return;
    busyRef.current = true;
    setBusy(true); setCheckoutError(''); setError(''); setNotice('');
    try {
      const result = await openSubscriptionCheckout(quote.id);
      redirectToMercadoPago(result.initPoint);
    } catch (cause) { if (alive.current) setCheckoutError(toUserMessage(cause)); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  if (appSession?.membership?.role !== 'OWNER') return <div className="dscreen"><p>Solo el propietario puede administrar Plan y facturación.</p></div>;
  return (
    <div className="dscreen billing-screen" data-testid="billing-screen">
      <PageHead title="Plan y facturación" subtitle="Tu suscripción a iManager" back={() => go('settings')} />
      <div className="billing-content">
        <section className="billing-current" aria-label="Plan actual">
          <div className="billing-heading"><CreditCard size={22} /><h2>{billingPlanName(billing?.plan)}</h2><span className="billing-status">{internal ? 'Acceso ilimitado' : statusName(billing?.status)}</span></div>
          {internal ? <p>Tu cuenta tiene acceso ilimitado, sin cobros ni límite de usuarios.</p> : <>
            <p>{billing?.readOnly ? 'Tu tienda está en modo solo lectura. Tus datos siguen disponibles.' : 'Tu tienda está lista para operar.'}</p>
            {billing?.trialDaysLeft ? <p>Te {billing.trialDaysLeft === 1 ? 'queda 1 día' : `quedan ${billing.trialDaysLeft} días`} de prueba sin tarjeta.</p> : null}
            {billing?.paidThrough ? <p>{billing.status === 'CANCELLED' ? 'Acceso abonado hasta' : 'Período abonado hasta'} el {date(billing.paidThrough)}.</p> : null}
            <p>{billing?.members ?? 0} de {billing?.memberLimit ?? 5} {billing?.memberLimit === 1 ? 'usuario' : 'usuarios'} · Incluye al propietario</p>
            {billing?.readOnly && billing.canCancel && !billing.overLimit ? <p>Si ya pagaste, actualizá el estado. También podés cancelar esta suscripción para elegir un nuevo plan.</p> : null}
            {billing?.overLimit ? <p role="alert">Tu equipo supera el límite del plan. Quitá miembros desde Configuración para volver a operar.</p> : null}
          </>}
          {!internal ? <button className="billing-link" type="button" disabled={busy || loading} onClick={() => void run(async () => { await loadBilling(true, true); await reloadSession(); setNotice('Estado actualizado desde Mercado Pago.'); })}>Actualizar estado del pago</button> : null}
        </section>
        {confirming ? <p className="billing-return" role="status" data-testid="billing-return-confirming">Confirmando tu pago…</p> : null}
        {paymentPending ? <div className="billing-return" role="status" data-testid="billing-return-pending"><p>Tu pago todavía está pendiente. Si ya lo completaste en Mercado Pago, podés volver a consultar.</p><button className="billing-primary" type="button" disabled={busy} onClick={() => void run(async () => {
          const details = await loadBilling(true, true);
          await reloadSession();
          if (details?.recentlyActivated) setNotice(`Listo. Tu plan ${billingPlanName(details.plan)} ya está activo.`);
          if (!details?.pendingCheckout) setPaymentPending(false);
        })}>Reintentar</button></div> : null}
        {error ? <div className="billing-error" role="alert">{error}<button className="billing-link" type="button" disabled={busy} onClick={() => void run(async () => { await loadBilling(true, true); setLoading(false); })}>Reintentar</button></div> : null}
        {notice ? <p className="billing-notice" role="status">{notice}</p> : null}
        {loading && !confirming ? <p role="status">Cargando planes…</p> : null}
        {!internal && !subscribed ? <>
          <div className="billing-intro"><h2>Elegí cómo seguir</h2><p>Precios en USD. Pagás el equivalente en pesos argentinos con Mercado Pago.</p></div>
          <div className="billing-period" role="group" aria-label="Frecuencia de facturación">
            <button type="button" aria-pressed={!annual} disabled={busy} onClick={() => { setAnnual(false); closeQuote(); }}>Mensual</button>
            <button type="button" aria-pressed={annual} disabled={busy} onClick={() => { setAnnual(true); closeQuote(); }}>Anual · Ahorrás 25%</button>
          </div>
          <label className="billing-email">Email del pagador<input type="email" autoComplete="email" value={email} disabled={busy} onChange={event => { setEmail(event.target.value); closeQuote(); }} /><small>Recibirás las novedades de tu suscripción en este email.</small></label>
          <div className="billing-plans">
            {(billingDetails?.plans ?? []).filter(plan => plan.period === (annual ? 'ANNUAL' : 'MONTHLY')).map(plan => <section className="billing-plan" key={plan.key}>
              <h3>{plan.name}</h3><p className="billing-price">US$ {new Intl.NumberFormat('es-AR', { minimumFractionDigits: annual ? 2 : 0, maximumFractionDigits: 2 }).format(plan.usd / plan.months)}<span>/mes</span></p>
              <p>{annual ? `US$ ${plan.usd} por año, en un solo cobro` : 'Cobro mensual'}</p>
              <p className="billing-feature"><Check size={17} />{`Hasta ${plan.users} usuarios`}</p>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="billing-primary" type="button" disabled={busy || !email.trim() || (billing?.members ?? 0) > plan.users} onClick={() => void run(async () => { setCheckoutError(''); setQuote(await quoteSubscription(plan.key, email)); })}>Suscribirme a {plan.name}</motion.button>
              {(billing?.members ?? 0) > plan.users ? <small>Primero reducí tu equipo a {plan.users} usuarios.</small> : null}
            </section>)}
            <section className="billing-plan billing-custom"><h3>Sistema propio</h3><p className="billing-price">A medida</p><p>Una solución para las necesidades de tu negocio.</p><p>Contactá a iManager para definir el alcance y el precio.</p></section>
          </div>
          {quote ? createPortal(<ConfirmCheckout quote={quote} busy={busy} error={checkoutError} phone={phone} onClose={closeQuote} onContinue={() => void continueCheckout()} />, document.body) : null}
        </> : null}
        {!internal && billing?.canCancel ? <section className="billing-current">
          <h2>Cancelar suscripción</h2><p>Se detienen los próximos cobros y conservás el acceso hasta el fin del período abonado.</p>
          {cancelConfirm ? <div className="billing-cancel" role="group" aria-label="Confirmar cancelación"><p>¿Querés cancelar los próximos cobros?</p><button type="button" className="billing-danger" disabled={busy} onClick={() => void run(async () => { await cancelSubscription(); await loadBilling(); await reloadSession(); setCancelConfirm(false); setNotice('Suscripción cancelada. No se harán nuevos cobros.'); })}>Sí, cancelar suscripción</button><button className="billing-link" type="button" disabled={busy} onClick={() => setCancelConfirm(false)}>Conservar suscripción</button></div> : <button className="billing-danger" type="button" disabled={busy} onClick={() => setCancelConfirm(true)}>Cancelar suscripción</button>}
        </section> : null}
      </div>
    </div>
  );
}

function ConfirmCheckout({ quote, busy, error, phone, onClose, onContinue }: {
  quote: BillingQuote;
  busy: boolean;
  error: string;
  phone: boolean;
  onClose: () => void;
  onContinue: () => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyState = useRef(busy);
  const backdropPressed = useRef(false);
  const closing = useRef(false);
  closeRef.current = onClose;
  busyState.current = busy;
  useEffect(() => {
    const root = panel.current;
    if (!root) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = [...document.body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && !node.contains(root));
    const previous = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.focus({ preventScroll: true });
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (busyState.current) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      const target = items.length ? items : [root];
      const index = target.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      target[(index + (event.shiftKey ? -1 : 1) + target.length) % target.length]?.focus();
    };
    const contain = (event: FocusEvent) => {
      if (!root.contains(event.target as Node)) (root.querySelector<HTMLElement>('button:not(:disabled)') ?? root).focus();
    };
    document.addEventListener('keydown', keys, true);
    document.addEventListener('focusin', contain);
    return () => {
      document.removeEventListener('keydown', keys, true);
      document.removeEventListener('focusin', contain);
      background.forEach((node, index) => { node.inert = previous[index] ?? false; });
      document.body.style.overflow = overflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => { if (error) alertRef.current?.focus(); }, [error]);
  const dismiss = (event: ReactMouseEvent | ReactPointerEvent) => {
    if (closing.current || busyState.current || event.target !== event.currentTarget) return;
    if ('button' in event && event.button > 0) return;
    closing.current = true;
    event.preventDefault();
    event.stopPropagation();
    let sameGesture = true;
    const disarm = () => { sameGesture = false; };
    const swallow = (click: Event) => {
      document.removeEventListener('click', swallow, true);
      document.removeEventListener('pointerdown', disarm, true);
      if (!sameGesture) return;
      click.preventDefault();
      click.stopPropagation();
    };
    document.addEventListener('pointerdown', disarm, true);
    document.addEventListener('click', swallow, true);
    window.setTimeout(() => {
      document.removeEventListener('click', swallow, true);
      document.removeEventListener('pointerdown', disarm, true);
    }, 400);
    closeRef.current();
  };
  const layout = phone ? 'sheet' : 'dialog';
  return (
    <div className="billing-modal-backdrop" data-layout={layout} data-testid="billing-modal-backdrop" onMouseDown={dismiss}
      onPointerDown={(event) => { backdropPressed.current = event.target === event.currentTarget; }}
      onPointerUp={(event) => { if (backdropPressed.current && event.target === event.currentTarget) dismiss(event); backdropPressed.current = false; }}
      onPointerCancel={() => { backdropPressed.current = false; }}>
      <div ref={panel} className="billing-modal" data-layout={layout} data-testid="billing-quote" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
        {phone ? <div className="billing-modal-grab" aria-hidden="true" /> : null}
        <h2 id={titleId}>Antes de suscribirte</h2>
        <p>Se va a cobrar <strong>{ars(quote.amountArs)} ARS</strong> {quote.key.endsWith('ANNUAL') ? 'por año' : 'por mes'}.</p>
        <p>Equivale a US$ {quote.usd} · Dólar blue vendedor: {ars(quote.exchangeRate)}.</p>
        <p>Email del pagador: <strong>{quote.payerEmail}</strong></p>
        <p>El débito es automático. El importe en ARS se ajusta con la cotización. Podés cancelar los próximos cobros desde esta pantalla.</p>
        <p>El pago se completa en Mercado Pago. iManager no ve los datos de la tarjeta.</p>
        {error ? <div ref={alertRef} className="billing-error" role="alert" tabIndex={-1}>{error}</div> : null}
        <div className="billing-modal-actions">
          <button className="billing-primary" type="button" disabled={busy} aria-busy={busy || undefined} onClick={onContinue}>{busy ? 'Abriendo Mercado Pago…' : 'Continuar en Mercado Pago'}</button>
          <button className="billing-link" type="button" disabled={busy} onClick={onClose}>Volver a elegir</button>
        </div>
      </div>
    </div>
  );
}

export function BillingAccessBanner({ dashboard = false }: { dashboard?: boolean }) {
  const { appSession } = useAppContext();
  const { go } = useDesk();
  const billing = appSession?.billing;
  if (!billing || billing.plan === 'INTERNAL' || (!billing.readOnly && (!dashboard || !billing.trialDaysLeft))) return null;
  const owner = appSession.membership?.role === 'OWNER';
  return <div className={`billing-access ${billing.readOnly ? 'billing-access-expired' : ''}`} role="status" data-testid="billing-access-banner"><div><strong>{billing.readOnly ? 'Modo solo lectura' : `Prueba gratuita · ${billing.trialDaysLeft} ${billing.trialDaysLeft === 1 ? 'día restante' : 'días restantes'}`}</strong><p>{billing.readOnly ? (billing.overLimit ? 'El equipo supera el límite del plan.' : 'Elegí un plan para seguir operando. Tus datos están disponibles.') : 'Probá iManager durante 7 días, sin tarjeta.'}{!owner && billing.readOnly ? ' Contactá al propietario.' : ''}</p></div>{owner ? <button className="billing-primary" type="button" onClick={() => go('billing')}>Ver planes</button> : null}</div>;
}
