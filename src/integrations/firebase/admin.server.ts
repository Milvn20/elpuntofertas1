import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let ready = false;

function ensureAdmin() {
  if (ready && getApps().length) return getApps()[0]!;
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID no configurado en servidor");
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    initializeApp({
      credential: cert(JSON.parse(json)),
      projectId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    initializeApp({ projectId, storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET });
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
