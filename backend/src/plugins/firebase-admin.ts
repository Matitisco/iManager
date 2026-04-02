import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env.js";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

export { admin };
export const adminAuth = admin.auth();
export const firestore = getFirestore(admin.app(), env.FIRESTORE_DATABASE_ID);
