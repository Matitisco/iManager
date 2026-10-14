import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { APP_URL, FEATURES, LAYERS, SIGNUP_URL, STATES, type LayerKey } from '../content';
import { Icon } from '../Icon';
import { MOBILE_HERO_QUERY, REDUCED_MOTION_QUERY, useMedia } from '../useMedia';
import { Placa } from './Placa';
import { LAYER_BASE, phoneBox, planeTransform, pose, projectAnchor, showTagsAt, stateIndex, type Pose, type StageGeom } from './pose';

const MOBILE_LAYERS: LayerKey[] = ['carcasa', 'placa', 'pantalla'];
const MOBILE_RAIL_TARGETS = [0.12, 0.5, 0.92];
const REDUCED_P_DESKTOP = 0.28;
const TAG_W_MOBILE = 186;
const EDGE_DEPTH = 7;

export function Hero() {
  const mob = useMedia(MOBILE_HERO_QUERY);
  const reduce = useMedia(REDUCED_MOTION_QUERY);

  const heroRef = useRef<HTMLElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const layerRefs = useRef<Partial<Record<LayerKey, HTMLDivElement | null>>>({});
  const edgeRefs = useRef<Partial<Record<LayerKey, HTMLDivElement | null>>>({});
  const tagRefs = useRef<Partial<Record<LayerKey, HTMLDivElement | null>>>({});
  const pathRefs = useRef<Partial<Record<LayerKey, SVGPathElement | null>>>({});
  const dotRefs = useRef<Partial<Record<LayerKey, SVGCircleElement | null>>>({});
  const geomRef = useRef({ top: 0, total: 1 });

  const [si, setSi] = useState(0);
  const [tagsOn, setTagsOn] = useState(false);

  useLayoutEffect(() => {
    const hero = heroRef.current!;
    const stick = stickRef.current!;
    const stage = stageRef.current!;
    const ph = phRef.current!;
    const visible = LAYERS.map((l, i) => ({ ...l, i })).filter((l) => !mob || MOBILE_LAYERS.includes(l.key));
    const stageGeom: StageGeom = { w: 1, h: 1, mob };

    let lastSi = -1;
    let lastTags: boolean | null = null;
    let lastPoseKey = '';
    let lastW = 0;
    let lastH = 0;

    const placeTags = (ps: Pose) => {
      const pts = visible.map((l) => ({ key: l.key, ...projectAnchor(stageGeom, ps, l.i) })).sort((a, b) => a.y - b.y);
      let colX = Math.max(...pts.map((q) => q.x)) + (mob ? 18 : 70);
      if (mob) colX = Math.min(colX, stageGeom.w - TAG_W_MOBILE);
      const minGap = mob ? 32 : 46;
      let last = -1e9;
      for (const q of pts) {
        const y = Math.max(q.y, last + minGap);
        last = y;
        const tag = tagRefs.current[q.key];
        if (tag) tag.style.transform = `translate3d(${colX.toFixed(1)}px,${y.toFixed(1)}px,0) translateY(-50%)`;
        pathRefs.current[q.key]?.setAttribute('d', `M${q.x.toFixed(1)} ${q.y.toFixed(1)}L${(colX - 18).toFixed(1)} ${y.toFixed(1)}L${colX.toFixed(1)} ${y.toFixed(1)}`);
        const dot = dotRefs.current[q.key];
        if (dot) {
          dot.setAttribute('cx', q.x.toFixed(1));
          dot.setAttribute('cy', q.y.toFixed(1));
        }
      }
    };

    const apply = (p: number) => {
      const ps = pose(p, mob);
      for (const l of visible) {
        const z = l.i * (ps.gap + LAYER_BASE);
        const face = layerRefs.current[l.key];
        const edge = edgeRefs.current[l.key];
        if (face) face.style.transform = planeTransform(ps, z);
        if (edge) edge.style.transform = planeTransform(ps, z - EDGE_DEPTH);
      }
      if (mob && !reduce) {
        const f = Math.max(0, Math.min(1, (p - 0.25) / 0.35));
        const copy = copyRef.current!;
        copy.style.opacity = String(1 - f);
        copy.style.transform = `translate3d(0,${(-40 * f).toFixed(2)}px,0)`;
        stage.style.transform = `translate3d(0,${(-215 * f).toFixed(2)}px,0)`;
      }
      if (hintRef.current) hintRef.current.style.opacity = p < 0.1 ? '1' : '0';
      if (barRef.current) barRef.current.style.transform = `scaleY(${p.toFixed(4)})`;

      const nextSi = reduce ? (mob ? 2 : 0) : stateIndex(p, mob);
      if (nextSi !== lastSi) {
        lastSi = nextSi;
        setSi(nextSi);
      }
      const nextTags = showTagsAt(p, mob);
      if (nextTags !== lastTags) {
        lastTags = nextTags;
        setTagsOn(nextTags);
      }
      const key = `${ps.gap.toFixed(2)}|${ps.rx.toFixed(2)}|${ps.rz.toFixed(2)}|${ps.sc.toFixed(3)}|${stageGeom.w}|${stageGeom.h}`;
      if (nextTags && key !== lastPoseKey) {
        lastPoseKey = key;
        placeTags(ps);
      }
    };

    const measure = () => {
      const rect = hero.getBoundingClientRect();
      geomRef.current = { top: rect.top + window.scrollY, total: Math.max(1, hero.offsetHeight - stick.offsetHeight) };
      stageGeom.w = stage.offsetWidth;
      stageGeom.h = stage.offsetHeight;
      const box = phoneBox(stageGeom);
      ph.style.perspective = `${box.persp}px`;
      ph.style.perspectiveOrigin = `${box.originX.toFixed(1)}px ${box.originY.toFixed(1)}px`;
    };

    const progressNow = () => {
      const { top, total } = geomRef.current;
      const p = (window.scrollY - top) / total;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    };

    if (reduce) {
      measure();
      apply(mob ? 1 : REDUCED_P_DESKTOP);
      const ro = new ResizeObserver(() => {
        measure();
        lastPoseKey = '';
        apply(mob ? 1 : REDUCED_P_DESKTOP);
      });
      ro.observe(stage);
      return () => ro.disconnect();
    }

    let current = -1;
    let target = 0;
    let raf = 0;
    let lastT = 0;

    const tick = (t: number) => {
      raf = 0;
      target = progressNow();
      const dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      if (current < 0) current = target;
      else current += (target - current) * (1 - Math.exp(-dt / 70));
      if (Math.abs(target - current) < 0.0002) current = target;
      apply(current);
      if (current !== target) raf = requestAnimationFrame(tick);
      else lastT = 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onResize = () => {
      if (stage.offsetWidth === lastW && stage.offsetHeight === lastH && geomRef.current.total > 1) {
        measure();
        kick();
        return;
      }
      lastW = stage.offsetWidth;
      lastH = stage.offsetHeight;
      measure();
      lastPoseKey = '';
      kick();
    };

    measure();
    current = progressNow();
    apply(current);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(hero);
    ro.observe(stage);
    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      for (const el of [copyRef.current, stage]) {
        if (el) {
          el.style.transform = '';
          el.style.opacity = '';
        }
      }
    };
  }, [mob, reduce]);

  const goTo = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (reduce) return;
    const { top, total } = geomRef.current;
    const s = STATES[i];
    const mid = mob ? MOBILE_RAIL_TARGETS[i] : (s.a + s.b) / 2;
    window.scrollTo({ top: top + mid * total, behavior: 'smooth' });
  };

  const active = mob ? undefined : STATES[si]?.layer;
  const capOn = (k: string) => (mob ? k === 'entero' : STATES[si]?.k === k);
  const shownLayers = LAYERS.filter((l) => !mob || MOBILE_LAYERS.includes(l.key));

  return (
    <section className="hero" id="hero" ref={heroRef} aria-label="iManager, pieza por pieza">
      <div className="stick" ref={stickRef}>
        <div className="in">
          <div className="copy" ref={copyRef}>
            <div className={`cap c-entero${capOn('entero') ? ' on' : ''}`}>
              <span className="kick"><i />Para tiendas de iPhone en Argentina</span>
              <h1 className="t1">
                Tu tienda de iPhone, ordenada <span className="hl">pieza por pieza</span>.
              </h1>
              <p className="l">Inventario por IMEI, ventas, canjes, servicio técnico y dólar blue en un solo lugar. Chau planillas.</p>
              <div className="ctas">
                <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
                <a className="btn s" href={APP_URL}>Entrar</a>
              </div>
              <div className="trust">Sin tarjeta · Lo armás en 5 minutos · Desde la compu o el celu</div>
            </div>
            <div className={`cap c-separando${capOn('separando') ? ' on' : ''}`} aria-hidden={!capOn('separando')}>
              <span className="kick"><i />Mirá adentro</span>
              <h2 className="t3 big">Todo lo que pasa en tu tienda, en cada pieza.</h2>
              <p className="l">Seguí bajando: cada capa del equipo es una parte de tu negocio.</p>
            </div>
            <div className={`cap c-capas${capOn('capas') ? ' on' : ''}`} aria-hidden={!capOn('capas')}>
              <span className="kick"><i />5 capas · 1 sistema</span>
              <h2 className="t3 big">Cada capa, una parte de tu negocio.</h2>
              <p className="l">Pantalla, marco, placa, batería y carcasa: ventas, precios, stock, reparaciones y canjes, conectados.</p>
            </div>
            {FEATURES.map((f) => (
              <div key={f.k} className={`cap c-${f.k}${capOn(f.k) ? ' on' : ''}`} aria-hidden={!capOn(f.k)}>
                <span className="kick"><i />{f.capa}</span>
                <h2 className="t3">
                  <span className="fic"><Icon name={f.icon} on /></span>
                  {f.title}
                </h2>
                <p className="l">{f.text}</p>
                <ul>{f.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                <div className="chip">
                  <Icon name={f.chipIcon} />
                  <span>
                    {f.chip.title}
                    <br />
                    <small>{f.chip.sub}</small>
                  </span>
                  {f.chip.pill && <span className="pill">{f.chip.pill}</span>}
                </div>
              </div>
            ))}
            <div className={`cap c-listo${capOn('listo') ? ' on' : ''}`} aria-hidden={!capOn('listo')}>
              <span className="kick"><i />Todo encaja</span>
              <h2 className="t1" style={{ fontSize: 58 }}>
                Todo tu negocio, en <span className="hl">una sola pieza</span>.
              </h2>
              <p className="l">Probalo gratis con tu propio stock. Si ya tenés cuenta, entrá directo.</p>
              <div className="ctas">
                <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
                <a className="btn s" href={APP_URL}>Entrar a app.imanager.com.ar</a>
              </div>
            </div>
          </div>

          <div className="stage" ref={stageRef} aria-hidden="true">
            <div className={`ph${active ? ' focus' : ''}`} ref={phRef}>
              {LAYERS.map((l) => (
                <Fragment key={l.key}>
                  <div className={`plane ${l.key}${active === l.key ? ' on' : ''}`} ref={(el) => { edgeRefs.current[l.key] = el; }}>
                    <div className="edge" />
                  </div>
                  <div className={`plane ly ${l.key}${active === l.key ? ' on' : ''}`} ref={(el) => { layerRefs.current[l.key] = el; }}>
                    <div className="face">
                      {l.key === 'carcasa' && (
                        <div className="isla"><span className="lens a" /><span className="lens b" /><span className="flash" /></div>
                      )}
                      {l.key === 'bateria' && (
                        <div className="bat"><span>BATERÍA</span><b>4.200</b><small>mAh · 100 %</small></div>
                      )}
                      {l.key === 'placa' && <Placa />}
                      {l.key === 'pantalla' && (<><div className="scr" /><span className="hole" /></>)}
                    </div>
                    {l.key === 'marco' && (<><span className="btn1" /><span className="btn2" /></>)}
                  </div>
                </Fragment>
              ))}
            </div>
            <div className={`tags${tagsOn ? ' show-tags' : ''}`}>
              <svg className="lines">
                {shownLayers.map((l) => (
                  <g key={l.key} className={active === l.key ? 'on' : undefined}>
                    <path ref={(el) => { pathRefs.current[l.key] = el; }} />
                    <circle r="3.5" ref={(el) => { dotRefs.current[l.key] = el; }} />
                  </g>
                ))}
              </svg>
              {shownLayers.map((l) => (
                <div key={l.key} className={`tag${active === l.key ? ' on' : ''}`} ref={(el) => { tagRefs.current[l.key] = el; }}>
                  <i />
                  {l.label} <small>· {l.area}</small>
                </div>
              ))}
            </div>
          </div>

          <nav className="rail" aria-label="Recorrido del hero">
            <span className="bar"><i ref={barRef} /></span>
            {STATES.map((s, i) => (
              <a key={s.k} href="#hero" className={i === si ? 'on' : i < si ? 'done' : undefined} onClick={goTo(i)}>
                <b />
                <span>{s.t}</span>
              </a>
            ))}
          </nav>
          <div className="scrollhint" ref={hintRef}><i />Bajá para desarmarlo</div>
        </div>
      </div>
    </section>
  );
}
