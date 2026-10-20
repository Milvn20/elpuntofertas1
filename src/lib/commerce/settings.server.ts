import {
  DEFAULT_COMMERCE_SETTINGS,
  settingsFromFirestore,
  type CommerceSettings,
} from "@/lib/commerce/policy";

const DOC_ID = "commerce";

export async function loadCommerceSettings(): Promise<CommerceSettings> {
  try {
    const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
    const snap = await getFirebaseAdminDb().collection("settings").doc(DOC_ID).get();
    if (!snap.exists) return DEFAULT_COMMERCE_SETTINGS;
    return settingsFromFirestore(snap.data());
  } catch {
    return DEFAULT_COMMERCE_SETTINGS;
  }
}

export async function saveCommerceSettings(settings: CommerceSettings, actorUid: string | null) {
  const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = getFirebaseAdminDb();
  await db
    .collection("settings")
    .doc(DOC_ID)
    .set({ ...settings, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await db.collection("auditLogs").doc(crypto.randomUUID()).set({
    actorUid,
    action: "commerce_settings_update",
    entityType: "settings",
    entityId: DOC_ID,
    timestamp: FieldValue.serverTimestamp(),
    metadata: settings,
  });
}
