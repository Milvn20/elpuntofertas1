import { initializeApp, getApps } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseConfigErrorMessage, getAppCheckSiteKey, getFirebaseWebConfig, useFirebaseEmulators } from "./config";

let emulators = false;
let appCheckReady = false;

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

function wireAppCheck() {
  if (appCheckReady || useFirebaseEmulators()) return;
  const siteKey = getAppCheckSiteKey();
  if (!siteKey) return;
  try {
    initializeAppCheck(app(), {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckReady = true;
  } catch (error) {
    console.warn("[firebase] App Check no se pudo iniciar", error);
  }
}

export function getFirebaseAuth() {
  const a = getAuth(app());
  wireEmulators();
  wireAppCheck();
  return a;
}

export function getFirebaseDb() {
  const d = getFirestore(app());
  wireEmulators();
  wireAppCheck();
  return d;
}

export function getFirebaseStorage() {
  const s = getStorage(app());
  wireEmulators();
  wireAppCheck();
  return s;
}
