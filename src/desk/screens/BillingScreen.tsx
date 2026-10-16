import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { BillingQuote } from '../../types/billing';
import { toUserMessage } from '../../lib/user-message';
import { PageHead, useDesk } from '../ui';
import './billing.css';

export const billingPlanName = (plan?: string) => ({ INTERNAL: 'Interno', TRIAL: 'Prueba gratuita', BASIC: 'Básico', BUSINESS: 'Negocio' }[plan ?? ''] ?? 'Tu plan');
const statusName = (status?: string) => ({ ACTIVE: 'Activa', TRIAL: 'En prueba', EXPIRED: 'Vencida', CANCELLED: 'Cancelada' }[status ?? ''] ?? '');
const ars = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(amount);
const date = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

export function BillingScreen() {
  const { appSession, billingDetails, loadBilling, quoteSubscription, openSubscriptionCheckout, cancelSubscription, reloadSession } = useAppContext();
  const { go } = useDesk();
  const [annual, setAnnual] = useState(false);
  const [email, setEmail] = useState(appSession?.user.email ?? '');
  const [quote, setQuote] = useState<BillingQuote | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const quoteRef = useRef<HTMLElement>(null);
  useEffect(() => { if (quote) quoteRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }); }, [quote]);
  const storeId = appSession?.store?.id;
  useEffect(() => {
    alive.current = true;
    setLoading(true); setQuote(null); setError('');
    void loadBilling().catch(cause => { if (alive.current) setError(toUserMessage(cause)); }).finally(() => { if (alive.current) setLoading(false); });
    return () => { alive.current = false; };
  }, [loadBilling, storeId]);
  const billing = billingDetails ?? appSession?.billing;
  const internal = billing?.plan === 'INTERNAL';
  const subscribed = billing?.canCancel || (!!billing?.paidThrough && new Date(billing.paidThrough) > new Date());
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (cause) { if (alive.current) setError(toUserMessage(cause)); }
    finally { if (alive.current) setBusy(false); }
  };
  if (appSession?.membership?.role !== 'OWNER') return <div className="dscreen"><p>Solo el propietario puede administrar Plan y facturación.</p></div>;
  return (
    <div className="dscreen billing-screen" data-testid="billing-screen">
      <PageHead title="Plan y facturación" subtitle="Tu suscripción a iManager" back={() => go('settings')} />
      <div className="billing-content">
        <section className="billing-current" aria-label="Plan actual">
          <div className="billing-heading"><CreditCard size={22} /><h2>{billingPlanName(billing?.plan)}</h2><span className="billing-status">{internal ? 'Gratis de por vida' : statusName(billing?.status)}</span></div>
          {internal ? <p>Tu cuenta tiene acceso gratis de por vida, sin cobros ni límite de usuarios.</p> : <>
            <p>{billing?.readOnly ? 'Tu tienda está en modo solo lectura. Tus datos siguen disponibles.' : 'Tu tienda está lista para operar.'}</p>
            {billing?.trialDaysLeft ? <p>Te {billing.trialDaysLeft === 1 ? 'queda 1 día' : `quedan ${billing.trialDaysLeft} días`} de prueba sin tarjeta.</p> : null}
            {billing?.paidThrough ? <p>{billing.status === 'CANCELLED' ? 'Acceso abonado hasta' : 'Período abonado hasta'} el {date(billing.paidThrough)}.</p> : null}
            <p>{billing?.members ?? 0} de {billing?.memberLimit ?? 3} {billing?.memberLimit === 1 ? 'usuario' : 'usuarios'} · Incluye al propietario</p>
            {billing?.readOnly && billing.canCancel && !billing.overLimit ? <p>Si ya pagaste, actualizá el estado. También podés cancelar esta suscripción para elegir un nuevo plan.</p> : null}
            {billing?.overLimit ? <p role="alert">Tu equipo supera el límite del plan. Quitá miembros desde Configuración para volver a operar.</p> : null}
          </>}
          {!internal ? <button className="billing-link" type="button" disabled={busy || loading} onClick={() => void run(async () => { await loadBilling(true); await reloadSession(); setNotice('Estado actualizado desde Mercado Pago.'); })}>Actualizar estado del pago</button> : null}
        </section>
        {error ? <div className="billing-error" role="alert">{error}<button className="billing-link" type="button" disabled={busy} onClick={() => void run(async () => { await loadBilling(); setLoading(false); })}>Reintentar</button></div> : null}
        {notice ? <p className="billing-notice" role="status">{notice}</p> : null}
        {loading ? <p role="status">Cargando planes…</p> : null}
        {!internal && !subscribed ? <>
          <div className="billing-intro"><h2>Elegí cómo seguir</h2><p>Precios en USD. Pagás el equivalente en pesos argentinos con Mercado Pago.</p></div>
          <div className="billing-period" role="group" aria-label="Frecuencia de facturación">
            <button type="button" aria-pressed={!annual} disabled={busy} onClick={() => { setAnnual(false); setQuote(null); }}>Mensual</button>
            <button type="button" aria-pressed={annual} disabled={busy} onClick={() => { setAnnual(true); setQuote(null); }}>Anual · Ahorrás 25%</button>
          </div>
          <label className="billing-email">Email del pagador<input type="email" autoComplete="email" value={email} disabled={busy} onChange={event => { setEmail(event.target.value); setQuote(null); }} /><small>Usá este mismo email al pagar en Mercado Pago.</small></label>
          <div className="billing-plans">
            {(billingDetails?.plans ?? []).filter(plan => plan.period === (annual ? 'ANNUAL' : 'MONTHLY')).map(plan => <section className="billing-plan" key={plan.key}>
              <h3>{plan.name}</h3><p className="billing-price">US$ {new Intl.NumberFormat('es-AR', { minimumFractionDigits: annual ? 2 : 0, maximumFractionDigits: 2 }).format(plan.usd / plan.months)}<span>/mes</span></p>
              <p>{annual ? `US$ ${plan.usd} por año, en un solo cobro` : 'Cobro mensual'}</p>
              <p className="billing-feature"><Check size={17} />{plan.users === 1 ? '1 usuario' : 'Hasta 3 usuarios'}</p>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="billing-primary" type="button" disabled={busy || !email.trim() || (billing?.members ?? 0) > plan.users} onClick={() => void run(async () => { setQuote(null); setQuote(await quoteSubscription(plan.key, email)); })}>Suscribirme a {plan.name}</motion.button>
              {(billing?.members ?? 0) > plan.users ? <small>Primero reducí tu equipo a {plan.users} usuario.</small> : null}
            </section>)}
            <section className="billing-plan billing-custom"><h3>Sistema propio</h3><p className="billing-price">A medida</p><p>Una solución para las necesidades de tu negocio.</p><p>Contactá a iManager para definir el alcance y el precio.</p></section>
          </div>
          {quote ? <section ref={quoteRef} className="billing-confirm" aria-label="Confirmar suscripción" data-testid="billing-quote">
            <h2>Antes de suscribirte</h2><p>Se va a cobrar <strong>{ars(quote.amountArs)} ARS</strong> {quote.key.endsWith('ANNUAL') ? 'por año' : 'por mes'}.</p>
            <p>Equivale a US$ {quote.usd} · Dólar blue vendedor: {ars(quote.exchangeRate)}.</p>
            <p>Email del pagador: <strong>{quote.payerEmail}</strong></p><p>El débito es automático. El importe en ARS se ajusta con la cotización. Podés cancelar los próximos cobros desde esta pantalla.</p>
            <p className="billing-safe"><ShieldCheck size={17} />La tarjeta se ingresa en Mercado Pago.</p>
            <button className="billing-primary" type="button" disabled={busy} onClick={() => void run(async () => {
              try {
                const { initPoint } = await openSubscriptionCheckout(quote.id);
                const url = new URL(initPoint);
                if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar' || url.pathname !== '/subscriptions/checkout') throw new Error('El enlace de pago no es válido.');
                window.location.assign(url.toString());
              } catch (cause) { setQuote(null); throw cause; }
            })}>{busy ? 'Consultando…' : 'Continuar a Mercado Pago'}</button>
            <button className="billing-link" type="button" disabled={busy} onClick={() => setQuote(null)}>Volver a elegir</button>
          </section> : null}
        </> : null}
        {!internal && billing?.canCancel ? <section className="billing-current">
          <h2>Cancelar suscripción</h2><p>Se detienen los próximos cobros y conservás el acceso hasta el fin del período abonado.</p>
          {cancelConfirm ? <div className="billing-cancel" role="group" aria-label="Confirmar cancelación"><p>¿Querés cancelar los próximos cobros?</p><button type="button" className="billing-danger" disabled={busy} onClick={() => void run(async () => { await cancelSubscription(); await loadBilling(); await reloadSession(); setCancelConfirm(false); setNotice('Suscripción cancelada. No se harán nuevos cobros.'); })}>Sí, cancelar suscripción</button><button className="billing-link" type="button" disabled={busy} onClick={() => setCancelConfirm(false)}>Conservar suscripción</button></div> : <button className="billing-danger" type="button" disabled={busy} onClick={() => setCancelConfirm(true)}>Cancelar suscripción</button>}
        </section> : null}
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
