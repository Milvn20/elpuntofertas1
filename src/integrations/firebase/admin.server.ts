import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let ready = false;

function envValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  const fromMeta = import.meta.env?.[key];
  return fromMeta ? String(fromMeta).trim() : undefined;
}

export function firebaseEmulatorsEnabled() {
  return envValue("FIREBASE_USE_EMULATORS") === "true" || envValue("VITE_FIREBASE_USE_EMULATORS") === "true";
}

if (firebaseEmulatorsEnabled()) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8180";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= "127.0.0.1:9199";
}

/**
 * La sesión de `firebase login` no sirve como credencial suelta: Firestore solo acepta
 * una cuenta de servicio o las credenciales predeterminadas de Google. En esta máquina
 * se copia el token de la CLI a un archivo local, fuera del repositorio.
 * En Netlify hace falta FIREBASE_SERVICE_ACCOUNT_JSON.
 */
function attachCliApplicationDefault(projectId: string): boolean {
  if (firebaseEmulatorsEnabled() || process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return false;
  }
  const cliPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  if (!existsSync(cliPath)) return false;
  try {
    const refresh = JSON.parse(readFileSync(cliPath, "utf8"))?.tokens?.refresh_token;
    if (typeof refresh !== "string" || !refresh) return false;
    const dir = join(homedir(), ".elpuntofertas");
    mkdirSync(dir, { recursive: true });
    const adcPath = join(dir, "application_default_credentials.json");
    writeFileSync(
      adcPath,
      JSON.stringify({
        type: "authorized_user",
        client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
        refresh_token: refresh,
        quota_project_id: projectId,
      }),
    );
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
    process.env.GOOGLE_CLOUD_PROJECT ||= projectId;
    process.env.GCLOUD_PROJECT ||= projectId;
    return true;
  } catch {
    return false;
  }
}

function ensureAdmin(): App {
  if (ready && getApps().length) return getApps()[0]!;
  const projectId = envValue("FIREBASE_PROJECT_ID") ?? envValue("VITE_FIREBASE_PROJECT_ID") ?? "elpuntofertas";
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const storageBucket = envValue("VITE_FIREBASE_STORAGE_BUCKET");
  let app: App;
  if (json && !firebaseEmulatorsEnabled()) {
    app = initializeApp({ credential: cert(JSON.parse(json)), projectId, storageBucket });
  } else if (!firebaseEmulatorsEnabled() && attachCliApplicationDefault(projectId)) {
    app = initializeApp({ credential: applicationDefault(), projectId, storageBucket });
    initializeFirestore(app, { preferRest: true });
  } else {
    app = initializeApp({ projectId, storageBucket });
  }
  ready = true;
  return app;
}

export function getFirebaseAdminAuth() {
  return getAuth(ensureAdmin());
}

export function getFirebaseAdminDb() {
  return getFirestore(ensureAdmin());
}

export function getFirebaseAdminStorage() {
  return getStorage(ensureAdmin());
}
