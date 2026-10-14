import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

function ensureAdmin() {
  if (ready && getApps().length) return getApps()[0]!;
  const projectId = envValue("FIREBASE_PROJECT_ID") ?? envValue("VITE_FIREBASE_PROJECT_ID");
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID no configurado en servidor");
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && !firebaseEmulatorsEnabled()) {
    initializeApp({
      credential: cert(JSON.parse(json)),
      projectId,
      storageBucket: envValue("VITE_FIREBASE_STORAGE_BUCKET"),
    });
  } else {
    initializeApp({ projectId, storageBucket: envValue("VITE_FIREBASE_STORAGE_BUCKET") });
  }
  ready = true;
  return getApps()[0]!;
}

export function getFirebaseAdminAuth() {
  ensureAdmin();
  return getAuth();
}

export function getFirebaseAdminDb() {
  ensureAdmin();
  return getFirestore();
}

export function getFirebaseAdminStorage() {
  ensureAdmin();
  return getStorage();
}
