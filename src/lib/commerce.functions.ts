import { createServerFn } from "@tanstack/react-start";
import { canEditCommerce, parseCommerceSettings } from "@/lib/commerce/policy";
import { loadCommerceSettings, saveCommerceSettings } from "@/lib/commerce/settings.server";
import { requireAuth, type AuthContext } from "@/lib/require-auth.middleware";

function adminContext(context: AuthContext | undefined) {
  if (!context || !canEditCommerce(context.isAdmin)) throw new Error("Forbidden");
  return context;
}

export const getCommerceSettings = createServerFn({ method: "GET" }).handler(async () => {
  return loadCommerceSettings();
});

export const saveCommerceConfig = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) => {
    const parsed = parseCommerceSettings(data);
    if (!parsed.ok) throw new Error(parsed.message);
    return parsed.settings;
  })
  .handler(async ({ data, context }) => {
    const auth = adminContext(context);
    await saveCommerceSettings(data, auth.userId);
    return { ok: true as const, settings: data };
  });

export const adminUpdateProductPrice = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { productId: string; price: number }) => {
    const productId = data?.productId?.trim() ?? "";
    const price = Math.round(Number(data?.price));
    if (!productId || productId.length > 80) throw new Error("Producto inválido");
    if (!Number.isInteger(price) || price < 0) throw new Error("El precio no es válido");
    return { productId, price };
  })
  .handler(async ({ data, context }) => {
    adminContext(context);
    const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = getFirebaseAdminDb().collection("products").doc(data.productId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Producto no encontrado");
    await ref.set({ price: data.price, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true as const, price: data.price };
  });
