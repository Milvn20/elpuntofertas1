function readEnv(k: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env?.[k]) return String(import.meta.env[k]).trim();
  if (typeof process !== "undefined" && process.env?.[k]) return process.env[k]?.trim();
  return undefined;
}

export function getFirebaseWebConfig() {
  const apiKey = readEnv("VITE_FIREBASE_API_KEY");
  const authDomain = readEnv("VITE_FIREBASE_AUTH_DOMAIN");
  const projectId = readEnv("VITE_FIREBASE_PROJECT_ID");
  const storageBucket = readEnv("VITE_FIREBASE_STORAGE_BUCKET");
  const messagingSenderId = readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID");
  const appId = readEnv("VITE_FIREBASE_APP_ID");
  // Todas las claves son obligatorias; si falta una, usamos Supabase y evitamos "Failed to fetch".
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
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

export function getAppCheckSiteKey() {
  return readEnv("VITE_FIREBASE_APPCHECK_SITE_KEY") || null;
}

export function firebaseConfigErrorMessage() {
  return "Firebase no está configurado por completo. Revisa VITE_FIREBASE_* en .env.";
}

export function useFirebaseEmulators() {
  return readEnv("VITE_FIREBASE_USE_EMULATORS") === "true";
}

