import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { APP_URL, SCREEN_TABS, WHATSAPP_URL } from './content';

function BrowserBar() {
  return <div className="bar" aria-hidden="true"><i /><i /><i /><span>app.imanager.com.ar</span></div>;
}

export function Hero() {
  return (
    <div className="wrap">
      <span className="chip"><i aria-hidden="true" />Beta · Gratis</span>
      <h1>Tu tienda de iPhone, <br className="desktop-break" /><span className="mk">ordenada</span> pieza por pieza.</h1>
      <p className="lead">Stock por IMEI, ventas, canjes, clientes y dólar blue en un solo lugar.</p>
      <div className="cta">
        <a className="btn p" href={APP_URL}>Empezar gratis</a>
        <a className="btn" href="#funciones">Ver cómo funciona</a>
      </div>
      <div className="bw">
        <div className="bf">
          <BrowserBar />
          <img src="/assets/a2/d-dashboard.webp" width="2880" height="1300" fetchPriority="high" decoding="async" alt="Dashboard de iManager con ventas, margen bruto, equipos vendidos y medios de pago de la tienda." />
        </div>
        <div className="ph">
          <img src="/assets/a2/m-inventario.webp" width="780" height="1688" decoding="async" alt="Inventario en el celular: consultá los equipos y su disponibilidad desde el mostrador." />
        </div>
      </div>
    </div>
  );
}

