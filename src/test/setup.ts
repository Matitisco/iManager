import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const motionComponents = new Map<PropertyKey, React.ForwardRefExoticComponent<Record<string, unknown>>>();

const motionProxy = new Proxy(
  {},
  {
    get: (_target, tag) => {
      const cached = motionComponents.get(tag);
      if (cached) return cached;

      const motionOnlyProps = new Set([
        'animate',
        'exit',
        'initial',
        'layout',
        'transition',
        'whileHover',
        'whileTap',
        'whileDrag',
      ]);
      const Component = React.forwardRef<HTMLElement, Record<string, unknown>>(
        ({ children, ...props }, ref) => {
          const forwardedProps = Object.fromEntries(
            Object.entries(props).filter(([key]) => !motionOnlyProps.has(key))
          );
          return React.createElement(tag as string, { ...forwardedProps, ref }, children as React.ReactNode);
        }
      );
      Component.displayName = `MockMotion(${String(tag)})`;
      motionComponents.set(tag, Component);
      return Component;
    },
  }
);

vi.mock('motion/react', () => ({
  useReducedMotion: () => false,
  useIsPresent: () => true,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: motionProxy,
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
  }

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  });

  window.alert = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});
