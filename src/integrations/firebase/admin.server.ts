import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, initializeFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

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
function envSlot(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function rememberEnv(key: string, value: string) {
  process.env[key] = value;
}

function managedAdcPath() {
  return join(homedir(), ".elpuntofertas", "application_default_credentials.json");
}

/**
 * Si ya hay un archivo de credenciales distinto al que genera esta tienda, se respeta.
 * Una ruta vacía, inexistente o el archivo local viejo se reemplaza con la sesión de la CLI.
 */
function attachCliApplicationDefault(projectId: string): boolean {
  if (firebaseEmulatorsEnabled() || envSlot("FIREBASE_SERVICE_ACCOUNT_JSON")) return false;
  const existing = envSlot("GOOGLE_APPLICATION_CREDENTIALS");
  const managed = managedAdcPath();
  if (existing && existing !== managed && existsSync(existing)) return true;
  if (existing && !existsSync(existing)) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

  const cliPath = join(homedir(), ".config", "configstore", "firebase-tools.json");
  try {
    if (existsSync(cliPath)) {
      const refresh = JSON.parse(readFileSync(cliPath, "utf8"))?.tokens?.refresh_token;
      if (typeof refresh === "string" && refresh) {
        mkdirSync(join(homedir(), ".elpuntofertas"), { recursive: true });
        writeFileSync(
          managed,
          JSON.stringify({
            type: "authorized_user",
            client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
            client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
            refresh_token: refresh,
            quota_project_id: projectId,
          }),
        );
        rememberEnv("GOOGLE_APPLICATION_CREDENTIALS", managed);
        return true;
      }
    }
  } catch {
    // Si la CLI no se puede leer, se intenta el archivo que ya existía.
  }
  if (existsSync(managed)) {
    rememberEnv("GOOGLE_APPLICATION_CREDENTIALS", managed);
    return true;
  }
  return false;
}

function startAdmin(): App {
  const projectId = envValue("FIREBASE_PROJECT_ID") ?? envValue("VITE_FIREBASE_PROJECT_ID") ?? "elpuntofertas";
  const json = envSlot("FIREBASE_SERVICE_ACCOUNT_JSON");
  const storageBucket = envValue("VITE_FIREBASE_STORAGE_BUCKET");
  if (json && !firebaseEmulatorsEnabled()) {
    return initializeApp({ credential: cert(JSON.parse(json)), projectId, storageBucket });
  }
  if (!firebaseEmulatorsEnabled() && attachCliApplicationDefault(projectId)) {
    if (!envSlot("GOOGLE_CLOUD_PROJECT")) rememberEnv("GOOGLE_CLOUD_PROJECT", projectId);
    if (!envSlot("GCLOUD_PROJECT")) rememberEnv("GCLOUD_PROJECT", projectId);
    const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket });
    initializeFirestore(app, { preferRest: true });
    return app;
  }
  if (!firebaseEmulatorsEnabled()) {
    console.warn("Firebase Admin no encontró credenciales locales. El pedido no se puede guardar.");
  }
  return initializeApp({ projectId, storageBucket });
}

function ensureAdmin(): App {
  if (getApps().length) return getApp();
  try {
    return startAdmin();
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (getApps().length && /already exists/i.test(message)) return getApp();
    throw err;
  }
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
