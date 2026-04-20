import {
  createUserWithEmailAndPassword,
  onAuthStateChanged as onFirebaseAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import type { AuthUserLike } from '../types/auth-user';

type AuthListener = (user: AuthUserLike | null) => void;

export interface AuthAdapter {
  mode: 'firebase' | 'e2e';
  getCurrentUser: () => AuthUserLike | null;
  onAuthStateChanged: (callback: AuthListener) => () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface TestAuthPayload {
  uid: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

const TEST_AUTH_STORAGE_KEY = 'imanager:test-auth-user';
const TEST_AUTH_EVENT = 'imanager:test-auth-change';
const TEST_AUTH_DEFAULT_PASSWORD = import.meta.env.VITE_E2E_TEST_PASSWORD?.trim() || 'test123456';
const TEST_AUTH_DEFAULT_PICTURE =
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80';

function isE2ETestMode() {
  return import.meta.env.VITE_TEST_AUTH_MODE === 'e2e';
}

function toFirebaseCompatibleUser(user: User): AuthUserLike {
  return user;
}

function createTestToken(payload: TestAuthPayload) {
  return `test.${encodeURIComponent(JSON.stringify(payload))}`;
}

function buildTestUser(email: string): AuthUserLike {
  const normalizedEmail = email.trim().toLowerCase();
  const baseName = normalizedEmail.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Test User';
  const displayName = baseName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');

  const payload: TestAuthPayload = {
    uid: `test-${normalizedEmail.replace(/[^a-z0-9]+/gi, '-')}`,
    email: normalizedEmail,
    name: displayName,
    picture: TEST_AUTH_DEFAULT_PICTURE,
    emailVerified: true,
  };

  return {
    uid: payload.uid,
    email: payload.email,
    displayName: payload.name,
    photoURL: payload.picture,
    emailVerified: true,
    isAnonymous: false,
    tenantId: null,
    providerData: [
      {
        providerId: 'password',
        displayName: payload.name,
        email: payload.email,
        photoURL: payload.picture,
      },
    ],
    getIdToken: async () => createTestToken(payload),
  };
}

function readStoredTestUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TEST_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.email !== 'string') return null;
    return buildTestUser(parsed.email);
  } catch {
    return null;
  }
}

function persistTestUser(user: AuthUserLike | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    window.localStorage.removeItem(TEST_AUTH_STORAGE_KEY);
  } else {
    window.localStorage.setItem(TEST_AUTH_STORAGE_KEY, JSON.stringify({ email: user.email }));
  }
  window.dispatchEvent(new Event(TEST_AUTH_EVENT));
}

const firebaseAdapter: AuthAdapter = {
  mode: 'firebase',
  getCurrentUser: () => (auth.currentUser ? toFirebaseCompatibleUser(auth.currentUser) : null),
  onAuthStateChanged: (callback) => onFirebaseAuthStateChanged(auth, (user) => callback(user ? toFirebaseCompatibleUser(user) : null)),
  loginWithGoogle: async () => {
    await signInWithPopup(auth, googleProvider);
  },
  loginWithEmail: async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  },
  registerWithEmail: async (email, password) => {
    await createUserWithEmailAndPassword(auth, email, password);
  },
  logout: async () => {
    await signOut(auth);
  },
};

const e2eAdapter: AuthAdapter = {
  mode: 'e2e',
  getCurrentUser: () => readStoredTestUser(),
  onAuthStateChanged: (callback) => {
    callback(readStoredTestUser());
    const handler = () => callback(readStoredTestUser());
    window.addEventListener(TEST_AUTH_EVENT, handler);
    return () => window.removeEventListener(TEST_AUTH_EVENT, handler);
  },
  loginWithGoogle: async () => {
    persistTestUser(buildTestUser('google.tester@imanager.test'));
  },
  loginWithEmail: async (email, password) => {
    if (!email.trim() || password !== TEST_AUTH_DEFAULT_PASSWORD) {
      throw Object.assign(new Error('Invalid credentials'), { code: 'auth/invalid-credential' });
    }

    persistTestUser(buildTestUser(email));
  },
  registerWithEmail: async (email, password) => {
    if (!email.trim()) {
      throw Object.assign(new Error('Invalid email'), { code: 'auth/invalid-email' });
    }

    if (password.length < 6) {
      throw Object.assign(new Error('Weak password'), { code: 'auth/weak-password' });
    }

    persistTestUser(buildTestUser(email));
  },
  logout: async () => {
    persistTestUser(null);
  },
};

const adapter = isE2ETestMode() ? e2eAdapter : firebaseAdapter;

export function getAuthAdapter() {
  return adapter;
}

export function isFirebaseBackedAuth() {
  return adapter.mode === 'firebase';
}
