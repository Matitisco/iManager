import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { APP_URL, FEATURES, LAYERS, SIGNUP_URL, STATES, type LayerKey } from '../content';
import { Icon } from '../Icon';
import { MOBILE_HERO_QUERY, PORTRAIT_HERO_QUERY, REDUCED_MOTION_QUERY, useMedia } from '../useMedia';
import { Placa } from './Placa';
import {
  EDGE_DEPTH,
  MOB_VH,
  REF_H,
  REF_W,
  fitMobileScale,
  layerZ,
  phoneBounds,
  phoneBox,
  planeTransform,
  pose,
  projectAnchor,
  showTagsAt,
  stateIndex,
  type Box,
  type Pose,
  type PoseFit,
  type StageGeom,
} from './pose';

const MOBILE_LAYERS: LayerKey[] = ['carcasa', 'placa', 'pantalla'];
const MOBILE_RAIL_TARGETS = [0.12, 0.5, 0.92];
const REDUCED_P_DESKTOP = 0.28;
const TAG_W_DESKTOP = 200;
const TAG_H = 32;
/** Aire entre el teléfono y lo que lo rodea (copy, nav, bordes). */
const MOB_GAP = 20;
/** Lugar reservado abajo para los indicadores de progreso mobile. */
const MOB_RAIL_SPACE = 40;
const MOB_K_MAX = 1.15;
/** Poses representativas del recorrido desktop para calcular la caja que ocupa el teléfono con sus etiquetas. */
const DESKTOP_SAMPLE_P = [0, 0.15, 0.3, 0.95];
const PORTRAIT_GAP = 16;
const PORTRAIT_BOTTOM = 28;
const PORTRAIT_RAIL_SPACE = 56;
const MAX_SPREAD = 1.9;
const MAX_WHOLE = 1.4;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function Hero() {
  const mob = useMedia(MOBILE_HERO_QUERY);
  const portrait = useMedia(PORTRAIT_HERO_QUERY);
  const reduce = useMedia(REDUCED_MOTION_QUERY);

  const heroRef = useRef<HTMLElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const vhRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<HTMLDivElement>(null);
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
    const copy = copyRef.current!;
    const stage = stageRef.current!;
    const rig = rigRef.current!;
    const ph = phRef.current!;
    const visible = LAYERS.map((l, i) => ({ ...l, i })).filter((l) => !mob || MOBILE_LAYERS.includes(l.key));
    const visibleIdx = visible.map((l) => l.i);
    const stageGeom: StageGeom = mob ? { w: 1, h: MOB_VH, mob } : { w: REF_W, h: REF_H, mob };

    /**
     * Layout mobile, en coordenadas del sticky. El teléfono arranca debajo del copy medido
     * (sea cual sea su alto: fuentes, escalado de texto del sistema, ancho) y termina centrado
     * entre la nav y los indicadores. Copy y teléfono suben juntos, así nunca se pisan.
     */
    const mobL = { tx: 0, navH: 62, copyBottom: 0, startTop: 0, endTop: 0, w: 0, tagW: 0 };
    const fit: PoseFit = {};
    const RESTING_P = mob ? 1 : REDUCED_P_DESKTOP;

    let lastSi = -1;
    let lastTags: boolean | null = null;
    let lastPoseKey = '';

    const tagLayout = (ps: Pose) => {
      const pts = visible.map((l) => ({ key: l.key, ...projectAnchor(stageGeom, ps, l.i) })).sort((a, b) => a.y - b.y);
      let colX = Math.max(...pts.map((q) => q.x)) + (mob ? 18 : 70);
      if (mob) colX = Math.min(colX, mobL.w - 8 - mobL.tagW - mobL.tx);
      const minGap = mob ? 32 : 46;
      let last = -1e9;
      return {
        colX,
        rows: pts.map((q) => {
          last = Math.max(q.y, last + minGap);
          return { ...q, ty: last };
        }),
      };
    };

    const placeTags = (ps: Pose) => {
      const { colX, rows } = tagLayout(ps);
      for (const q of rows) {
        const tag = tagRefs.current[q.key];
        if (tag) tag.style.transform = `translate3d(${colX.toFixed(1)}px,${q.ty.toFixed(1)}px,0) translateY(-50%)`;
        pathRefs.current[q.key]?.setAttribute('d', `M${q.x.toFixed(1)} ${q.y.toFixed(1)}L${(colX - 18).toFixed(1)} ${q.ty.toFixed(1)}L${colX.toFixed(1)} ${q.ty.toFixed(1)}`);
        const dot = dotRefs.current[q.key];
        if (dot) {
          dot.setAttribute('cx', q.x.toFixed(1));
          dot.setAttribute('cy', q.y.toFixed(1));
        }
      }
    };

    /** Caja que ocupan teléfono + etiquetas a lo largo del recorrido desktop (coordenadas del escenario de referencia). */
    const desktopContentBox = (): Box => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of DESKTOP_SAMPLE_P) {
        const ps = pose(p, false, fit);
        const b = phoneBounds(stageGeom, ps, visibleIdx);
        x0 = Math.min(x0, b.x);
        y0 = Math.min(y0, b.y);
        x1 = Math.max(x1, b.x + b.w);
        y1 = Math.max(y1, b.y + b.h);
        if (showTagsAt(p, false)) {
          const { colX, rows } = tagLayout(ps);
          x1 = Math.max(x1, colX + TAG_W_DESKTOP);
          for (const r of rows) {
            y0 = Math.min(y0, r.ty - TAG_H / 2);
            y1 = Math.max(y1, r.ty + TAG_H / 2);
          }
        }
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    };

    const apply = (p: number) => {
      const ps = pose(p, mob, fit);
      for (const l of visible) {
        const z = layerZ(ps, l.i);
        const face = layerRefs.current[l.key];
        const edge = edgeRefs.current[l.key];
        if (face) face.style.transform = planeTransform(ps, z);
        if (edge) edge.style.transform = planeTransform(ps, z - EDGE_DEPTH);
      }
      if (mob && !reduce) {
        const f = clamp((p - 0.25) / 0.35, 0, 1);
        const top = mobL.startTop + (mobL.endTop - mobL.startTop) * f;
        const ty = top - phoneBounds(stageGeom, ps, visibleIdx).y;
        copy.style.opacity = String(1 - f);
        copy.style.transform = `translate3d(0,${(-f * Math.max(0, mobL.copyBottom - mobL.navH)).toFixed(2)}px,0)`;
        rig.style.transform = `translate3d(${mobL.tx.toFixed(1)}px,${ty.toFixed(2)}px,0)`;
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
      const key = `${ps.gap.toFixed(2)}|${ps.rx.toFixed(2)}|${ps.rz.toFixed(2)}|${ps.sc.toFixed(3)}|${stageGeom.w}|${mobL.tx}`;
      if (nextTags && key !== lastPoseKey) {
        lastPoseKey = key;
        placeTags(ps);
      }
    };

    const measureMobile = () => {
      const W = stick.offsetWidth;
      const H = stick.offsetHeight;
      const nav = document.querySelector<HTMLElement>('.nav');
      mobL.w = W;
      mobL.navH = nav ? nav.offsetHeight : 62;
      mobL.copyBottom = copy.offsetTop + copy.offsetHeight;
      mobL.tagW = Math.max(0, ...visible.map((l) => tagRefs.current[l.key]?.offsetWidth ?? 0));
      stageGeom.w = W;
      const availW = W - 16;
      if (reduce) {
        fit.k = fitMobileScale(stageGeom, visibleIdx, availW, Infinity, MOB_K_MAX);
      } else {
        const availH = H - MOB_RAIL_SPACE - mobL.navH - MOB_GAP;
        fit.k = fitMobileScale(stageGeom, visibleIdx, availW, availH, MOB_K_MAX);
      }
      const end = phoneBounds(stageGeom, pose(1, true, fit), visibleIdx);
      mobL.tx = end.x < 8 ? 8 - end.x : end.x + end.w > W - 8 ? W - 8 - (end.x + end.w) : 0;
      if (reduce) {
        stage.style.height = `${Math.ceil(end.h + 2 * MOB_GAP)}px`;
        rig.style.transform = `translate3d(${mobL.tx.toFixed(1)}px,${(MOB_GAP - end.y).toFixed(1)}px,0)`;
        return;
      }
      const regionTop = mobL.navH + MOB_GAP;
      const regionH = H - MOB_RAIL_SPACE - regionTop;
      mobL.startTop = mobL.copyBottom + MOB_GAP;
      mobL.endTop = regionTop + Math.max(0, (regionH - end.h) / 2);
    };

    const measureDesktop = () => {
      if (portrait) {
        const vh = vhRef.current?.offsetHeight || window.innerHeight;
        const copyBottom = copy.offsetTop + copy.offsetHeight;
        const Ws = stage.offsetWidth - PORTRAIT_RAIL_SPACE;
        const availH = vh - copyBottom - PORTRAIT_GAP - PORTRAIT_BOTTOM;
        fit.spread = 1;
        fit.whole = 1;
        fit.wholeDy = 0;
        let box = desktopContentBox();
        let k = clamp(Math.min(Ws / box.w, availH / box.h), 0.5, 1.8);
        for (let n = 0; n < 4 && box.h * k < availH - 4 && fit.spread < MAX_SPREAD; n++) {
          fit.spread = Math.min(MAX_SPREAD, fit.spread * (1 + (availH / (box.h * k) - 1) * 1.6));
          box = desktopContentBox();
          k = clamp(Math.min(Ws / box.w, availH / box.h), 0.5, 1.8);
        }
        const armed = phoneBounds(stageGeom, pose(0, false, { spread: fit.spread }), visibleIdx);
        fit.whole = clamp(Math.min((box.h * 0.9) / armed.h, (box.w * 0.8) / armed.w), 1, MAX_WHOLE);
        if (fit.whole > 1) {
          const big = phoneBounds(stageGeom, pose(0, false, { spread: fit.spread, whole: fit.whole }), visibleIdx);
          fit.wholeDy = box.y + box.h / 2 - (big.y + big.h / 2);
          box = desktopContentBox();
          k = clamp(Math.min(Ws / box.w, availH / box.h), 0.5, 1.8);
        }
        stick.style.height = `${Math.round(Math.min(vh, copyBottom + PORTRAIT_GAP + box.h * k + PORTRAIT_BOTTOM))}px`;
        const tx = (Ws - box.w * k) / 2 - box.x * k;
        const ty = PORTRAIT_GAP - box.y * k;
        rig.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
        return;
      }
      fit.spread = fit.whole = 1;
      fit.wholeDy = 0;
      stick.style.height = '';
      const Ws = stage.offsetWidth;
      const Hs = stage.offsetHeight;
      const k = clamp(Math.min(Ws / REF_W, Hs / REF_H), 0.5, 1.25);
      rig.style.transform = `translate(${((Ws - REF_W * k) / 2).toFixed(1)}px,${((Hs - REF_H * k) / 2).toFixed(1)}px) scale(${k.toFixed(4)})`;
    };

    const measure = () => {
      if (mob) measureMobile();
      else measureDesktop();
      rig.style.width = `${stageGeom.w}px`;
      rig.style.height = `${stageGeom.h}px`;
      const box = phoneBox(stageGeom);
      ph.style.left = `${box.left.toFixed(1)}px`;
      ph.style.top = `${box.top.toFixed(1)}px`;
      ph.style.perspective = `${box.persp}px`;
      ph.style.perspectiveOrigin = `${box.originX.toFixed(1)}px ${box.originY.toFixed(1)}px`;
      const rect = hero.getBoundingClientRect();
      geomRef.current = { top: rect.top + window.scrollY, total: Math.max(1, hero.offsetHeight - stick.offsetHeight) };
      lastPoseKey = '';
    };

    const progressNow = () => {
      const { top, total } = geomRef.current;
      const p = (window.scrollY - top) / total;
      return p < 0 ? 0 : p > 1 ? 1 : p;
    };

    const cleanup = () => {
      for (const el of [copy, rig, stick, stage, ph]) {
        el.style.transform = '';
        el.style.opacity = '';
        el.style.height = '';
      }
    };

    if (reduce) {
      const ro = new ResizeObserver(() => {
        measure();
        apply(RESTING_P);
      });
      measure();
      apply(RESTING_P);
      ro.observe(stick);
      ro.observe(copy);
      return () => {
        ro.disconnect();
        cleanup();
      };
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

    let sizeKey = '';
    const onResize = () => {
      const next = `${stick.offsetWidth}x${vhRef.current?.offsetHeight}|${copy.offsetHeight}|${stage.offsetWidth}x${stage.offsetHeight}|${hero.offsetHeight}`;
      if (next === sizeKey) {
        const rect = hero.getBoundingClientRect();
        geomRef.current.top = rect.top + window.scrollY;
        kick();
        return;
      }
      sizeKey = next;
      measure();
      apply(current < 0 ? progressNow() : current);
      kick();
    };

    measure();
    current = progressNow();
    apply(current);
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(hero);
    ro.observe(stick);
    ro.observe(copy);
    ro.observe(stage);
    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      cleanup();
    };
  }, [mob, portrait, reduce]);

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
        <div className="vhp" ref={vhRef} aria-hidden="true" />
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
            <div className="rig" ref={rigRef}>
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
