import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseConfigErrorMessage, getFirebaseWebConfig, useFirebaseEmulators } from "./config";

let emulators = false;

function app() {
  const cfg = getFirebaseWebConfig();
  if (!cfg) throw new Error(firebaseConfigErrorMessage());
  return getApps().length ? getApps()[0]! : initializeApp(cfg);
}

function wireEmulators() {
  if (!useFirebaseEmulators() || emulators) return;
  connectAuthEmulator(getAuth(app()), "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(app()), "127.0.0.1", 8080);
  connectStorageEmulator(getStorage(app()), "127.0.0.1", 9199);
  emulators = true;
}

export function getFirebaseAuth() {
  const a = getAuth(app());
  wireEmulators();
  return a;
}

export function getFirebaseDb() {
  const d = getFirestore(app());
  wireEmulators();
  return d;
}

export function getFirebaseStorage() {
  const s = getStorage(app());
  wireEmulators();
  return s;
}
