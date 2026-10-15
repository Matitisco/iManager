import { STATES } from '../content';

export interface Pose {
  /** Separación en Z entre capas consecutivas (px). */
  gap: number;
  rx: number;
  rz: number;
  sc: number;
  /** Desplazamiento vertical del teléfono para compensar la altura de la pila (px). */
  dy: number;
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export const PHONE_W = 270;
export const PHONE_H = 560;

/**
 * Reposo (scroll 0) que el CSS pinta antes de que corra el JS.
 * Si se cambia la fórmula, hay que actualizar las mismas constantes en styles.css
 * (--hero-k, --hero-tx, --hero-by y los transform de .plane).
 */
export const REST_RX = 12;
export const REST_RZ = -10;
export function mobileRestK(width: number): number {
  return Math.min(1.15, 1.0358 + (width - 340) * 0.002719);
}
export function mobileRestTx(width: number): number {
  return width >= 382 ? Math.max(0, (410 - width) * 0.511) : 20.6 - (width - 320) * 0.0917;
}
export function mobileRestBy(width: number): number {
  return Math.max(62.62, 72.03 - (width - 360) * 0.455);
}
/** Grosor mínimo entre capas: evita z-fighting en Safari cuando el teléfono está entero. */
export const LAYER_BASE = 1.5;
export const EDGE_DEPTH = 7;

/** Alto virtual del escenario mobile: la posición vertical real se resuelve con la caja proyectada. */
export const MOB_VH = 560;

export interface PoseFit {
  /** Escala del teléfono mobile (tamaño y separación) para que entre en pantallas chicas. */
  k?: number;
  /** Desktop: agranda la separación cuando sobra alto (la explosión crece en vertical, no en ancho). */
  spread?: number;
  /** Desktop: escala del teléfono armado (inicio y cierre) para que no quede chico en ese mismo espacio. */
  whole?: number;
  /** Desktop: corrimiento vertical del teléfono armado para centrarlo en el lugar disponible. */
  wholeDy?: number;
}

/** En mobile `dy` es 0: la ubicación vertical se resuelve con la caja proyectada. */
export function pose(p: number, mob: boolean, fit: PoseFit = {}): Pose {
  const { k = 1, spread = 1, whole = 1, wholeDy = 0 } = fit;
  if (mob) {
    const t = smooth((p - 0.1) / 0.5);
    return {
      gap: lerp(0, 62 * k, smooth((p - 0.15) / 0.5)),
      rx: lerp(14, 56, t),
      rz: lerp(-8, -24, t),
      sc: 0.6 * k,
      dy: 0,
    };
  }
  const G = 92 * spread;
  let gap: number, rx: number, rz: number, sc = whole;
  if (p < 0.1) {
    gap = 0;
    rx = 12;
    rz = -10;
  } else if (p < 0.2) {
    const t = (p - 0.1) / 0.1;
    sc = lerp(whole, 0.8, t);
    gap = lerp(0, G * 0.55, t);
    rx = lerp(12, 54, t);
    rz = lerp(-10, -32, t);
  } else if (p < 0.9) {
    gap = lerp(G * 0.55, G, (p - 0.2) / 0.08);
    rx = 56;
    rz = -34;
    sc = 0.8;
  } else {
    const u = (p - 0.9) / 0.08;
    gap = lerp(G, 0, u);
    rx = lerp(56, 10, u);
    rz = lerp(-34, -8, u);
    sc = lerp(0.8, whole, u);
  }
  return { gap, rx, rz, sc, dy: gap * 1.9 + wholeDy * (1 - gap / G) };
}

export function stateIndex(p: number, mob: boolean): number {
  if (mob) return p < 0.3 ? 0 : p < 0.75 ? 1 : 2;
  for (let i = 0; i < STATES.length; i++) if (p < STATES[i].b) return i;
  return STATES.length - 1;
}

export const showTagsAt = (p: number, mob: boolean) => (mob ? p > 0.55 : p >= 0.2 && p < 0.9);

export interface StageGeom {
  w: number;
  h: number;
  mob: boolean;
}

const D2R = Math.PI / 180;

/** Caja del teléfono dentro del escenario y su punto de fuga. */
export function phoneBox(g: StageGeom) {
  const left = g.w * (g.mob ? 0.52 : 0.44) - 170;
  const top = g.h * (g.mob ? 0.46 : 0.54) - PHONE_H / 2;
  return {
    persp: g.mob ? 1500 : 2200,
    left,
    top,
    originX: g.w * 0.5 - left,
    originY: g.h * 0.4 - top,
  };
}

/** Transformación completa de un plano (cara o borde) ubicado a `z` px sobre la carcasa. */
export function planeTransform(ps: Pose, z: number): string {
  return `translate3d(0,${ps.dy.toFixed(2)}px,0) rotateX(${ps.rx.toFixed(3)}deg) rotateZ(${ps.rz.toFixed(3)}deg) scale(${ps.sc.toFixed(4)}) translate3d(0,0,${z.toFixed(2)}px)`;
}

export const layerZ = (ps: Pose, i: number) => i * (ps.gap + LAYER_BASE);

/**
 * Proyecta un punto local del teléfono (relativo a su centro) a coordenadas 2D del escenario,
 * replicando `planeTransform` bajo la perspectiva del teléfono. Evita leer layout en cada frame.
 */
export function projectPoint(g: StageGeom, ps: Pose, lx: number, ly: number, lz: number): { x: number; y: number } {
  const box = phoneBox(g);
  const sx = lx * ps.sc;
  const sy = ly * ps.sc;
  const cz = Math.cos(ps.rz * D2R);
  const sz = Math.sin(ps.rz * D2R);
  const x1 = sx * cz - sy * sz;
  const y1 = sx * sz + sy * cz;
  const cxr = Math.cos(ps.rx * D2R);
  const sxr = Math.sin(ps.rx * D2R);
  const y2 = y1 * cxr - lz * sxr;
  const z2 = y1 * sxr + lz * cxr;
  const X = box.left + PHONE_W / 2 + x1;
  const Y = box.top + PHONE_H / 2 + y2 + ps.dy;
  const px = box.left + box.originX;
  const py = box.top + box.originY;
  const k = box.persp / (box.persp - z2);
  return { x: px + (X - px) * k, y: py + (Y - py) * k };
}

/** Anclaje de la etiqueta de una capa: borde derecho, 46 % de alto. */
export const projectAnchor = (g: StageGeom, ps: Pose, layerIndex: number) =>
  projectPoint(g, ps, PHONE_W / 2, PHONE_H * 0.46 - PHONE_H / 2, layerZ(ps, layerIndex));

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Caja proyectada (en coordenadas del escenario) de las capas indicadas, cara y borde incluidos. */
export function phoneBounds(g: StageGeom, ps: Pose, layerIndexes: number[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const hx = PHONE_W / 2;
  const hy = PHONE_H / 2;
  for (const i of layerIndexes) {
    const z = layerZ(ps, i);
    for (const lz of [z, z - EDGE_DEPTH]) {
      for (const [lx, ly] of [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]) {
        const q = projectPoint(g, ps, lx, ly, lz);
        if (q.x < x0) x0 = q.x;
        if (q.x > x1) x1 = q.x;
        if (q.y < y0) y0 = q.y;
        if (q.y > y1) y1 = q.y;
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Escala `k` del teléfono mobile para que la vista explotada entre en `availW × availH`. */
export function fitMobileScale(g: StageGeom, layerIndexes: number[], availW: number, availH: number, kMax: number): number {
  let k = 1;
  for (let n = 0; n < 4; n++) {
    const b = phoneBounds(g, pose(1, true, { k }), layerIndexes);
    k *= Math.min(availW / b.w, availH / b.h);
  }
  return Math.max(0.5, Math.min(kMax, k));
}
