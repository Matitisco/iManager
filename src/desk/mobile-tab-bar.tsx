import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

export const MOBILE_TAB_INDICATOR_MS = 220;
export const MOBILE_TAB_INDICATOR_TRANSITION = `transform ${MOBILE_TAB_INDICATOR_MS}ms ease-out, width ${MOBILE_TAB_INDICATOR_MS}ms ease-out`;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type IndicatorFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function mobileTabIndicatorFrame(nav: Pick<DOMRect, 'left' | 'top'>, button: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>): IndicatorFrame {
  return {
    x: button.left - nav.left,
    y: button.top - nav.top,
    width: button.width,
    height: button.height,
  };
}

export function sameIndicatorFrame(current: IndicatorFrame, next: IndicatorFrame) {
  return Math.abs(current.x - next.x) < 0.5
    && Math.abs(current.y - next.y) < 0.5
    && Math.abs(current.width - next.width) < 0.5
    && Math.abs(current.height - next.height) < 0.5;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => window.matchMedia(REDUCED_MOTION_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const apply = () => setReduce(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);
  return reduce;
}

export type MobileTabButton = {
  id: string;
  label: string;
  active: boolean;
  pending: number;
  testId: string;
  icon: ReactNode;
  onClick: () => void;
};

export function MobileTabBar({ buttons }: { buttons: MobileTabButton[] }) {
  const navRef = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState<IndicatorFrame | null>(null);
  const [motionReady, setMotionReady] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const layoutKey = buttons.map((button) => `${button.id}:${button.active ? 1 : 0}:${button.pending}`).join('|');

  const measure = useCallback(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('button.on');
    if (!nav || !active) return;
    const next = mobileTabIndicatorFrame(nav.getBoundingClientRect(), active.getBoundingClientRect());
    setFrame((current) => (current && sameIndicatorFrame(current, next) ? current : next));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, layoutKey]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(nav);
    for (const button of nav.querySelectorAll('button')) observer.observe(button);
    return () => observer.disconnect();
  }, [measure, layoutKey]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  useEffect(() => {
    setMotionReady(!reduceMotion);
  }, [reduceMotion]);

  const animate = motionReady && !reduceMotion;

  return (
    <nav ref={navRef} className="mtab" data-testid="mobile-tab-bar" aria-label="Secciones">
      {frame ? (
        <span
          className={animate ? 'mtab-indicator' : 'mtab-indicator instant'}
          data-testid="mobile-tab-indicator"
          aria-hidden="true"
          style={{
            transform: `translateX(${frame.x}px)`,
            width: frame.width,
            top: frame.y,
            height: frame.height,
            transition: animate ? MOBILE_TAB_INDICATOR_TRANSITION : 'none',
          }}
        />
      ) : null}
      {buttons.map((button) => (
        <button
          key={button.id}
          className={button.active ? 'on' : ''}
          type="button"
          data-testid={button.testId}
          aria-label={button.label}
          aria-current={button.active ? 'page' : undefined}
          onClick={button.onClick}
        >
          {button.icon}
          <span className="mtab-label">{button.label}</span>
          {button.pending > 0 ? <span className="dcount" aria-label={`${button.pending} en ${button.label}`}>{button.pending}</span> : null}
        </button>
      ))}
    </nav>
  );
}
