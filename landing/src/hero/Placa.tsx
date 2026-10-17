/** Contorno de la placa (coordenadas del teléfono, 270×560): deja libre la esquina de las cámaras. */
export const PLACA_PATH =
  'M134 30H220Q244 30 244 54V274Q244 298 220 298H50Q26 298 26 274V146Q26 122 50 122H90Q110 122 110 102V54Q110 30 134 30Z';

/** Pasivos SMD: posiciones fijas (pseudoaleatorias con semilla) para que la placa se vea igual siempre. */
const PASSIVES = (() => {
  const out: { x: number; y: number; w: number; h: number; c: string }[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const zones: [number, number, number, number, number][] = [
    [118, 150, 120, 14, 18],
    [36, 222, 84, 52, 22],
    [124, 220, 112, 10, 14],
    [212, 60, 26, 80, 12],
    [36, 132, 70, 10, 8],
  ];
  for (const [x, y, w, h, n] of zones) {
    for (let i = 0; i < n; i++) {
      const v = rnd() > 0.5;
      out.push({ x: x + rnd() * w, y: y + rnd() * h, w: v ? 2.2 : 4.4, h: v ? 4.4 : 2.2, c: rnd() > 0.35 ? '#A88C5E' : '#2E3033' });
    }
  }
  return out;
})();

function Shield({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const dots = [];
  for (let i = 1; i * 9 < w - 4; i++) for (let j = 1; j * 9 < h - 4; j++) dots.push(<circle key={`${i}-${j}`} cx={x + i * 9} cy={y + j * 9} r="0.9" />);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="url(#pl-shield)" stroke="#6E737B" strokeWidth=".8" />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="2" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth=".6" />
      <g fill="rgba(60,64,70,.35)">{dots}</g>
    </g>
  );
}

function Connector({ x, y, w }: { x: number; y: number; w: number }) {
  const pins = [];
  for (let px = x + 3; px < x + w - 2; px += 3) pins.push(<rect key={px} x={px} y={y + 2} width="1.4" height="8" fill="#C9A44E" />);
  return (
    <g>
      <rect x={x} y={y} width={w} height="12" rx="1.5" fill="#141518" stroke="#2C2E33" strokeWidth=".6" />
      {pins}
    </g>
  );
}

const Screw = ({ x, y }: { x: number; y: number }) => (
  <g>
    <circle cx={x} cy={y} r="5.5" fill="#C9A44E" />
    <circle cx={x} cy={y} r="3.2" fill="url(#pl-screw)" />
    <path d={`M${x - 1.8} ${y}h3.6M${x} ${y - 1.8}v3.6`} stroke="#4A4E55" strokeWidth=".8" />
  </g>
);

/** Placa lógica: PCB apilada con blindajes, SoC, conectores y pasivos. */
export function Placa() {
  return (
    <svg viewBox="0 0 270 560" width="270" height="560" className="placa-svg" aria-hidden="true">
      <defs>
        <linearGradient id="pl-pcb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#173126" />
          <stop offset=".55" stopColor="#10241B" />
          <stop offset="1" stopColor="#0B1912" />
        </linearGradient>
        <linearGradient id="pl-shield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E4E6E9" />
          <stop offset=".35" stopColor="#B4B8BE" />
          <stop offset=".6" stopColor="#D5D8DC" />
          <stop offset="1" stopColor="#8E939A" />
        </linearGradient>
        <linearGradient id="pl-soc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3A3D42" />
          <stop offset="1" stopColor="#141518" />
        </linearGradient>
        <radialGradient id="pl-screw">
          <stop offset="0" stopColor="#D9DCE0" />
          <stop offset="1" stopColor="#7E838A" />
        </radialGradient>
      </defs>
      <path className="pcb" d={PLACA_PATH} fill="url(#pl-pcb)" stroke="#2A4A3B" strokeWidth="1.2" />
      <g stroke="#21463A" strokeWidth="1" fill="none" opacity=".9">
        <path d="M118 146h50l8 8h56M40 214h40l10-10h20M122 214v-8h40M200 214l12 12h22M60 286h60l8-8h80" />
        <path d="M232 60v40l-8 8v30M120 40v18" />
      </g>
      {/* SoC con su RAM apilada (sin blindaje) */}
      <rect x="132" y="46" width="72" height="72" rx="6" fill="#0E0F11" />
      <rect x="138" y="52" width="60" height="60" rx="4" fill="url(#pl-soc)" stroke="#4A4E55" strokeWidth=".6" />
      <rect x="140" y="54" width="56" height="20" rx="2" fill="rgba(255,255,255,.05)" />
      <rect x="160" y="64" width="16" height="16" rx="4" fill="none" stroke="#6E737B" strokeWidth="1.2" />
      <rect x="165" y="69" width="6" height="6" rx="1.5" fill="#FFD000" opacity=".9" />
      <text x="168" y="98" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="6.5" fill="#8B9096" letterSpacing="1">IM-1</text>
      <Shield x={40} y={146} w={70} h={64} />
      <Shield x={124} y={164} w={110} h={44} />
      <Shield x={208} y={44} w={28} h={74} />
      <rect x="44" y="232" width="34" height="26" rx="2" fill="#16171A" stroke="#33363B" strokeWidth=".6" />
      <rect x="84" y="236" width="22" height="18" rx="2" fill="#1C1D20" />
      <Connector x={128} y={226} w={54} />
      <Connector x={188} y={226} w={42} />
      <Connector x={60} y={268} w={46} />
      <Connector x={150} y={270} w={66} />
      <g>
        {PASSIVES.map((c, i) => <rect key={i} x={c.x.toFixed(1)} y={c.y.toFixed(1)} width={c.w} height={c.h} rx=".5" fill={c.c} />)}
      </g>
      <g fill="#C9A44E">
        <circle cx="122" cy="132" r="1.8" />
        <circle cx="128" cy="132" r="1.8" />
        <circle cx="116" cy="258" r="1.8" />
        <circle cx="224" cy="258" r="1.8" />
      </g>
      <Screw x={40} y={284} />
      <Screw x={230} y={284} />
      <Screw x={124} y={42} />
    </svg>
  );
}

/** Canto de la placa: misma silueta, para el borde extruido. */
export function PlacaEdge() {
  return (
    <svg viewBox="0 0 270 560" width="270" height="560" className="placa-svg" aria-hidden="true">
      <path d={PLACA_PATH} fill="#0A1410" stroke="#1C3A2D" strokeWidth="1" />
    </svg>
  );
}
