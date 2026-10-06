import type { ReactNode } from 'react';

type IconProps = { size?: number };

function Glyph({ size = 22, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function IconGrid({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </Glyph>
  );
}

export function IconList({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M3.5 10h17M8 14.5h8" />
    </Glyph>
  );
}

export function IconCart({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M3 4h2.5l2 11h10.5l2-8H7" />
      <circle cx="9.5" cy="19" r="1.3" />
      <circle cx="17" cy="19" r="1.3" />
    </Glyph>
  );
}

export function IconChart({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M5 20V10M10 20V5M15 20v-7M20 20V8" />
    </Glyph>
  );
}

export function IconDots({ size }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </Glyph>
  );
}

export function IconBack() {
  return (
    <Glyph size={22}>
      <path d="M15 5l-7 7 7 7" />
    </Glyph>
  );
}

export function IconBell({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Glyph>
  );
}

export function IconSearch({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </Glyph>
  );
}

export function IconUp({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 15V4M7 8.5l5-5 5 5M5 20h14" />
    </Glyph>
  );
}

export function IconFilter({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />
    </Glyph>
  );
}

export function IconEdit({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </Glyph>
  );
}

export function IconTrash({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
    </Glyph>
  );
}

export function IconDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconSwap({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M7 7h12l-3-3M17 17H5l3 3" />
    </Glyph>
  );
}

export function IconUser({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Glyph>
  );
}

export function IconGear({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </Glyph>
  );
}

export function IconStore({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6" />
    </Glyph>
  );
}

export function IconLock({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Glyph>
  );
}

export function IconCard({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 10h18" />
    </Glyph>
  );
}

export function IconDownload({ size = 18 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />
    </Glyph>
  );
}

export function IconBox({ size = 22 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </Glyph>
  );
}
