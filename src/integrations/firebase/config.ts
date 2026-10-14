function readEnv(k: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env?.[k]) return String(import.meta.env[k]).trim();
  if (typeof process !== "undefined" && process.env?.[k]) return process.env[k]?.trim();
  return undefined;
}

/** Claves públicas de la app web. No son secretos: Firebase las entrega al navegador. */
const CLOUD_WEB_CONFIG = {
  apiKey: "AIzaSyA5iCIFb9rlxQKAxi-pT4bzrr-TbI5tbcE",
  authDomain: "elpuntofertas.firebaseapp.com",
  projectId: "elpuntofertas",
  storageBucket: "elpuntofertas.firebasestorage.app",
  messagingSenderId: "1015786318917",
  appId: "1:1015786318917:web:e24ffc7d5bdaa0248c072c",
  measurementId: "G-NGJ31C5CB2",
};

export function getFirebaseWebConfig() {
  const apiKey = readEnv("VITE_FIREBASE_API_KEY");
  const authDomain = readEnv("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = readEnv("VITE_FIREBASE_PROJECT_ID");
  const storageBucket = readEnv("VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
  const appId = readEnv("VITE_FIREBASE_APP_ID");
  if (apiKey && authDomain && projectId && storageBucket && messagingSenderId && appId) {
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
    };
  }
  if (apiKey || authDomain || projectId || storageBucket || messagingSenderId || appId) return null;
  return CLOUD_WEB_CONFIG;
}

export function getAppCheckSiteKey() {
  return readEnv("VITE_FIREBASE_APPCHECK_SITE_KEY") || null;
}

export function firebaseConfigErrorMessage() {
  return "Firebase no está configurado por completo. Revisa VITE_FIREBASE_* en .env.";
}

export function useFirebaseEmulators() {
  return readEnv("VITE_FIREBASE_USE_EMULATORS") === "true";
}

