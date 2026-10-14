import { useState } from 'react';
import { APP_URL, SIGNUP_URL } from './content';
import { Icon } from './Icon';
import type { IconName } from './icons';

export function Problem() {
  const cards: { icon: IconName; title: string; text: string; q: string }[] = [
    { icon: 'lista-de-precios', title: 'Planillas que no cierran', text: 'Tres versiones del mismo Excel y nadie sabe cuál es la buena.', q: '«¿Quién vendió el 13 azul?»' },
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
        <h2 className="h2">Si tu stock vive en una planilla, esto te suena.</h2>
        <p className="lead">Vender iPhone en Argentina es vender en dólares, cobrar en pesos, tomar usados y no perder de vista ni un IMEI.</p>
        <div className="pgrid">
          {cards.map((c) => (
            <div className="pc" key={c.title}>
              <div className="ico"><Icon name={c.icon} on={c.icon === 'dolar'} /></div>
              <h4>{c.title}</h4>
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
    { icon: 'ventas', title: 'Ventas', text: 'Pagos mixtos, accesorios en la misma venta y el equipo sale del stock solo.' },
    { icon: 'canjes', title: 'Canjes', text: 'Tomá usados en parte de pago con peritaje y costo real.' },
    { icon: 'dolar', title: 'Dólar blue al día', text: 'La cotización siempre a la vista; precios en USD con pesos actualizados.' },
    { icon: 'clientes', title: 'Clientes', text: 'Historial de compras, canjes y saldos de cada cliente.' },
    { icon: 'accesorio', title: 'Accesorios', text: 'Fundas, cargadores y templados con su propio stock.' },
    { icon: 'reportes', title: 'Reportes', text: 'Ventas, márgenes y rotación por período.' },
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
            <h4>Inventario por IMEI</h4>
            <p>Modelo, capacidad, color, condición, batería y precio. Filtros por estado y lista de precios lista para mandar por WhatsApp.</p>
            <img src="/assets/app-desk-inventario.png" alt="Inventario en iManager" loading="lazy" decoding="async" width="2880" height="1640" />
          </div>
          {small.map((f) => (
            <div className="fc" key={f.title}>
              <div className="ico"><Icon name={f.icon} on /></div>
              <h4>{f.title}</h4>
              <p>{f.text}</p>
            </div>
          ))}
          <div className="fc wide">
            <div>
              <div className="ico"><Icon name="servicio-tecnico" on /></div>
              <h4>Servicio técnico</h4>
              <p>Tablero de reparaciones con cada orden en su estado y aviso al cliente cuando está lista.</p>
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
    { title: 'Importá tu planilla', text: 'Subí tu Excel o Google Sheets y tus equipos quedan cargados con su IMEI.', icon: 'importar', mini: 'stock-octubre.xlsx · 248 equipos' },
    { title: 'Vendé y canjeá', text: 'Desde la compu del mostrador o el celular. Invitá a tu equipo cuando quieras.', icon: 'ventas', mini: 'Venta V-0128 registrada' },
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
              <h4>{s.title}</h4>
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
  { label: 'Inventario', m1: ['app-mob-servicio.png', 'Servicio técnico en mobile'], m2: ['app-mob-venta.png', 'Venta con accesorios en mobile'] },
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

export function Testimonials() {
  const items = [
    ['Pasamos de tres planillas a una sola pantalla. Ahora sabemos qué hay en stock sin preguntar.', 'CABA'],
    ['Los canjes eran un lío. Ahora cada usado entra con su costo y sabemos cuánto ganamos de verdad.', 'Córdoba'],
    ['Con el blue arriba de todo, actualizamos precios en un minuto y los mandamos por WhatsApp.', 'Mendoza'],
  ];
  return (
    <section className="sec" id="testimonios" style={{ paddingTop: 40 }}>
      <div className="wrap">
        <span className="kick"><i />Tiendas que lo usan</span>
        <h2 className="h2">Lo que dicen las tiendas.</h2>
        <div className="tgrid">
          {items.map(([q, city]) => (
            <figure className="tc" key={city}>
              <span className="ph-badge">Testimonio de ejemplo</span>
              <blockquote><q>{q}</q></blockquote>
              <figcaption className="who">
                <span className="av" />
                <div><b>Nombre Apellido</b><small>Tienda de ejemplo · {city}</small></div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section className="sec price" id="precios">
      <div className="wrap" style={{ textAlign: 'center' }}>
        <span className="kick"><i />Precios</span>
        <h2 className="h2">Planes simples, en pesos. <span className="ex">Ejemplo · a definir</span></h2>
        <p className="lead" style={{ margin: '0 auto' }}>Empezá gratis. Pasá de plan cuando tu tienda crezca.</p>
        <div className="plans" style={{ textAlign: 'left' }}>
          <div className="pl">
            <h4>Inicial</h4>
            <div className="d">Para arrancar a ordenar</div>
            <div className="amt">$ 0 <small>/ mes</small></div>
            <ul>{['Hasta 50 equipos', '1 usuario', 'Inventario y ventas'].map((x) => <li key={x}><Icon name="disponible" />{x}</li>)}</ul>
            <a className="btn s" href={SIGNUP_URL}>Probar gratis</a>
          </div>
          <div className="pl hot">
            <span className="tagp">Más elegido</span>
            <h4>Tienda</h4>
            <div className="d">Para el día a día del local</div>
            <div className="amt">$ XX.XXX <small>/ mes</small></div>
            <ul>{['Equipos ilimitados', 'Hasta 5 usuarios', 'Canjes, clientes y dólar blue', 'Servicio técnico', 'Reportes'].map((x) => <li key={x}><Icon name="disponible" />{x}</li>)}</ul>
            <a className="btn y" href={SIGNUP_URL}>Probar 14 días gratis</a>
          </div>
          <div className="pl">
            <h4>Cadena</h4>
            <div className="d">Varias sucursales</div>
            <div className="amt">$ XX.XXX <small>/ mes</small></div>
            <ul>{['Todo lo de Tienda', 'Varias tiendas, una cuenta', 'Comisiones y permisos'].map((x) => <li key={x}><Icon name="disponible" />{x}</li>)}</ul>
            <a className="btn s" href="mailto:hola@imanager.com.ar">Hablemos</a>
          </div>
        </div>
        <div className="pnote">Montos de ejemplo para el wireframe: los precios reales están a definir.</div>
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
        <div className="fgrid2">
          <div>
            <img src="/assets/logotipo-oscuro.svg" alt="iManager" width="241" height="64" loading="lazy" />
            <p>Gestión para tiendas de celulares. Hecho en Argentina.</p>
          </div>
          <div>
            <h5>Producto</h5>
            <ul><li><a href="#funciones">Funciones</a></li><li><a href="#precios">Precios</a></li><li>Novedades</li></ul>
          </div>
          <div>
            <h5>Ayuda</h5>
            <ul><li><a href="#faq">Preguntas frecuentes</a></li><li>Guía para importar</li><li><a href="mailto:hola@imanager.com.ar">Contacto</a></li></ul>
          </div>
          <div>
            <h5>Cuenta</h5>
            <ul><li><a href={APP_URL}>Entrar</a></li><li><a href={SIGNUP_URL}>Probar gratis</a></li></ul>
          </div>
        </div>
        <div className="legal"><span>© 2026 iManager · imanager.com.ar</span><span>Términos · Privacidad</span></div>
      </div>
    </footer>
  );
}
