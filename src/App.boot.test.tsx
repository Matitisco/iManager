import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';
import { hideBootSplash } from './lib/boot-splash';

const state = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('./context/AppContext', () => ({ AppProvider: ({ children }: { children: ReactNode }) => children, useAppContext: () => state.value }));
vi.mock('./lib/boot-splash', () => ({ hideBootSplash: vi.fn() }));
vi.mock('./lib/use-auth-action', () => ({ useAuthActionLink: () => ({ link: null }) }));
vi.mock('./hooks/useInvitationPreview', () => ({ useInvitationPreview: () => ({}) }));
vi.mock('./desk/DeskApp', () => ({ DeskApp: () => <div>Tienda lista</div> }));
vi.mock('./pages/Login', () => ({ Login: () => <div>Ingresá</div> }));
vi.mock('./pages/Onboarding', () => ({ Onboarding: () => <div>Creá tu tienda</div> }));
vi.mock('./pages/OnboardingJourney', () => ({ OnboardingJourney: () => <div>Primeros pasos</div> }));
const session = { store: { id: 's' }, membership: { role: 'OWNER' }, onboardingRequired: false };
beforeEach(() => { sessionStorage.clear(); state.value = { user: null, loading: true, backendStatus: 'checking', appSession: null, listsSettled: false }; });
it('renders nothing behind the splash until auth, session and the initial lists have resolved', () => {
  const view = render(<App />);
  expect(view.container).toBeEmptyDOMElement();
  expect(hideBootSplash).not.toHaveBeenCalled();
  state.value = { ...state.value, user: { uid: 'u' }, loading: false };
  view.rerender(<App />);
  expect(view.container).toBeEmptyDOMElement();
  state.value = { ...state.value, appSession: session, backendStatus: 'ready' };
  view.rerender(<App />);
  expect(hideBootSplash).not.toHaveBeenCalled();
  state.value = { ...state.value, listsSettled: true };
  view.rerender(<App />);
  expect(screen.getByText('Tienda lista')).toBeInTheDocument();
  expect(hideBootSplash).toHaveBeenCalledTimes(1);
  state.value = { ...state.value, listsSettled: false };
  view.rerender(<App />);
  expect(screen.getByText('Tienda lista')).toBeInTheDocument();
});
it.each(['login', 'onboarding', 'journey'])('reveals %s directly without a loading screen', destination => {
  state.value = { ...state.value, loading: false, user: destination === 'login' ? null : { uid: 'u' }, backendStatus: 'ready', appSession: destination === 'login' ? null : { ...session, onboardingRequired: destination === 'onboarding', store: { ...session.store, onboardingStartedAt: destination === 'journey' ? 'today' : null } } };
  render(<App />);
  expect(screen.getByText(destination === 'login' ? 'Ingresá' : destination === 'onboarding' ? 'Creá tu tienda' : 'Primeros pasos')).toBeInTheDocument();
  expect(hideBootSplash).toHaveBeenCalledTimes(1);
});

it('permite entrar al dueño que salió de stock sin omitir la creación de tienda', () => {
  state.value = { ...state.value, loading: false, user: { uid: 'u' }, backendStatus: 'ready', listsSettled: true, stockOnboardingExited: true, appSession: { ...session, store: { ...session.store, onboardingStartedAt: 'today' } } };
  const view = render(<App />);
  expect(screen.getByText('Tienda lista')).toBeInTheDocument();
  state.value = { ...state.value, appSession: { onboardingRequired: true, store: null, membership: null } };
  view.rerender(<App />);
  expect(screen.getByText('Creá tu tienda')).toBeInTheDocument();
});
