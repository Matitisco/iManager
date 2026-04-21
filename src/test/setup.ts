import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const motionProxy = new Proxy(
  {},
  {
    get: (_target, tag) => {
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
      return Component;
    },
  }
);

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  motion: motionProxy,
}));

(globalThis as typeof globalThis & {
  __IMANAGER_TEST_FIREBASE_ENV__?: Record<string, string>;
}).__IMANAGER_TEST_FIREBASE_ENV__ = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'imanager-test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'imanager-test',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:test',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_STORAGE_BUCKET: 'imanager-test.appspot.com',
  VITE_FIREBASE_MEASUREMENT_ID: '',
};

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
