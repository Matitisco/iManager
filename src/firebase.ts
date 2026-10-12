import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';
import { isIOS, isStandalone } from './lib/pwa';

// Safari blocks third-party storage. The installed app uses same-origin helpers
// served by scripts/serve-spa.mjs; browser popup login keeps its existing domain.
const app = initializeApp({
  ...firebaseConfig,
  authDomain: isIOS() && isStandalone() ? window.location.host : firebaseConfig.authDomain,
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
