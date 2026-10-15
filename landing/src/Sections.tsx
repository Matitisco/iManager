import { useState } from 'react';
import { ANNUAL_LABEL, APP_URL, PLANS, PRICING_BENEFITS, SHOW_BILLING_TOGGLE, SHOW_PRICING, SIGNUP_URL, type Plan } from './content';

export function Problem() {
  const excel = [
    'El stock vive en planillas y en la memoria de alguien',
    'IMEI copiados a mano, uno por uno',
    'Canjes que entran sin costo registrado',
    'Precios con el dólar de ayer',
  ];
  const im = [
    'Cada equipo identificado por su IMEI',
    'Canjes con costo, peritaje y cliente',
    'Precios en dólares, pesos al blue del día',
    'Todo el equipo, con permisos por sección',
  ];
  return (
    <section className="sec prob" id="problema">
      <div className="wrap">
        <div className="head">
          <div>
            <span className="kick">El problema</span>
            <h2 className="h2 xl">
              Si tu stock vive en un Excel, <span className="hl">no es escalable</span>.
            </h2>
          </div>
          <p className="lead">Vender iPhone en Argentina es vender en dólares, cobrar en pesos, tomar usados y no perder de vista ni un IMEI. Una planilla no da para tanto.</p>
        </div>
        <div className="vs">
          <div className="col off">
            <h3>Con un Excel</h3>
            <ul>{excel.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="col">
            <h3><img src="/assets/isotipo.svg" alt="" width="22" height="22" />Con iManager</h3>
            <ul>{im.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const items: [string, string][] = [
    ['Inventario por IMEI', 'Modelo, capacidad, color, batería, estado y precio de cada equipo.'],
    ['Ventas', 'Pagos mixtos y accesorios en la misma venta. El equipo sale del stock solo.'],
    ['Canjes', 'El usado entra en parte de pago, con peritaje y costo real.'],
    ['Servicio técnico', 'Cada orden en su estado, hasta que el cliente la retira.'],
    ['Dólar blue al día', 'Precios en dólares y pesos con la cotización del momento.'],
    ['Clientes y reportes', 'Historial por cliente, márgenes, rotación y comisiones.'],
  ];
  return (
    <section className="sec" id="funciones">
      <div className="wrap">
        <div className="head">
          <div>
            <span className="kick">Funciones</span>
            <h2 className="h2">Todo lo que una tienda de iPhone necesita.</h2>
          </div>
          <p className="lead">Y nada que no uses. Funciona igual en la compu del mostrador y en tu celular.</p>
        </div>
        <figure className="shot">
          <img src="/assets/app-desk-inventario.png" alt="Inventario en iManager" loading="lazy" decoding="async" width="2880" height="1640" />
        </figure>
        <div className="flist">
          {items.map(([t, d]) => (
            <div key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps: [string, string][] = [
    ['Creá tu tienda', 'Con tu mail o tu cuenta de Google. Nombre, moneda y listo.'],
    ['Importá tu planilla', 'Subí tu Excel o Google Sheets y tus equipos quedan cargados con su IMEI.'],
    ['Vendé y canjeá', 'Desde la compu del mostrador o el celular. Sumá a tu equipo cuando quieras.'],
  ];
  return (
    <section className="sec" id="como">
      <div className="wrap">
        <div className="head">
          <div>
            <span className="kick">Cómo funciona</span>
            <h2 className="h2">Arrancás hoy, en tres pasos.</h2>
          </div>
        </div>
        <ol className="steps">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
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
      {p.badge && <span className="badge">{p.badge}</span>}
      <h3>{p.name}</h3>
      <p className="d">{p.desc}</p>
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
          <div className="n custom">A medida</div>
        )}
      </div>
      <ul className="specs">
        {p.includes && <li className="inc">Todo lo del plan {p.includes}</li>}
        {p.specs.map((s) => (
          <li key={s.t}>
            {s.t}
            {s.soon && <span className="soon">Próximamente</span>}
          </li>
        ))}
      </ul>
      <a className={`btn ${hot ? 'p' : 's'}`} href={p.cta.href}>
        {p.cta.label}
        <Arrow out={p.cta.external} />
      </a>
    </div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  if (!SHOW_PRICING) return null;
  const isAnnual = SHOW_BILLING_TOGGLE && annual;
  return (
    <section className="sec pricing" id="precios">
      <div className="wrap">
        <div className="head">
          <div>
            <span className="kick">Precios</span>
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
  ['¿Puedo importar mi planilla actual?', 'Sí, desde Excel o Google Sheets.'],
  ['¿Sirve solo para iPhone?', 'Está pensado para iPhone, pero podés cargar cualquier equipo con IMEI.'],
  ['¿De dónde sale la cotización del dólar?', 'Mostramos el blue del día y podés usar tu propio tipo de cambio.'],
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
            <span className="kick">Preguntas</span>
            <h2 className="h2">Preguntas frecuentes.</h2>
            <p className="lead">¿Algo más? Escribinos a <a href="mailto:hola@imanager.com.ar">hola@imanager.com.ar</a>.</p>
          </div>
          <div>
            {FAQS.map(([q, a]) => (
              <details className="qa" key={q}>
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
          <img src="/assets/isotipo.svg" alt="" width="48" height="48" loading="lazy" />
          <h2>Ordená tu tienda <span className="hl">hoy</span>.</h2>
          <p>Creá tu cuenta gratis o entrá si ya tenés una.</p>
          <div className="bts">
            <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
            <a className="btn s" href={APP_URL}>Entrar</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer id="footer">
      <div className="wrap">
        <div className="frow">
          <div>
            <img src="/assets/logotipo-horizontal.svg" alt="iManager" width="241" height="64" loading="lazy" />
            <p>Gestión para tiendas de celulares. Hecho en Argentina.</p>
          </div>
          <nav aria-label="Pie de página">
            <a href="#funciones">Funciones</a>
            {SHOW_PRICING && <a href="#precios">Precios</a>}
            <a href="#faq">Preguntas</a>
            <a href="mailto:hola@imanager.com.ar">Contacto</a>
            <a href={APP_URL}>Entrar</a>
          </nav>
        </div>
        <div className="legal"><span>© 2026 iManager · imanager.com.ar</span><span>Términos · Privacidad</span></div>
      </div>
    </footer>
  );
}
