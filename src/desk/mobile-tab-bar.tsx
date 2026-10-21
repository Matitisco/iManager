import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react';

export const MOBILE_TAB_INDICATOR_MS = 220;
export const MOBILE_TAB_INDICATOR_TRANSITION = `transform ${MOBILE_TAB_INDICATOR_MS}ms ease-out, width ${MOBILE_TAB_INDICATOR_MS}ms ease-out`;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const SLIDE_FALLBACK_MS = 1500;

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

export function clampIndicatorFrame(frame: IndicatorFrame, navWidth: number, navHeight: number): IndicatorFrame {
  const width = Math.max(0, Math.min(frame.width, navWidth));
  const height = Math.max(0, Math.min(frame.height, navHeight));
  return {
    x: Math.min(Math.max(0, frame.x), Math.max(0, navWidth - width)),
    y: Math.min(Math.max(0, frame.y), Math.max(0, navHeight - height)),
    width,
    height,
  };
}

function readIndicatorFrame(nav: HTMLElement) {
  const active = nav.querySelector<HTMLElement>('button.on');
  if (!active) return null;
  const navBox = nav.getBoundingClientRect();
  return clampIndicatorFrame(mobileTabIndicatorFrame(navBox, active.getBoundingClientRect()), navBox.width, navBox.height);
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
  pendingDescription?: string;
  testId: string;
  icon: ReactNode;
  onClick: () => void;
};

export function MobileTabBar({ buttons }: { buttons: MobileTabButton[] }) {
  const navRef = useRef<HTMLElement>(null);
  const lastFrame = useRef<IndicatorFrame | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const activeId = buttons.find((button) => button.active)?.id ?? '';
  const [trackedId, setTrackedId] = useState(activeId);
  const [sliding, setSliding] = useState(false);
  const [frame, setFrame] = useState<IndicatorFrame | null>(null);

  if (trackedId !== activeId) {
    const from = !reduceMotion ? lastFrame.current : null;
    setTrackedId(activeId);
    setSliding(Boolean(from));
    setFrame(from);
  }

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const to = readIndicatorFrame(nav);
    if (to) lastFrame.current = to;
    if (!sliding || !frame || !to || sameIndicatorFrame(frame, to)) {
      if (sliding) setSliding(false);
      return undefined;
    }
    const animation = window.requestAnimationFrame(() => setFrame(to));
    const timer = window.setTimeout(() => setSliding(false), SLIDE_FALLBACK_MS);
    return () => {
      window.cancelAnimationFrame(animation);
      window.clearTimeout(timer);
    };
    // `frame` is the origin captured for this section change. Updating it to the
    // destination must not re-run the effect, or the pill unmounts before it moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedId, sliding]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    let frameId = 0;
    const remember = () => {
      // Measuring and writing the pill inside the observer callback makes
      // WebKit throw "ResizeObserver loop completed with undelivered
      // notifications", which the commission suite treats as a page error.
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const next = readIndicatorFrame(nav);
        if (!next) return;
        lastFrame.current = next;
        // A resize during the slide (rotating, or a test narrowing the phone)
        // must pull the pill back inside the bar. Leaving the old translate
        // paints it past the viewport.
        if (sliding) setFrame((current) => current && !sameIndicatorFrame(current, next) ? next : current);
      });
    };
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(remember);
      observer.observe(nav);
    }
    window.addEventListener('resize', remember);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener('resize', remember);
    };
  }, [sliding, trackedId]);

  const finishSlide = (event: TransitionEvent<HTMLSpanElement>) => {
    if (event.propertyName !== 'transform') return;
    setSliding(false);
  };

  return (
    <nav ref={navRef} className={sliding ? 'mtab sliding' : 'mtab'} data-testid="mobile-tab-bar" aria-label="Secciones">
      {sliding && frame ? (
        <span
          className="mtab-indicator"
          data-testid="mobile-tab-indicator"
          aria-hidden="true"
          onTransitionEnd={finishSlide}
          style={{
            transform: `translateX(${frame.x}px)`,
            width: frame.width,
            top: frame.y,
            height: frame.height,
            transition: MOBILE_TAB_INDICATOR_TRANSITION,
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
          aria-describedby={button.pendingDescription ? `mobile-pending-${button.id}` : undefined}
          aria-current={button.active ? 'page' : undefined}
          onClick={button.onClick}
        >
          {button.icon}
          <span className="mtab-label">{button.label}</span>
          {button.pending > 0 ? <span className="dcount" aria-hidden="true">{button.pending}</span> : null}
          {button.pendingDescription ? <span className="mtab-description" id={`mobile-pending-${button.id}`}>{button.pendingDescription}</span> : null}
        </button>
      ))}
    </nav>
  );
}
