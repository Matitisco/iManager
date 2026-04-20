import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";

function ensureFirebaseApp() {
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY || !env.FIRESTORE_DATABASE_ID) {
    throw new Error("Firebase Admin no est\u00e1 configurado para este entorno.");
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
  }

  return admin.app();
}

export { admin };
export function getAdminAuth() {
  return admin.auth(ensureFirebaseApp());
}

export function getFirestoreClient() {
  return getFirestore(ensureFirebaseApp(), env.FIRESTORE_DATABASE_ID!);
}

export const firestore = new Proxy({} as ReturnType<typeof getFirestoreClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getFirestoreClient() as object, prop, receiver);
  },
});
