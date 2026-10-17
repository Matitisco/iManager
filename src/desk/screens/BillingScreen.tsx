import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Lock, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { BillingPlanOffer, BillingQuote } from '../../types/billing';
import { toUserMessage } from '../../lib/user-message';
import { redirectToMercadoPago } from '../../services/mercadopago-url';
import { BILLING_RETURN_CONFIRMING_MS, BILLING_RETURN_POLL_MS, BILLING_RETURN_WINDOW_MS, billingPathFromLocation, billingReturnStep, isBillingReturn } from '../billing-return';
import { PageHead, useDesk } from '../ui';
import { usePhoneLayout } from '../section-notices';
import type { BillingDetails } from '../../types/billing';
import './billing.css';

const ZONE = 'America/Argentina/Buenos_Aires';
const TRIAL_MS = 7 * 86_400_000;
export const billingPlanName = (plan?: string) => ({ INTERNAL: 'Interno', TRIAL: 'Prueba gratuita · Plan Básico', BASIC: 'Básico', BUSINESS: 'Negocio' }[plan ?? ''] ?? 'Tu plan');
const periodName = (period?: string | null) => period === 'ANNUAL' ? 'anual' : 'mensual';
const ars = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
const usd = (amount: number) => `US$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)}`;
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: ZONE }).replace(/\./g, '');
const dayOnly = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', timeZone: ZONE });
const fullDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: ZONE }).replace(/\./g, '');
function plusMonths(iso: string, months: number) {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}
const laterLabel = (iso: string, months: number) => months >= 12 ? `Renueva ${dayMonth(plusMonths(iso, months))}` : `Luego el ${dayOnly(iso)} de cada mes`;
const afterLabel = (iso: string, months: number) => months >= 12 ? dayMonth(plusMonths(iso, months)) : `El ${dayOnly(iso)} de cada mes`;
const futureDate = (iso?: string | null) => !!iso && new Date(iso).getTime() > Date.now();
function accessUntil(trialEndsAt?: string | null, paidThrough?: string | null) {
  if (futureDate(trialEndsAt)) return trialEndsAt ?? null;
  if (futureDate(paidThrough)) return paidThrough ?? null;
  return trialEndsAt ?? paidThrough ?? null;
}

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
  const [tier, setTier] = useState<'BASIC' | 'BUSINESS'>('BASIC');
  const [email, setEmail] = useState(appSession?.user.email ?? '');
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [notice, setNotice] = useState('');
  const [incompleteError, setIncompleteError] = useState('');
  const [confirming, setConfirming] = useState(() => isBillingReturn(window.location.hash, window.location.search));
  const [paymentPending, setPaymentPending] = useState(false);
  const [returnAttempt] = useState(0);
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
    setLoading(true); setQuote(null); setCheckoutError(''); setError(''); setIncompleteError(''); setPaymentPending(false);
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
  const paidUp = !!billing?.paidThrough && new Date(billing.paidThrough) > new Date();
  const scheduled = !!billing?.firstChargeAt;
  const active = !internal && !scheduled && (paidUp || !!billing?.canCancel);
  const openPending = !confirming && !billingDetails?.recentlyActivated && (paymentPending || !!billingDetails?.pendingCheckout);
  const failedAttempt = !openPending ? billingDetails?.paymentAttempt ?? null : null;
  const incomplete = !confirming && !internal && !active && !scheduled && !billingDetails?.recentlyActivated && (openPending || !!failedAttempt);
  const expired = !internal && !active && !scheduled && !incomplete && billing?.status === 'EXPIRED';
  const plans = (billingDetails?.plans ?? []).filter(plan => plan.period === (annual ? 'ANNUAL' : 'MONTHLY'));
  const selected = plans.find(plan => plan.plan === tier) ?? plans[0];
  const members = billing?.members ?? 0;
  const chargeAt = (billing?.trialDaysLeft ?? 0) > 0 ? billing?.trialEndsAt ?? null : null;
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
  const openQuote = (plan: BillingPlanOffer) => void run(async () => {
    setCheckoutError('');
    setQuote(await quoteSubscription(plan.key, email));
  });
  const retryCheckout = async () => {
    if (busyRef.current) return;
    const plan = failedAttempt?.plan ?? billingDetails?.pendingPlan ?? selected;
    const payer = (failedAttempt?.payerEmail || billingDetails?.pendingPayerEmail || email).trim();
    if (!plan || !payer) return;
    busyRef.current = true;
    setBusy(true); setIncompleteError(''); setError(''); setNotice('');
    try {
      const quoted = await quoteSubscription(plan.key, payer);
      if (!alive.current) return;
      setEmail(payer);
      const result = await openSubscriptionCheckout(quoted.id);
      redirectToMercadoPago(result.initPoint);
    } catch (cause) {
      if (!alive.current) return;
      const message = toUserMessage(cause);
      if (/ya tenés una suscripción/i.test(message)) {
        const details = await loadBilling(true);
        await reloadSession();
        if (alive.current && (details?.recentlyActivated || details?.canCancel)) setNotice(`Listo. Tu plan ${billingPlanName(details.plan)} ya está activo.`);
        else if (alive.current) setIncompleteError(message);
        return;
      }
      setIncompleteError(message);
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const refreshPayment = async () => {
    const details = await loadBilling(true, true);
    await reloadSession();
    if (details?.recentlyActivated) setNotice(`Listo. Tu plan ${billingPlanName(details.plan)} ya está activo.`);
    if (!details?.pendingCheckout) setPaymentPending(false);
    return details;
  };
  if (appSession?.membership?.role !== 'OWNER') return <div className="dscreen"><p>Solo el propietario puede administrar Plan y facturación.</p></div>;
  const trialEnd = billing?.trialEndsAt;
  const elapsed = trialEnd ? Math.min(TRIAL_MS, Math.max(0, Date.now() - (new Date(trialEnd).getTime() - TRIAL_MS))) : 0;
  const currentOffer = (billingDetails?.plans ?? []).find(plan => plan.plan === billing?.plan && plan.period === (billing?.period === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY'));
  const other = active && billing?.canCancel ? (billingDetails?.plans ?? []).find(plan => plan.plan !== billing.plan && plan.period === (billing.period === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY')) : undefined;
  return (
    <div className="dscreen billing-screen" data-testid="billing-screen">
      <PageHead title="Plan y facturación" back={() => go('settings')} />
      <div className="billing-content">
        {internal ? <section className="billing-card"><div className="billing-card-top"><h2>Interno</h2><span className="billing-pill">Acceso ilimitado</span></div><p>Tu cuenta tiene acceso ilimitado, sin cobros ni límite de usuarios.</p></section> : null}
        {!internal && !incomplete && (scheduled || (!active && !incomplete)) ? <section className="billing-card" aria-label="Plan actual">
          <div className="billing-card-top"><h2>Prueba gratuita · Plan {billing?.plan === 'BUSINESS' ? 'Negocio' : 'Básico'}</h2><span className={`billing-pill${expired ? ' is-muted' : ''}`}>{expired ? 'Vencida' : 'En prueba'}</span></div>
          {expired ? <div className="billing-callout"><Lock size={18} /><div><strong>Tu prueba terminó el {trialEnd ? dayMonth(trialEnd) : ''}</strong><p>Tus datos están guardados. Podés verlos, pero no cargar nada nuevo hasta elegir un plan.</p></div></div> : <>
            <h3>Tu prueba termina el {trialEnd ? dayMonth(trialEnd) : ''}</h3>
            <p>{billing?.trialDaysLeft === 1 ? 'Queda 1 día' : `Quedan ${billing?.trialDaysLeft ?? 0} días`}. {scheduled ? 'El primer cobro es ese día.' : 'No te cobramos nada hasta que elijas un plan.'}</p>
            <div className="billing-bar" role="progressbar" aria-valuemin={0} aria-valuemax={7} aria-valuenow={Math.round(elapsed / 86_400_000)} aria-label="Días de prueba"><span style={{ width: `${(elapsed / TRIAL_MS) * 100}%` }} /></div>
            <div className="billing-bar-labels"><span>{trialEnd ? dayMonth(new Date(new Date(trialEnd).getTime() - TRIAL_MS).toISOString()) : ''}</span><span>{trialEnd ? dayMonth(trialEnd) : ''}</span></div>
          </>}
          <div className="billing-row"><span>Usuarios</span><b>{members} de {billing?.memberLimit ?? 3}</b></div>
          {scheduled ? <button className="billing-text-danger" type="button" disabled={busy} onClick={() => setCancelConfirm(true)}>Cancelar suscripción</button> : null}
        </section> : null}
        {incomplete ? <IncompletePayment busy={busy} error={incompleteError} rejected={!openPending && failedAttempt?.outcome === 'rejected'} planName={(failedAttempt?.plan ?? billingDetails?.pendingPlan)?.name ?? 'Básico'} period={periodName((failedAttempt?.plan ?? billingDetails?.pendingPlan)?.period)} accessUntil={accessUntil(billing?.trialEndsAt, billing?.paidThrough)} onRetry={() => void retryCheckout()} /> : null}
        {active ? <div className="billing-layout-active">
          <section className="billing-card" aria-label="Plan actual">
            <div className="billing-card-top"><p>Tu plan</p><span className="billing-pill is-ok">{billing?.status === 'CANCELLED' ? 'Cancelada' : 'Activa'}</span></div>
            <h3>{billingPlanName(billing?.plan)} · {periodName(billing?.period)}</h3>
            <p>Hasta {billing?.memberLimit ?? 3} usuarios</p>
            {billing?.paidThrough ? <div className="billing-row"><span>Próximo cobro</span><b>{dayMonth(billing.paidThrough)}{currentOffer ? ` · ${usd(currentOffer.usd)}` : ''}{currentOffer?.amountArs ? <small>≈ {ars(currentOffer.amountArs)}</small> : null}</b></div> : null}
            <div className="billing-row"><span>Medio de pago</span><b>Mercado Pago</b></div>
            <div className="billing-row"><span>Usuarios</span><b>{members} de {billing?.memberLimit ?? 3}</b></div>
            {other ? <button className="billing-secondary" type="button" disabled={busy} onClick={() => openQuote(other)}>Cambiar a {other.name}</button> : null}
            {billing?.canCancel ? (cancelConfirm ? <div className="billing-cancel" role="group" aria-label="Confirmar cancelación"><p>¿Querés cancelar los próximos cobros?</p><button type="button" className="billing-text-danger" disabled={busy} onClick={() => void run(async () => { await cancelSubscription(); await loadBilling(); await reloadSession(); setCancelConfirm(false); setNotice('Suscripción cancelada. No se harán nuevos cobros.'); })}>Sí, cancelar suscripción</button><button className="billing-link" type="button" disabled={busy} onClick={() => setCancelConfirm(false)}>Conservar suscripción</button></div> : <button className="billing-text-danger" type="button" disabled={busy} onClick={() => setCancelConfirm(true)}>Cancelar suscripción</button>) : null}
          </section>
          {billing?.paidThrough ? <section className="billing-card" aria-label="Cobros">
            <h2>Cobros</h2>
            <div className="billing-row"><span>{fullDate(plusMonths(billing.paidThrough, -(billing.period === 'ANNUAL' ? 12 : 1)))}</span><b>{currentOffer?.amountArs ? `${ars(currentOffer.amountArs)} · Pagado` : 'Pagado'}</b></div>
            <div className="billing-row"><span>Próximo · {dayMonth(billing.paidThrough)}</span><b>{currentOffer?.amountArs ? `≈ ${ars(currentOffer.amountArs)}` : ''}</b></div>
            <p className="billing-note">El monto en pesos se calcula con el dólar blue del día del cobro.</p>
          </section> : null}
        </div> : null}
        {confirming ? <p className="billing-return" role="status" data-testid="billing-return-confirming">Confirmando tu pago…</p> : null}
        {error ? <div className="billing-error" role="alert">{error}<button className="billing-link" type="button" disabled={busy} onClick={() => void run(async () => { await loadBilling(true, true); setLoading(false); })}>Reintentar</button></div> : null}
        {notice ? <p className="billing-notice" role="status">{notice}</p> : null}
        {loading && !confirming ? <p role="status">Cargando planes…</p> : null}
        {!internal && !active && !scheduled && !incomplete ? <>
          <h2 className="billing-choose">{expired ? 'Elegí un plan para seguir' : 'Elegí tu plan'}</h2>
          <div className="billing-period" role="group" aria-label="Frecuencia de facturación">
            <button type="button" aria-pressed={!annual} disabled={busy} onClick={() => { setAnnual(false); closeQuote(); }}>Mensual</button>
            <button type="button" aria-pressed={annual} disabled={busy} onClick={() => { setAnnual(true); closeQuote(); }}>Anual <span className="billing-save">-25%</span></button>
          </div>
          <div className="billing-plans" role="radiogroup" aria-label="Planes">
            {plans.map(plan => {
              const blocked = members > plan.users;
              const on = selected?.key === plan.key;
              return <button role="radio" aria-checked={on} className="billing-option" type="button" key={plan.key} disabled={busy || blocked} onClick={() => { setTier(plan.plan as 'BASIC' | 'BUSINESS'); closeQuote(); }}>
                <span className="billing-radio" aria-hidden="true" />
                <span><b>{plan.name}</b><small>Hasta {plan.users} usuarios</small></span>
                <span className="billing-option-price">{usd(plan.usd / plan.months)}/mes{plan.months >= 12 ? <small>{usd(plan.usd)} por año</small> : null}{plan.months < 12 && plan.amountArs ? <small>≈ {ars(plan.amountArs)}</small> : null}</span>
              </button>;
            })}
          </div>
          <a className="billing-custom" href="mailto:hola@imanager.com.ar">¿Necesitás un sistema propio? <span>Escribinos ›</span></a>
          {!internal ? <button className="billing-link billing-status-link" type="button" disabled={busy || loading} onClick={() => void run(async () => { await refreshPayment(); setNotice('Estado actualizado desde Mercado Pago.'); })}>Actualizar estado del pago</button> : null}
          {selected ? <div className="billing-dock" data-testid="billing-dock">
            <div className="billing-dock-compact"><b>{chargeAt ? `Primer cobro el ${dayMonth(chargeAt)}` : 'Hoy'} · {usd(selected.usd)}{selected.amountArs ? ` · ≈ ${ars(selected.amountArs)}` : ''}</b><span>{laterLabel(chargeAt ?? new Date().toISOString(), selected.months)}</span></div>
            <div className="billing-dock-rows">
              <div className="billing-row"><span>{chargeAt ? `Primer cobro el ${dayMonth(chargeAt)}` : 'Pagás hoy'}</span><b>{usd(selected.usd)}{selected.amountArs ? <small>≈ {ars(selected.amountArs)}</small> : null}</b></div>
              <div className="billing-row"><span>{selected.months >= 12 ? 'Se renueva' : 'Después'}</span><b>{selected.months >= 12 ? dayMonth(plusMonths(chargeAt ?? new Date().toISOString(), 12)) : afterLabel(chargeAt ?? new Date().toISOString(), 1)}</b></div>
            </div>
            <button className="billing-primary" type="button" disabled={busy || members > selected.users || !email.trim()} onClick={() => openQuote(selected)}>Suscribirme a {selected.name}</button>
            <p className="billing-caption">Pagás en pesos con Mercado Pago. Cancelás cuando quieras.</p>
          </div> : null}
        </> : null}
        {cancelConfirm && scheduled ? <div className="billing-cancel" role="group" aria-label="Confirmar cancelación"><p>¿Querés cancelar los próximos cobros?</p><button type="button" className="billing-text-danger" disabled={busy} onClick={() => void run(async () => { await cancelSubscription(); await loadBilling(); await reloadSession(); setCancelConfirm(false); setNotice('Suscripción cancelada. No se harán nuevos cobros.'); })}>Sí, cancelar suscripción</button><button className="billing-link" type="button" disabled={busy} onClick={() => setCancelConfirm(false)}>Conservar suscripción</button></div> : null}
        {quote ? createPortal(<ConfirmCheckout quote={quote} busy={busy} error={checkoutError} phone={phone} onClose={closeQuote} onContinue={() => void continueCheckout()} onEmail={async next => { setEmail(next); setQuote(await quoteSubscription(quote.key, next)); }} />, document.body) : null}
      </div>
    </div>
  );
}

function ConfirmCheckout({ quote, busy, error, phone, onClose, onContinue, onEmail }: {
  quote: BillingQuote;
  busy: boolean;
  error: string;
  phone: boolean;
  onClose: () => void;
  onContinue: () => void;
  onEmail: (email: string) => Promise<void>;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyState = useRef(busy);
  const backdropPressed = useRef(false);
  const closing = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(quote.payerEmail);
  closeRef.current = onClose;
  busyState.current = busy;
  useEffect(() => { setDraft(quote.payerEmail); }, [quote.payerEmail]);
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
  const at = quote.firstChargeAt;
  const annual = quote.key.endsWith('ANNUAL');
  const months = annual ? 12 : 1;
  const saveEmail = () => {
    setEditing(false);
    const next = draft.trim().toLowerCase();
    if (next && next !== quote.payerEmail) void onEmail(next);
  };
  return (
    <div className="billing-modal-backdrop" data-layout={layout} data-testid="billing-modal-backdrop" onMouseDown={dismiss}
      onPointerDown={(event) => { backdropPressed.current = event.target === event.currentTarget; }}
      onPointerUp={(event) => { if (backdropPressed.current && event.target === event.currentTarget) dismiss(event); backdropPressed.current = false; }}
      onPointerCancel={() => { backdropPressed.current = false; }}>
      <div ref={panel} className="billing-modal" data-layout={layout} data-testid="billing-quote" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
        {phone ? <div className="billing-modal-grab" aria-hidden="true" /> : null}
        <h2 id={titleId}>Antes de suscribirte</h2>
        <p className="billing-modal-plan">Plan {quote.key.startsWith('BUSINESS') ? 'Negocio' : 'Básico'} · {annual ? 'anual' : 'mensual'}</p>
        <div className="billing-due">
          <span>{at ? `Primer cobro el ${dayMonth(at)}` : 'Pagás hoy'}</span>
          <strong>≈ {ars(quote.amountArs)}</strong>
          <small>{usd(quote.usd)} al dólar de hoy</small>
        </div>
        <div className="billing-row"><span>Después</span><b>{afterLabel(at ?? new Date().toISOString(), months)}</b></div>
        <div className="billing-row billing-email-row"><span>Email del pago</span>{editing ? <input type="email" aria-label="Email del pagador" autoComplete="email" value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onBlur={saveEmail} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveEmail(); } }} /> : <b>{quote.payerEmail} <button type="button" className="billing-change" disabled={busy} onClick={() => setEditing(true)}>Cambiar</button></b>}</div>
        <PaymentMethods />
        <p className="billing-fine">Débito automático en pesos según el dólar del día. Te avisamos antes del primer cobro. Cancelás cuando quieras.</p>
        {error ? <div ref={alertRef} className="billing-error" role="alert" tabIndex={-1}>{error}</div> : null}
        <div className="billing-modal-actions">
          <button className="billing-primary" type="button" disabled={busy} aria-busy={busy || undefined} onClick={onContinue}>{busy ? 'Abriendo Mercado Pago…' : 'Continuar en Mercado Pago'}</button>
          <button className="billing-link" type="button" disabled={busy} onClick={onClose}>Volver</button>
        </div>
      </div>
    </div>
  );
}

function PaymentMethods() {
  return (
    <div className="billing-pay">
      <p>Cómo pagás</p>
      <div className="billing-pay-chips">
        <span><CreditCard size={16} aria-hidden="true" /> Crédito</span>
        <span><CreditCard size={16} aria-hidden="true" /> Débito de banco</span>
        <span><span className="billing-pay-radio" aria-hidden="true" /> Cuenta de Mercado Pago</span>
      </div>
      <p className="billing-pay-no"><X size={14} aria-hidden="true" /> Por ahora no: prepagas como Naranja X, Ualá o la tarjeta de Mercado Pago.</p>
    </div>
  );
}

function IncompletePayment({ busy, error, rejected, planName, period, accessUntil: until, onRetry }: {
  busy: boolean;
  error: string;
  rejected: boolean;
  planName: string;
  period: string;
  accessUntil: string | null;
  onRetry: () => void;
}) {
  return (
    <section className="billing-card billing-failed" data-testid="billing-payment-incomplete" role="status">
      <div className="billing-card-top"><h2>Plan {planName} · {period}</h2><span className="billing-pill">Pago no completado</span></div>
      <div className="billing-callout"><CreditCard size={18} /><div><strong>{rejected ? 'Mercado Pago no aceptó la tarjeta' : 'No se completó el pago'}</strong><p>Suele pasar con tarjetas prepagas. Tu tienda sigue funcionando{until ? ` hasta el ${dayMonth(until)}` : ''}.</p></div></div>
      <div className="billing-failed-actions">
        <button className="billing-primary" type="button" disabled={busy} onClick={onRetry}>{busy ? 'Abriendo Mercado Pago…' : 'Reintentar con otra tarjeta'}</button>
        <button className="billing-secondary" type="button" disabled={busy} onClick={onRetry}>Pagar con mi cuenta de Mercado Pago</button>
      </div>
      {error ? <p className="billing-note">{error}</p> : null}
      <PaymentMethods />
    </section>
  );
}

export function BillingAccessBanner({ dashboard = false }: { dashboard?: boolean }) {
  const { appSession } = useAppContext();
  const { go } = useDesk();
  const billing = appSession?.billing;
  if (!billing || billing.plan === 'INTERNAL') return null;
  const owner = appSession.membership?.role === 'OWNER';
  if (billing.chargeReminder && billing.firstChargeAt) {
    return <div className="billing-access billing-access-soon" role="status" data-testid="billing-charge-reminder"><div><strong>Primer cobro el {dayMonth(billing.firstChargeAt)}</strong><p>Tu prueba sigue hasta ese día. No se cobra antes.</p></div>{owner ? <button className="billing-primary" type="button" onClick={() => go('billing')}>Ver plan</button> : null}</div>;
  }
  if (!billing.readOnly && (!dashboard || !billing.trialDaysLeft)) return null;
  return <div className={`billing-access ${billing.readOnly ? 'billing-access-expired' : ''}`} role="status" data-testid="billing-access-banner"><div><strong>{billing.readOnly ? 'Modo solo lectura' : `Prueba gratuita · ${billing.trialDaysLeft} ${billing.trialDaysLeft === 1 ? 'día restante' : 'días restantes'}`}</strong><p>{billing.readOnly ? (billing.overLimit ? 'El equipo supera el límite del plan.' : 'Elegí un plan para seguir operando. Tus datos están disponibles.') : 'Probá iManager durante 7 días, sin tarjeta.'}{!owner && billing.readOnly ? ' Contactá al propietario.' : ''}</p></div>{owner ? <button className="billing-primary" type="button" onClick={() => go('billing')}>Ver planes</button> : null}</div>;
}