export function Problem() {
  const rows = [
    ['Modelo', 'IMEI', 'Bat.', 'Precio'],
    ['iPhone 13', '3567…', '87%', '690'],
    ['iPhone 12 Pro', '35678…', '—', '¿?'],
    ['iPhone 13', '3567…', '87%', '690'],
  ];
  return (
    <section className="sec2" id="problema" aria-labelledby="problem-title">
      <div className="wrap">
        <h2 className="t2" id="problem-title">Hoy tu tienda vive en un Excel,<br />unos papeles y varios chats.</h2>
        <div className="pro">
          <div className="pc">
            <div className="art" aria-hidden="true">
              <div className="xl">
                <div className="tb">stock.xlsx</div>
                {rows.map((row, index) => <div className="r" key={index}>{row.map((cell, column) => <span key={column}>{cell}</span>)}</div>)}
              </div>
            </div>
            <h3>Un Excel que se desactualiza</h3>
            <p>Nadie sabe cuál es la versión buena ni qué equipo ya se vendió.</p>
          </div>
          <div className="pc">
            <div className="art" aria-hidden="true">
              <div className="pp a">iPhone 12<i /><i style={{ width: '70%' }} /></div>
              <div className="pp b">Canje<i /><i style={{ width: '60%' }} /><i style={{ width: '80%' }} /></div>
              <div className="pp c">Saldo<i /><i style={{ width: '65%' }} /></div>
            </div>
            <h3>Papeles que se pierden</h3>
            <p>Canjes, saldos y órdenes de servicio anotados donde caiga.</p>
          </div>
          <div className="pc">
            <div className="art" aria-hidden="true">
              <div className="chat">
                <div className="bub l">¿Tenés el 13 Pro?</div>
                <div className="bub r">Creo que se vendió ayer…</div>
                <div className="bub l">¿Me confirmás?</div>
              </div>
            </div>
            <h3>WhatsApp para preguntar qué hay</h3>
            <p>Para saber el stock tenés que preguntarle a alguien.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Solution() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % SCREEN_TABS.length; break;
      case 'ArrowLeft': next = (index + SCREEN_TABS.length - 1) % SCREEN_TABS.length; break;
      case 'Home': next = 0; break;
      case 'End': next = SCREEN_TABS.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="sec2" id="funciones" aria-labelledby="solution-title">
      <div className="wrap">
        <h2 className="t2" id="solution-title">iManager lo junta <br className="mobile-break" />todo,<br />equipo por equipo.</h2>
        <p className="s2">Una sola herramienta, en la compu del mostrador y en tu celular.</p>
        <div className="tabs2">
          <div className="seg" role="tablist" aria-label="Vistas de iManager">
            {SCREEN_TABS.map((tab, index) => (
              <button key={tab.id} ref={(element) => { tabRefs.current[index] = element; }} type="button"
                role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-selected={active === index}
                tabIndex={active === index ? 0 : -1} className={active === index ? 'on' : ''}
                onClick={() => setActive(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>{tab.label}</button>
            ))}
          </div>
        </div>
        <p className="cap" id="screen-caption" aria-live="polite">{SCREEN_TABS[active].caption}</p>
        <div className="scr">
          {SCREEN_TABS.map((tab, index) => (
            <div key={tab.id} className="bf" role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}
              aria-describedby="screen-caption" hidden={active !== index} tabIndex={0}>
              <BrowserBar />
              <img src={`/assets/a2/${tab.image}.webp`} width={tab.width} height={tab.height} alt={tab.alt} loading="lazy" decoding="async" />
            </div>
          ))}
        </div>
        <div className="bento">
          <div className="bc w">
            <h3>Canjes</h3><p>El usado entra en parte de pago, con batería, calidad y costo real.</p>
            <div className="shot"><img src="/assets/a2/c-canjes.webp" width="1440" height="720" alt="Listado de canjes con equipos recibidos y entregados, diferencia y estado de cada operación." loading="lazy" decoding="async" /></div>
          </div>
          <div className="bc n">
            <h3>Servicio técnico</h3><p>Cada orden en su estado, hasta que el cliente retira el equipo.</p>
            <div className="ph"><img src="/assets/a2/c-servicio.webp" width="780" height="1558" alt="Órdenes de servicio técnico en el celular, organizadas por estado de reparación." loading="lazy" decoding="async" /></div>
          </div>
          <div className="bc n">
            <h3>Dólar blue al día</h3><p>Precios en dólares y en pesos con la cotización del momento.</p>
            <div className="ph"><img src="/assets/a2/m-dolar.webp" width="780" height="1688" alt="Pantalla de ventas móvil con la cotización del dólar blue para compra y venta." loading="lazy" decoding="async" /></div>
          </div>
          <div className="bc w">
            <h3>Clientes</h3><p>El saldo y el historial de pagos de cada cliente.</p>
            <div className="shot"><img src="/assets/a2/c-clientes.webp" width="2280" height="600" alt="Clientes de iManager con sus datos de contacto, última compra y saldo de cuenta corriente." loading="lazy" decoding="async" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HowToStart() {
  return (
    <section className="sec2" id="como" aria-labelledby="steps-title">
      <div className="wrap">
        <h2 className="t2" id="steps-title">Empezá hoy,<br />en tres pasos.</h2>
        <ol className="st3">
          <li className="sp"><b aria-hidden="true">1</b><h3>Creá tu tienda</h3><p>Con tu mail o tu cuenta de Google. Nombre, moneda y listo.</p></li>
          <li className="sp"><b aria-hidden="true">2</b><h3>Importá tu planilla</h3><p>Subí tu Excel o CSV, o pegá tu lista, y tus equipos quedan cargados con su IMEI.</p></li>
          <li className="sp"><b aria-hidden="true">3</b><h3>Vendé y canjeá</h3><p>Desde la compu del mostrador o el celular. Sumá a tu equipo cuando quieras.</p></li>
        </ol>
      </div>
    </section>
  );
}

function ContactLink({ className, children }: { className?: string; children: ReactNode }) {
  return <a className={className} href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export function Beta() {
  return (
    <section className="sec2" id="beta" aria-label="Beta y contacto">
      <div className="wrap"><div className="duo">
        <div className="dc g">
          <span className="eyebrow">Beta</span><h2>Gratis durante la <br /><span className="mk">beta</span>.</h2>
          <p>Probá iManager con tu propio stock y todas las funciones.</p>
          <a className="btn p" href={APP_URL}>Empezar gratis</a>
        </div>
        <div className="dc k">
          <h2>Contanos qué te <br />falta.</h2><p>Estamos en beta y armamos iManager con lo que nos cuentan las tiendas. Escribinos por WhatsApp.</p>
          <ContactLink className="btn l">
            <svg aria-hidden="true" className="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
            Contanos
          </ContactLink>
        </div>
      </div></div>
    </section>
  );
}

export function FinalCta() {
  return <section className="fin2" aria-labelledby="final-title"><div className="wrap">
    <h2 id="final-title">Todo tu negocio, en <span className="mk">una sola pieza</span>.</h2>
    <div className="cta"><a className="btn p" href={APP_URL}>Empezar gratis</a><a className="btn" href={APP_URL}>Ya tengo cuenta</a></div>
  </div></section>;
}

export function Footer() {
  return <footer className="wrap"><div className="foot">
    <a href="/" aria-label="iManager, inicio"><img src="/assets/logotipo-horizontal.svg" width="241" height="64" alt="iManager" /></a>
    <div className="r"><a href={APP_URL}>Entrar</a><ContactLink>Contanos</ContactLink><a href="mailto:hola@imanager.com.ar">hola@imanager.com.ar</a></div>
  </div></footer>;
}
