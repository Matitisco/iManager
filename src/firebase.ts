import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

type FirebaseEnvKey =
  | 'VITE_FIREBASE_API_KEY'
  | 'VITE_FIREBASE_AUTH_DOMAIN'
  | 'VITE_FIREBASE_PROJECT_ID'
  | 'VITE_FIREBASE_APP_ID'
  | 'VITE_FIREBASE_MESSAGING_SENDER_ID'
  | 'VITE_FIREBASE_STORAGE_BUCKET'
  | 'VITE_FIREBASE_MEASUREMENT_ID';

type FirebaseEnvSource = Partial<Record<FirebaseEnvKey, string | undefined>>;

const REQUIRED_FIREBASE_ENV_KEYS: FirebaseEnvKey[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
];

function getFirebaseEnvSource(): FirebaseEnvSource {
  const testEnv = (globalThis as typeof globalThis & {
    __IMANAGER_TEST_FIREBASE_ENV__?: FirebaseEnvSource;
  }).__IMANAGER_TEST_FIREBASE_ENV__;

  return testEnv ?? import.meta.env;
}

export function getFirebaseConfigFromEnv(source: FirebaseEnvSource = getFirebaseEnvSource()): FirebaseOptions {
  const missingKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !source[key]?.trim());

  if (missingKeys.length > 0) {
    throw new Error(
      `Faltan variables de entorno de Firebase para el frontend: ${missingKeys.join(', ')}. Configuralas en .env.local o en el host del frontend.`
    );
  }

  const measurementId = source.VITE_FIREBASE_MEASUREMENT_ID?.trim();

  return {
    apiKey: source.VITE_FIREBASE_API_KEY!.trim(),
    authDomain: source.VITE_FIREBASE_AUTH_DOMAIN!.trim(),
    projectId: source.VITE_FIREBASE_PROJECT_ID!.trim(),
    appId: source.VITE_FIREBASE_APP_ID!.trim(),
    messagingSenderId: source.VITE_FIREBASE_MESSAGING_SENDER_ID!.trim(),
    storageBucket: source.VITE_FIREBASE_STORAGE_BUCKET!.trim(),
    ...(measurementId ? { measurementId } : {}),
  };
}

const app = getApps()[0] ?? initializeApp(getFirebaseConfigFromEnv());

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
