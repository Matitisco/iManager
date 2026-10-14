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
/** Grosor mínimo entre capas: evita z-fighting en Safari cuando el teléfono está entero. */
export const LAYER_BASE = 1.5;

export function pose(p: number, mob: boolean): Pose {
  const G = mob ? 62 : 92;
  let gap: number, rx: number, rz: number, sc = 1;
  if (mob) {
    gap = lerp(0, G, smooth((p - 0.15) / 0.5));
    const t = smooth((p - 0.1) / 0.5);
    rx = lerp(14, 56, t);
    rz = lerp(-8, -24, t);
    sc = 0.6;
  } else if (p < 0.1) {
    gap = 0;
    rx = 12;
    rz = -10;
  } else if (p < 0.2) {
    const t = smooth((p - 0.1) / 0.1);
    sc = lerp(1, 0.8, t);
    gap = lerp(0, G * 0.55, t);
    rx = lerp(12, 56, t);
    rz = lerp(-10, -34, t);
  } else if (p < 0.9) {
    gap = lerp(G * 0.55, G, smooth((p - 0.2) / 0.08));
    rx = 56;
    rz = -34;
    sc = 0.8;
  } else {
    const u = smooth((p - 0.9) / 0.08);
    gap = lerp(G, 0, u);
    rx = lerp(56, 10, u);
    rz = lerp(-34, -8, u);
    sc = lerp(0.8, 1, u);
  }
  return { gap, rx, rz, sc, dy: gap * (mob ? 1.4 : 1.9) };
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

/** Caja del teléfono dentro del escenario y punto de fuga (50 % / 40 % del escenario). */
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

/**
 * Proyecta el punto de anclaje de la etiqueta de una capa (borde derecho, 46 % de alto)
 * a coordenadas 2D del escenario, replicando `planeTransform` bajo la perspectiva del teléfono.
 * Evita leer el layout (getBoundingClientRect) en cada frame.
 */
export function projectAnchor(g: StageGeom, ps: Pose, layerIndex: number): { x: number; y: number } {
  const box = phoneBox(g);
  const persp = box.persp;
  const cx = box.left + PHONE_W / 2;
  const cy = box.top + PHONE_H / 2;
  const lx = PHONE_W / 2;
  const ly = PHONE_H * 0.46 - PHONE_H / 2;
  const lz = layerIndex * (ps.gap + LAYER_BASE);

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

  const X = cx + x1;
  const Y = cy + y2 + ps.dy;
  const px = box.left + box.originX;
  const py = box.top + box.originY;
  const k = persp / (persp - z2);
  return { x: px + (X - px) * k, y: py + (Y - py) * k };
}
