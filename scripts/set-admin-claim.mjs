/**
 * Uso local: GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/set-admin-claim.mjs user@email.com
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/set-admin-claim.mjs <email>");
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!projectId || !credPath) {
  console.error("Configura FIREBASE_PROJECT_ID y GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

const sa = JSON.parse(readFileSync(credPath, "utf8"));
initializeApp({ credential: cert(sa), projectId });

const auth = getAuth();
const db = getFirestore();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { admin: true });
await db.collection("users").doc(user.uid).set(
  { email, role: "admin", active: true, updatedAt: FieldValue.serverTimestamp() },
  { merge: true },
);
console.log("Admin asignado a", email, user.uid);
