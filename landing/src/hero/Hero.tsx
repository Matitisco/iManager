import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { APP_URL, LAYERS, SIGNUP_URL, STATES, TRIAL, type LayerKey } from '../content';
import { MOBILE_HERO_QUERY, REDUCED_MOTION_QUERY, useMedia } from '../useMedia';
import { Placa, PlacaEdge } from './Placa';
import {
  EDGE_DEPTHS,
  MOB_VH,
  fitMobileScale,
  layerZ,
  mobileRestBy,
  mobileRestK,
  mobileRestTx,
  phoneBounds,
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
const MOBILE_RAIL_TARGETS = [0.1, 0.35, 0.6, 0.88];
const REDUCED_P_DESKTOP = 0.55;
const TAG_W_DESKTOP = 200;
const TAG_H = 32;
/** Aire entre el teléfono y lo que lo rodea (copy, nav, bordes). */
const MOB_GAP = 20;
/** Lugar reservado abajo para los indicadores de progreso mobile. */
const MOB_RAIL_SPACE = 40;
const MOB_K_MAX = 1.15;
/** Poses representativas del recorrido desktop para calcular la caja que ocupa el teléfono con sus etiquetas. */
const DESKTOP_SAMPLE_P = [0, 0.28, 0.55, 0.95];
const MARCO_I = LAYERS.findIndex((l) => l.key === 'marco');
/** Sombra de contacto: plano detrás de la carcasa, más lejos cuanto más se abre el teléfono. */
const shadeZ = (ps: Pose) => -(18 + ps.gap * 0.6);
const MAX_SPREAD = 2;
/** Margen lateral mínimo (px de referencia) al recortar el escenario en columnas angostas. */
const SIDE_MIN = 24;
/** Alto sobrante que se deja como margen (el wireframe deja ≈20 % a 1440×900) antes de separar más las capas. */
const SPREAD_SLACK = 1.5;
/** Aire que queda arriba y abajo del contenido cuando el sticky se achica a su medida. */
const SHRINK_SLACK = 1.15;
/** Lo que el wireframe deja salir el teléfono por abajo (a 1280×800 la carcasa toca el borde). */
const V_OVERFLOW = 60;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export function Hero() {
  const mqMobile = useMedia(MOBILE_HERO_QUERY);
  const mqReduce = useMedia(REDUCED_MOTION_QUERY);

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
  const midRef = useRef<HTMLDivElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const tagRefs = useRef<Partial<Record<LayerKey, HTMLDivElement | null>>>({});
  const pathRefs = useRef<Partial<Record<LayerKey, SVGPathElement | null>>>({});
  const dotRefs = useRef<Partial<Record<LayerKey, SVGCircleElement | null>>>({});
  const geomRef = useRef({ top: 0, total: 1 });

  const [si, setSi] = useState(0);
  const [tagsOn, setTagsOn] = useState(false);

  useLayoutEffect(() => {
    const mob = window.matchMedia(MOBILE_HERO_QUERY).matches;
    const reduce = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const hero = heroRef.current!;
    const stick = stickRef.current!;
    const copy = copyRef.current!;
    const stage = stageRef.current!;
    const rig = rigRef.current!;
    const ph = phRef.current!;
    const visible = LAYERS.map((l, i) => ({ ...l, i })).filter((l) => !mob || MOBILE_LAYERS.includes(l.key));
    const visibleIdx = visible.map((l) => l.i);
    const stageGeom: StageGeom = { w: 1, h: mob ? MOB_VH : 1, mob };

    /**
     * Layout mobile, en coordenadas del sticky. El teléfono arranca debajo del copy medido
     * (sea cual sea su alto: fuentes, escalado de texto del sistema, ancho) y termina centrado
     * entre la nav y los indicadores. Copy y teléfono suben juntos, así nunca se pisan.
     */
    const mobL = { tx: 0, by: 0, navH: 62, copyBottom: 0, startTop: 0, endTop: 0, w: 0, tagW: 0 };
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
      const cssRest = p < 0.0008 && (mob ? !reduce : fit.whole === 1 && Math.abs(fit.wholeDy ?? 0) < 0.5);
      if (!mob && !reduce && p < 0.0008) rig.style.transform = '';
      if (cssRest) {
        for (const l of visible) {
          const face = layerRefs.current[l.key];
          const edge = edgeRefs.current[l.key];
          if (face) face.style.transform = '';
          if (edge) edge.style.transform = '';
        }
        if (midRef.current) midRef.current.style.transform = '';
        if (shadeRef.current) shadeRef.current.style.transform = '';
      } else {
        for (const l of visible) {
          const z = layerZ(ps, l.i);
          const face = layerRefs.current[l.key];
          const edge = edgeRefs.current[l.key];
          if (face) face.style.transform = planeTransform(ps, z);
          if (edge) edge.style.transform = planeTransform(ps, z - EDGE_DEPTHS[l.i]);
        }
        if (midRef.current) midRef.current.style.transform = planeTransform(ps, layerZ(ps, MARCO_I) - EDGE_DEPTHS[MARCO_I] / 2);
        if (shadeRef.current) shadeRef.current.style.transform = planeTransform(ps, shadeZ(ps));
      }
      if (mob && !reduce) {
        const f = clamp((p - 0.25) / 0.35, 0, 1);
        const desired = mobL.startTop + (mobL.endTop - mobL.startTop) * f;
        const by = phoneBounds(stageGeom, ps, visibleIdx).y;
        const ty = desired - mobL.startTop - (by - mobL.by);
        if (f === 0 && Math.abs(ty) < 0.4) {
          rig.style.transform = '';
          copy.style.opacity = '';
          copy.style.transform = '';
        } else {
          copy.style.opacity = String(1 - f);
          copy.style.transform = `translate3d(0,${(-f * Math.max(0, mobL.copyBottom - mobL.navH)).toFixed(2)}px,0)`;
          rig.style.transform = `translate3d(${mobL.tx.toFixed(2)}px,${ty.toFixed(2)}px,0)`;
        }
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
      stageGeom.w = stage.offsetWidth || W;
      stageGeom.h = MOB_VH;
      const availW = stageGeom.w - 16;
      if (reduce) {
        fit.k = fitMobileScale(stageGeom, visibleIdx, availW, Infinity, MOB_K_MAX);
      } else {
        fit.k = mobileRestK(stageGeom.w);
      }
      const end = phoneBounds(stageGeom, pose(1, true, fit), visibleIdx);
      mobL.tx = reduce ? (end.x < 8 ? 8 - end.x : end.x + end.w > stageGeom.w - 8 ? stageGeom.w - 8 - (end.x + end.w) : 0) : mobileRestTx(stageGeom.w);
      mobL.by = mobileRestBy(stageGeom.w);
      if (reduce) {
        stage.style.height = `${Math.ceil(end.h + 2 * MOB_GAP)}px`;
        rig.style.transform = `translate3d(${mobL.tx.toFixed(1)}px,${(MOB_GAP - end.y).toFixed(1)}px,0)`;
        return;
      }
      const regionTop = mobL.navH + MOB_GAP;
      const regionH = H - MOB_RAIL_SPACE - regionTop;
      mobL.startTop = stage.getBoundingClientRect().top - stick.getBoundingClientRect().top;
      mobL.endTop = regionTop + Math.max(0, (regionH - end.h) / 2);
    };

    /**
     * Desktop siempre en dos columnas: copy a la izquierda, teléfono a la derecha. Se ubica igual que
     * el wireframe (tamaño real del escenario, teléfono al 44 % / 54 %, sin escalar). Solo se achica si
     * no entra (columna angosta o pantalla baja) y, si sobra mucho alto, separa más las capas; si aun
     * así sobra, el sticky mide lo que el contenido para no dejar hueco antes de la sección siguiente.
     */
    const measureDesktop = () => {
      const vh = vhRef.current?.offsetHeight || window.innerHeight;
      const padTop = stage.offsetTop;
      const Ws = stage.offsetWidth;
      const HsMax = reduce ? stage.offsetHeight : vh - padTop;
      stageGeom.w = Ws;
      stageGeom.h = HsMax;
      fit.spread = fit.whole = 1;
      fit.wholeDy = 0;
      let box = desktopContentBox();
      const k = clamp(Math.min(1, (Ws - 2 * SIDE_MIN) / box.w, (HsMax + V_OVERFLOW) / box.h), 0.5, 1);
      const target = HsMax / (k * SPREAD_SLACK);
      for (let n = 0; n < 5 && box.h < target - 2 && fit.spread < MAX_SPREAD; n++) {
        fit.spread = Math.min(MAX_SPREAD, fit.spread * (1 + (target / box.h - 1) * 1.6));
        box = desktopContentBox();
      }
      const Hs = fit.spread >= MAX_SPREAD ? Math.min(HsMax, Math.max(box.h * k * SHRINK_SLACK, 440)) : HsMax;
      stick.style.height = Hs < HsMax - 1 ? `${Math.round(padTop + Hs)}px` : '';
      if (Hs !== HsMax) {
        stageGeom.h = Hs;
        box = desktopContentBox();
      }
      if (k < 1 || Hs < HsMax - 1) {
        const bw = box.w * k;
        const cx = clamp(box.x + box.w / 2, SIDE_MIN + bw / 2, Ws - SIDE_MIN - bw / 2);
        const cy = clamp(box.y + box.h / 2, box.h * k / 2, Hs - box.h * k / 2);
        const tx = cx - k * (box.x + box.w / 2);
        const ty = cy - k * (box.y + box.h / 2);
        rig.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${k.toFixed(4)})`;
      } else {
        rig.style.transform = '';
      }
    };

    const measure = () => {
      if (mob) measureMobile();
      else measureDesktop();
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
  }, [mqMobile, mqReduce]);

  const goTo = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const { top, total } = geomRef.current;
    const s = STATES[i];
    const mid = window.matchMedia(MOBILE_HERO_QUERY).matches ? MOBILE_RAIL_TARGETS[i] : (s.a + s.b) / 2;
    window.scrollTo({ top: top + mid * total, behavior: 'smooth' });
  };

  const active = STATES[si]?.layer;
  const capOn = (k: string) => STATES[si]?.k === k;
  const shownLayers = LAYERS;

  return (
    <section className="hero" id="hero" ref={heroRef} aria-label="iManager, pieza por pieza">
      <div className="stick" ref={stickRef}>
        <div className="vhp" ref={vhRef} aria-hidden="true" />
        <div className="in">
          <div className="copy" ref={copyRef}>
            <div className={`cap c-entero${capOn('entero') ? ' on' : ''}`}>
              <span className="kick">Para tiendas de iPhone en Argentina</span>
              <h1 className="t1">
                Tu tienda de iPhone, ordenada <span className="hl">pieza por pieza</span>.
              </h1>
              <p className="l">Inventario por IMEI, ventas, canjes, servicio técnico y dólar blue en un solo lugar.</p>
              <div className="ctas">
                <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
                <a className="btn s" href={APP_URL}>Entrar</a>
              </div>
              <div className="trust">{TRIAL} · Con tu mail o tu cuenta de Google</div>
            </div>
            <div className={`cap c-capas${capOn('capas') || capOn('piezas') ? ' on' : ''}`} aria-hidden={!(capOn('capas') || capOn('piezas'))}>
              <span className="kick">5 capas · 1 sistema</span>
              <h2 className="t3">Cada capa, una parte de tu negocio.</h2>
              <p className="l">Pantalla, marco, placa, batería y carcasa: ventas, precios, stock, reparaciones y canjes, conectados.</p>
            </div>
            <div className={`cap c-listo${capOn('listo') ? ' on' : ''}`} aria-hidden={!capOn('listo')}>
              <span className="kick">Todo encaja</span>
              <h2 className="t3">
                Todo tu negocio, en <span className="hl">una sola pieza</span>.
              </h2>
              <p className="l">Probalo gratis con tu propio stock. Si ya tenés cuenta, entrá directo.</p>
              <div className="ctas">
                <a className="btn p" href={SIGNUP_URL}>Probar gratis</a>
                <a className="btn s" href={APP_URL}>Entrar</a>
              </div>
              <div className="trust">{TRIAL}</div>
            </div>
          </div>

          <div className="stage" ref={stageRef} aria-hidden="true">
            <div className="rig" ref={rigRef}>
              <div className={`ph${active ? ' focus' : ''}`} ref={phRef}>
                <div className="shade" ref={shadeRef}><i /></div>
                {LAYERS.map((l) => (
                  <Fragment key={l.key}>
                    <div className={`plane ${l.key}${active === l.key ? ' on' : ''}`} ref={(el) => { edgeRefs.current[l.key] = el; }}>
                      <div className="edge">{l.key === 'placa' && <PlacaEdge />}</div>
                    </div>
                    {l.key === 'marco' && (
                      <div className={`plane mid marco${active === l.key ? ' on' : ''}`} ref={midRef}>
                        <div className="edge" />
                      </div>
                    )}
                    <div className={`plane ly ${l.key}${active === l.key ? ' on' : ''}`} ref={(el) => { layerRefs.current[l.key] = el; }}>
                      <div className="face">
                        {l.key === 'carcasa' && <Carcasa />}
                        {l.key === 'bateria' && <Bateria />}
                        {l.key === 'placa' && <Placa />}
                        {l.key === 'marco' && (<><i className="ant a1" /><i className="ant a2" /><i className="ant a3" /><i className="ant a4" /><i className="port" /></>)}
                        {l.key === 'pantalla' && <Pantalla />}
                      </div>
                      {l.key === 'marco' && (<><span className="glow" /><span className="sb act" /><span className="sb vup" /><span className="sb vdn" /><span className="sb pwr" /></>)}
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
              <a key={s.k} href="#hero" aria-label={s.t} className={i === si ? 'on' : i < si ? 'done' : undefined} onClick={goTo(i)}>
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

/** Interior de la carcasa trasera: módulos de cámara, bobina MagSafe con su anillo de imanes y tornillos. */
function Carcasa() {
  return (
    <>
      <div className="cams">
        <span className="cm a" />
        <span className="cm b" />
        <span className="cm c" />
        <span className="fl" />
        <span className="ld" />
      </div>
      <div className="coil"><i /></div>
      <span className="flex" />
      <span className="scw s1" />
      <span className="scw s2" />
      <span className="scw s3" />
    </>
  );
}

function Bateria() {
  return (
    <div className="bat">
      <span className="tab" />
      <div className="lbl">
        <b>Li-ion Polymer Battery</b>
        <span>3,87 V ⎓ 4.200 mAh · 16,25 Wh</span>
        <small>iManager</small>
      </div>
      <span className="pull p1" />
      <span className="pull p2" />
    </div>
  );
}

/** Pantalla encendida: la captura va en un img (prerender) y la Dynamic Island queda encima. */
function Pantalla() {
  return (
    <>
      <div className="scr">
        <div className="sbar">
          <b>9:41</b>
          <svg viewBox="0 0 64 12" width="54" height="10" aria-hidden="true">
            <g fill="#111214">
              <rect x="0" y="8" width="3" height="4" rx=".8" />
              <rect x="4.5" y="6" width="3" height="6" rx=".8" />
              <rect x="9" y="3.5" width="3" height="8.5" rx=".8" />
              <rect x="13.5" y="1" width="3" height="11" rx=".8" />
              <path d="M28 2.2a10 10 0 0 1 7.6 3.4l-1.4 1.4a8 8 0 0 0-12.4 0l-1.4-1.4A10 10 0 0 1 28 2.2zm0 3.8a6 6 0 0 1 4.4 1.9L31 9.3a4 4 0 0 0-6 0l-1.4-1.4A6 6 0 0 1 28 6zm0 3.6a2.4 2.4 0 0 1 1.6.7L28 12l-1.6-1.7a2.4 2.4 0 0 1 1.6-.7z" />
              <rect x="41" y="1.5" width="19" height="9" rx="2.6" fill="none" stroke="#111214" strokeOpacity=".4" />
              <rect x="42.6" y="3.1" width="13" height="5.8" rx="1.4" />
              <rect x="61" y="4.2" width="1.6" height="3.6" rx=".8" fillOpacity=".4" />
            </g>
          </svg>
        </div>
        <div className="app">
          <img src="/assets/app-mob-dashboard.png" alt="" width="780" height="1688" fetchPriority="high" decoding="async" />
        </div>
      </div>
      <span className="island" />
      <span className="glare" />
    </>
  );
}
