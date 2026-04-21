import { describe, expect, it } from 'vitest';
import { getFirebaseConfigFromEnv } from './firebase';

const validEnv = {
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'imanager-test.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'imanager-test',
  VITE_FIREBASE_APP_ID: '1:1234567890:web:test',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_STORAGE_BUCKET: 'imanager-test.appspot.com',
  VITE_FIREBASE_MEASUREMENT_ID: 'G-TEST123',
};

describe('firebase config', () => {
  it('maps Vite env values to the Firebase web config', () => {
    expect(getFirebaseConfigFromEnv(validEnv)).toEqual({
      apiKey: 'test-api-key',
      authDomain: 'imanager-test.firebaseapp.com',
      projectId: 'imanager-test',
      appId: '1:1234567890:web:test',
      messagingSenderId: '1234567890',
      storageBucket: 'imanager-test.appspot.com',
      measurementId: 'G-TEST123',
    });
  });

  it('fails clearly when a required Firebase env key is missing', () => {
    expect(() =>
      getFirebaseConfigFromEnv({
        ...validEnv,
        VITE_FIREBASE_API_KEY: '  ',
        VITE_FIREBASE_PROJECT_ID: undefined,
      })
    ).toThrowError(
      'Faltan variables de entorno de Firebase para el frontend: VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID. Configuralas en .env.local o en el host del frontend.'
    );
  });
});
