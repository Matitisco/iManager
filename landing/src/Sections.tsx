import { useState } from 'react';
import { ANNUAL_LABEL, APP_URL, PLANS, PRICING_BENEFITS, SHOW_BILLING_TOGGLE, SHOW_PRICING, SIGNUP_URL, TRIAL, type Plan } from './content';
import { Icon } from './Icon';
import type { IconName } from './icons';

export function Problem() {
  const cards: { icon: IconName; title: string; text: string; q: string }[] = [
    { icon: 'lista-de-precios', title: 'Planillas que no cierran', text: 'El stock vive en planillas y en la memoria de alguien.', q: '«¿Quién vendió el 13 azul?»' },
    { icon: 'equipo', title: 'IMEI anotados a mano', text: 'Un número mal copiado y el equipo desaparece del stock.', q: '«Ese IMEI no figura en ningún lado.»' },
    { icon: 'canje', title: 'Canjes en el aire', text: 'El usado entra, se revende, y el costo real nunca se registra.', q: '«¿Cuánto le dimos por el 12?»' },
    { icon: 'dolar', title: 'Precios con el dólar de ayer', text: 'El blue se mueve y la lista de precios queda vieja en horas.', q: '«¿A cuánto está hoy?»' },
  ];
  const props: { icon: IconName; text: string }[] = [
    { icon: 'equipo', text: 'Cada equipo identificado por IMEI' },
    { icon: 'canje', text: 'Canjes con costo, peritaje y cliente' },
    { icon: 'dolar', text: 'Precios en dólares, pesos al blue del día' },
    { icon: 'clientes', text: 'Todo el equipo, con permisos por sección' },
  ];
  return (
    <section className="sec prob" id="problema">
      <div className="wrap">
        <span className="kick" style={{ color: 'var(--g2)' }}><i />El problema</span>
        <h2 className="h2">Si tu stock vive en un Excel, <span className="hl">no es escalable</span>.</h2>
        <p className="lead">Vender iPhone en Argentina es vender en dólares, cobrar en pesos, tomar usados y no perder de vista ni un IMEI. Una planilla no da para tanto.</p>
        <div className="pgrid">
          {cards.map((c) => (
            <div className="pc" key={c.title}>
              <div className="ico"><Icon name={c.icon} on={c.icon === 'dolar'} /></div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <div className="q">{c.q}</div>
            </div>
          ))}
        </div>
        <div className="vp">
          <div>
            <span className="kick" style={{ color: '#5C5320' }}><i style={{ background: 'var(--k)' }} />La propuesta</span>
            <h3>Un solo lugar para el stock, la plata y los clientes.</h3>
            <p>iManager está pensado para tiendas de celulares que venden iPhone nuevos y usados: rápido de cargar, claro para todo el equipo.</p>
          </div>
          <ul>
            {props.map((p) => <li key={p.text}><Icon name={p.icon} on={p.icon === 'dolar' || p.icon === 'clientes'} />{p.text}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const small: { icon: IconName; title: string; text: string }[] = [
    { icon: 'ventas', title: 'Ventas', text: 'Efectivo, transferencia, tarjeta o cripto. El equipo sale del stock solo.' },
    { icon: 'canjes', title: 'Canjes', text: 'El usado entra en parte de pago, con batería, calidad y costo real.' },
    { icon: 'dolar', title: 'Dólar blue al día', text: 'Precios en dólares y pesos con la cotización del momento.' },
    { icon: 'clientes', title: 'Clientes', text: 'Saldo e historial de pagos de cada cliente.' },
    { icon: 'lista-de-precios', title: 'Caja diaria', text: 'El movimiento del día, en pesos y en dólares.' },
    { icon: 'reportes', title: 'Reportes', text: 'Ventas, stock, canjes, clientes, servicio y margen bruto estimado.' },
    { icon: 'comisiones', title: 'Comisiones', text: 'Cuánto vendió y cuánto cobra cada vendedor.' },
  ];
  return (
    <section className="sec" id="funciones">
      <div className="wrap">
        <span className="kick"><i />Funciones</span>
        <h2 className="h2">Todo lo que una tienda de iPhone necesita.</h2>
        <p className="lead">Y nada que no uses. Funciona igual en la compu del mostrador y en tu celular.</p>
        <div className="fgrid">
          <div className="fc big">
            <div className="ico"><Icon name="inventario" on /></div>
            <h3>Inventario por IMEI</h3>
            <p>Modelo, capacidad, color, batería, estado y precio. Filtros por estado y catálogo para compartir por link.</p>
            <img src="/assets/app-desk-inventario.png" alt="Inventario en iManager" loading="lazy" decoding="async" width="2880" height="1640" />
          </div>
          {small.map((f) => (
            <div className="fc" key={f.title}>
              <div className="ico"><Icon name={f.icon} on /></div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
          <div className="fc wide">
            <div>
              <div className="ico"><Icon name="servicio-tecnico" on /></div>
              <h3>Servicio técnico</h3>
              <p>Tablero de reparaciones con cada orden en su estado y aviso por WhatsApp cuando está lista.</p>
            </div>
            <div className="kb">
              <span><i style={{ background: '#737984' }} />Recibido</span>
              <span><i style={{ background: '#3B82F6' }} />En reparación</span>
              <span><i style={{ background: '#25A66A' }} />Listo para retirar</span>
              <span><i style={{ background: '#16181D' }} />Entregado</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps: { title: string; text: string; icon: IconName; mini: string }[] = [
    { title: 'Creá tu tienda', text: 'Con tu mail o tu cuenta de Google. Nombre, moneda y listo.', icon: 'configuracion', mini: 'Mi tienda · ARS / USD' },
    { title: 'Importá tu planilla', text: 'Subí tu Excel o CSV, o pegá tu lista, y tus equipos quedan cargados con su IMEI.', icon: 'importar', mini: 'Excel, CSV o lista pegada' },
    { title: 'Vendé y canjeá', text: 'Desde la compu del mostrador o el celular. Sumá a tu equipo cuando quieras.', icon: 'ventas', mini: 'Desde la compu o el celular' },
  ];
  return (
    <section className="sec how" id="como">
      <div className="wrap">
        <span className="kick"><i />Cómo funciona</span>
        <h2 className="h2">Arrancás hoy, en tres pasos.</h2>
        <div className="steps">
          {steps.map((s, i) => (
            <div className="st" key={s.title}>
              <div className="n">{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <div className="mini"><Icon name={s.icon} on={s.icon === 'ventas'} />{s.mini}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TABS: { label: string; m1: [string, string]; m2: [string, string] }[] = [
  { label: 'Inventario', m1: ['app-mob-servicio.png', 'Servicio técnico en mobile'], m2: ['app-mob-venta.png', 'Venta en mobile'] },
  { label: 'Ventas', m1: ['app-mob-venta.png', 'Registrar venta en mobile'], m2: ['app-mob-comisiones.png', 'Comisiones en mobile'] },
  { label: 'Canjes', m1: ['app-mob-dashboard.png', 'Dashboard con canjes en curso'], m2: ['app-mob-inventario.png', 'Inventario en mobile'] },
  { label: 'Servicio técnico', m1: ['app-mob-servicio.png', 'Servicio técnico en mobile'], m2: ['app-mob-dashboard.png', 'Dashboard en mobile'] },
  { label: 'Dólar', m1: ['app-mob-dolar.png', 'Dólar blue en mobile'], m2: ['app-mob-venta.png', 'Venta en pesos y dólares'] },
];

export function Screens() {
  const [tab, setTab] = useState(0);
  const t = TABS[tab];
  return (
    <section className="sec shots" id="capturas">
      <div className="wrap">
        <span className="kick"><i />Así se ve</span>
        <h2 className="h2">Hecha para el mostrador. Y para el bolsillo.</h2>
        <div className="tabs" role="tablist">
          {TABS.map((x, i) => (
            <button type="button" role="tab" aria-selected={i === tab} key={x.label} className={i === tab ? 'on' : undefined} onClick={() => setTab(i)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="gal">
          <div className="desk">
            <div className="bar"><i /><i /><i /><span>app.imanager.com.ar/#/inv</span></div>
            <img src="/assets/app-desk-inventario.png" alt="Inventario desktop" loading="lazy" decoding="async" width="2880" height="1640" />
          </div>
          <div className="mph m1"><img src={`/assets/${t.m1[0]}`} alt={t.m1[1]} loading="lazy" decoding="async" /></div>
          <div className="mph m2"><img src={`/assets/${t.m2[0]}`} alt={t.m2[1]} loading="lazy" decoding="async" /></div>
          <div className="cap2 c-a"><Icon name="servicio-tecnico" on />Reparaciones: Recibido → En reparación → Listo → Entregado</div>
          <div className="cap2 c-b"><Icon name="equipo" />Cada fila es un equipo, con su IMEI</div>
        </div>
      </div>
    </section>
  );
}

function Arrow({ out }: { out?: boolean }) {
  return (
    <svg className="arr" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path d={out ? 'M5 11l6-6M6 5h5v5' : 'M3 8h10M9 4l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlanCard({ p, annual }: { p: Plan; annual: boolean }) {
  const hot = Boolean(p.badge);
  return (
    <div className={`pl${hot ? ' hot' : ''}`}>
      {p.badge && <span className="tagp">{p.badge}</span>}
      <h3>{p.name}</h3>
      <div className="d">{p.desc}</div>
      <div className="amt">
        {p.price ? (
          <>
            <div className="n">
              <small className="cur">US$</small>
              {annual ? p.price.annual.perMonth : p.price.monthly}
              <small className="per">/mes</small>
            </div>
            <small className="yr" aria-hidden={!annual}>
              {annual ? `US$ ${p.price.annual.perYear}/año, pago anual` : '\u00a0'}
            </small>
          </>
        ) : (
          <>
            <div className="n custom">A medida</div>
            <small className="yr" aria-hidden="true">{'\u00a0'}</small>
          </>
        )}
      </div>
      <ul className="specs">
        {p.includes && <li className="inc">Todo lo de {p.includes}</li>}
        {p.specs.map((s) => (
          <li key={s.t}>{s.t}</li>
        ))}
      </ul>
      <div className="cta-foot">
        {p.price && <p className="trial">{TRIAL}</p>}
        <a className={`btn ${hot ? 'y' : 's'}`} href={p.cta.href}>
          {p.cta.label}
          <Arrow out={p.cta.external} />
        </a>
      </div>
    </div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  if (!SHOW_PRICING) return null;
  const isAnnual = SHOW_BILLING_TOGGLE && annual;
  return (
    <section className="sec price" id="precios">
      <div className="wrap">
        <div className="phead">
          <div>
            <span className="kick"><i />Precios</span>
            <h2 className="h2">Un plan para cada tienda.</h2>
          </div>
          {SHOW_BILLING_TOGGLE && (
            <div className="bill" role="group" aria-label="Período de facturación">
              <button type="button" aria-pressed={!isAnnual} onClick={() => setAnnual(false)}>Mensual</button>
              <button type="button" aria-pressed={isAnnual} onClick={() => setAnnual(true)}>
                Anual <span className="off">{ANNUAL_LABEL}</span>
              </button>
            </div>
          )}
        </div>
        <div className="plans">
          {PLANS.map((p) => <PlanCard key={p.name} p={p} annual={isAnnual} />)}
        </div>
        <p className="price-note">Precios en USD. Se cobra en pesos al tipo de cambio del día.</p>
        {PRICING_BENEFITS.length > 0 && (
          <ul className="perks">
            {PRICING_BENEFITS.map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ['¿Necesito instalar algo?', 'No. Entrás desde el navegador en app.imanager.com.ar, en la compu o en el celular.'],
  ['¿Puedo importar mi planilla actual?', 'Sí, desde un archivo Excel (.xlsx) o CSV, o pegando tu lista de equipos.'],
  ['¿Sirve solo para iPhone?', 'Está pensado para iPhone, pero podés cargar cualquier equipo con IMEI.'],
  ['¿De dónde sale la cotización del dólar?', 'Se actualiza sola desde DolarApi, con el blue, el oficial o el MEP. También podés cargar tu propio tipo de cambio.'],
  ['¿Sirve si también hago reparaciones?', 'Sí: el servicio técnico lleva cada orden por Recibido, En reparación, Listo para retirar y Entregado.'],
  ['¿Puedo sumar a mi equipo?', 'Sí, con roles de propietario, socio y empleado, y permisos por sección.'],
  ['¿Mis datos están seguros?', 'Cada tienda ve solo sus datos, con acceso por usuario.'],
];

export function Faq() {
  return (
    <section className="sec faq" id="faq">
      <div className="wrap">
        <div className="cols">
          <div>
            <span className="kick"><i />Preguntas</span>
            <h2 className="h2">Preguntas frecuentes.</h2>
            <p className="lead">¿Algo más? Escribinos a <a href="mailto:hola@imanager.com.ar">hola@imanager.com.ar</a>.</p>
          </div>
          <div>
            {FAQS.map(([q, a], i) => (
              <details className="qa" key={q} open={i === 0}>
                <summary>{q}<span aria-hidden="true" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="cta" id="cta">
      <div className="wrap">
        <div className="ctab">
          <span className="cube" />
          <div>
            <h2>Ordená tu tienda hoy.</h2>
            <p>Creá tu cuenta gratis o entrá si ya tenés una.</p>
            <div className="url">app.imanager.com.ar</div>
          </div>
          <div className="bts">
            <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
            <a className="btn s" href={APP_URL}>Entrar</a>
            <p className="trial">{TRIAL}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer({ path }: { path: string }) {
  const to = (href: string) => (path === '/' ? href : `/${href}`);
  return (
    <footer id="footer">
      <div className="wrap">
        <div className="fgrid2">
          <div>
            <img src="/assets/logotipo-oscuro.svg" alt="iManager" width="241" height="64" loading="lazy" />
            <p>Gestión para tiendas de celulares. Hecho en Argentina.</p>
          </div>
          <div>
            <h2>Producto</h2>
            <ul><li><a href={to('#funciones')}>Funciones</a></li><li><a href={to('#precios')}>Precios</a></li></ul>
          </div>
          <div>
            <h2>Ayuda</h2>
            <ul><li><a href={to('#faq')}>Preguntas frecuentes</a></li><li><a href="mailto:hola@imanager.com.ar">Contacto</a></li></ul>
          </div>
          <div>
            <h2>Cuenta</h2>
            <ul><li><a href={APP_URL}>Entrar</a></li><li><a href={SIGNUP_URL}>Probar gratis</a></li></ul>
          </div>
        </div>
        <div className="legal"><span>© 2026 iManager · imanager.com.ar</span><span><a href="/terminos">Términos</a> · <a href="/privacidad">Privacidad</a></span></div>
      </div>
    </footer>
  );
}
