import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useFirebaseBackend } from "@/lib/data/backend";
import { assertAdminContext, requireAuth } from "@/lib/require-auth.middleware";
import {
  formatShippingAddress,
  parseShippingAddress,
  type ShippingAddress,
} from "@/lib/orders/address";
import {
  isUuid,
  orderSummaryText,
  quoteOrder,
  type Fulfillment,
  type PricedProduct,
  type QuoteLineRequest,
} from "@/lib/orders/pricing";

const attempts = new Map<string, { count: number; at: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || now - row.at > 10 * 60 * 1000) {
    attempts.set(key, { count: 1, at: now });
    return;
  }
  row.count += 1;
  if (row.count > 12)
    throw new Error("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
}

const ORDER_STATUSES = ["pending", "confirmed", "ready", "delivered", "cancelled"] as const;
type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

type CreateOrderInput = {
  clientRequestId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: Fulfillment;
  shippingAddress: ShippingAddress | null;
  items: QuoteLineRequest[];
};

function parseCreateOrder(data: CreateOrderInput): CreateOrderInput {
  const email = data?.customerEmail?.trim().toLowerCase() ?? "";
  const phone = data?.customerPhone?.trim() ?? "";
  const clientRequestId = data?.clientRequestId?.trim() ?? "";
  if (!isUuid(clientRequestId)) throw new Error("No se pudo identificar el intento de pedido.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) throw new Error("El teléfono no es válido.");
  if (data.fulfillment !== "retiro" && data.fulfillment !== "despacho")
    throw new Error("Elige retiro o despacho.");
  const shippingAddress =
    data.fulfillment === "despacho" ? parseShippingAddress(data.shippingAddress) : null;
  const name = shippingAddress
    ? `${shippingAddress.firstName} ${shippingAddress.lastName}`
    : (data?.customerName?.trim() ?? "");
  if (name.length < 2 || name.length > 120)
    throw new Error("Escribe un nombre de contacto válido.");
  if (!Array.isArray(data.items) || data.items.length === 0)
    throw new Error("El carrito está vacío.");
  return {
    clientRequestId,
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    fulfillment: data.fulfillment,
    shippingAddress,
    items: data.items.map((item) => ({
      productId: String(item?.productId ?? ""),
      quantity: Number(item?.quantity),
      expectedUnitPrice: item?.expectedUnitPrice == null ? null : Number(item.expectedUnitPrice),
    })),
  };
}

async function optionalUserId(): Promise<string | null> {
  const header = getRequest()?.headers?.get("authorization");
  if (!header?.startsWith("Bearer ") || !useFirebaseBackend()) return null;
  try {
    const { getFirebaseAdminAuth } = await import("@/integrations/firebase/admin.server");
    const decoded = await getFirebaseAdminAuth().verifyIdToken(header.slice(7).trim());
    return decoded.uid;
  } catch {
    return null;
  }
}

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator(parseCreateOrder)
  .handler(async ({ data }) => {
    const request = getRequest();
    rateLimit(request?.headers?.get("x-forwarded-for") ?? data.customerEmail);
    if (!useFirebaseBackend()) {
      throw new Error(
        "Los pedidos se registran solo en Firebase. Configura el proyecto antes de confirmar una compra.",
      );
    }
    let db;
    try {
      const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      db = getFirebaseAdminDb();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        /Could not load the default credentials|Could not refresh|default credentials/i.test(
          message,
        )
      ) {
        throw new Error(
          "No se pudo guardar el pedido: el servidor no tiene credenciales de Firebase. El carrito sigue intacto.",
        );
      }
      throw err;
    }
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = db.collection("orders").doc(data.clientRequestId);
    let existing;
    try {
      existing = await ref.get();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (
        /Could not load the default credentials|Could not refresh|default credentials/i.test(
          message,
        )
      ) {
        throw new Error(
          "No se pudo guardar el pedido: el servidor no tiene credenciales de Firebase. El carrito sigue intacto.",
        );
      }
      throw err;
    }
    const saved = existing.exists ? (existing.data() ?? {}) : null;
    const savedCheckout =
      typeof saved?.mercadoPagoCheckoutUrl === "string" ? saved.mercadoPagoCheckoutUrl : "";
    if (saved && (saved.paymentStatus === "paid" || savedCheckout.startsWith("https://"))) {
      return {
        ok: true as const,
        alreadyExisted: true,
        orderId: ref.id,
        subtotal: Number(saved.subtotal ?? 0),
        shippingCost: saved.shippingCost == null ? null : Number(saved.shippingCost),
        shippingNote: String(saved.shippingNote ?? ""),
        total: Number(saved.total ?? 0),
        fulfillment: saved.fulfillment as Fulfillment,
        items: saved.items ?? [],
      };
    }

    const ids = [...new Set(data.items.map((item) => item.productId).filter(Boolean))];
    const snaps = await Promise.all(ids.map((id) => db.collection("products").doc(id).get()));
    const products = new Map<string, PricedProduct>();
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const row = snap.data() ?? {};
      products.set(snap.id, {
        id: snap.id,
        name: String(row.name ?? ""),
        slug: String(row.slug ?? ""),
        price: Number(row.price ?? NaN),
        stock: Number(row.stock ?? 0),
        active: row.active === true,
      });
    });

    const { loadCommerceSettings } = await import("@/lib/commerce/settings.server");
    const commerce = await loadCommerceSettings();
    const quoted = quoteOrder(data.items, products, data.fulfillment, commerce);
    if (!quoted.ok) return quoted;

    const userId = await optionalUserId();
    const quote = quoted.quote;
    const priced = {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      fulfillment: quote.fulfillment,
      shippingAddress: data.shippingAddress,
      items: quote.items,
      subtotal: quote.subtotal,
      shippingCost: quote.shippingCost,
      shippingNote: quote.shippingNote,
      total: quote.total,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (saved) {
      await ref.set(priced, { merge: true });
    } else {
      await ref.create({
        ...priced,
        userId,
        status: "pending",
        paymentMethod: "coordinar",
        paymentStatus: "unpaid",
        inventoryPolicy: "checked_not_decremented",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await db
      .collection("auditLogs")
      .doc(crypto.randomUUID())
      .set({
        actorUid: userId,
        action: saved ? "order_reprice" : "order_create",
        entityType: "order",
        entityId: ref.id,
        timestamp: FieldValue.serverTimestamp(),
        metadata: { itemCount: quote.items.length, total: quote.total, status: "pending" },
      });

    const mail = saved
      ? { buyer: "skipped" as const, store: "skipped" as const }
      : await import("@/lib/orders/mail.server")
          .then(({ deliverOrderMail }) =>
            deliverOrderMail(
              {
                orderId: ref.id,
                customerName: data.customerName,
                customerEmail: data.customerEmail,
                customerPhone: data.customerPhone,
                fulfillment: quote.fulfillment,
                address: data.shippingAddress ? formatShippingAddress(data.shippingAddress) : null,
                items: quote.items.map((item) => ({
                  name: item.name,
                  quantity: item.quantity,
                  lineTotal: item.lineTotal,
                })),
                subtotal: quote.subtotal,
                shippingCost: quote.shippingCost,
                total: quote.total,
              },
              "placed",
            ),
          )
          .catch(() => ({ buyer: "failed" as const, store: "failed" as const }));

    return {
      ok: true as const,
      alreadyExisted: Boolean(saved),
      mail,
      orderId: ref.id,
      subtotal: quote.subtotal,
      shippingCost: quote.shippingCost,
      shippingNote: quote.shippingNote,
      total: quote.total,
      fulfillment: quote.fulfillment,
      items: quote.items,
      whatsappText: orderSummaryText({
        customerName: data.customerName,
        items: quote.items,
        subtotal: quote.subtotal,
        shippingNote: quote.shippingNote,
        total: quote.total,
        fulfillment: quote.fulfillment,
        address: data.shippingAddress ? formatShippingAddress(data.shippingAddress) : null,
        orderId: ref.id,
        registered: true,
      }),
    };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { orderId: string; status: OrderStatus }) => {
    if (!data?.orderId || !ORDER_STATUSES.includes(data.status))
      throw new Error("Estado de pedido inválido");
    return { orderId: data.orderId, status: data.status };
  })
  .handler(async ({ data, context }) => {
    assertAdminContext(context);
    if (!useFirebaseBackend()) throw new Error("Firebase no está activo");
    const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getFirebaseAdminDb();
    const ref = db.collection("orders").doc(data.orderId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("Pedido no encontrado");
    const current = String(snap.data()?.status ?? "") as OrderStatus;
    if (!TRANSITIONS[current]?.includes(data.status)) {
      throw new Error("Ese cambio de estado no está permitido.");
    }
    await ref.update({ status: data.status, updatedAt: FieldValue.serverTimestamp() });
    await db
      .collection("auditLogs")
      .doc(crypto.randomUUID())
      .set({
        actorUid: context.userId,
        action: "order_status",
        entityType: "order",
        entityId: data.orderId,
        timestamp: FieldValue.serverTimestamp(),
        metadata: { from: current, to: data.status },
      });
    return { ok: true as const };
  });
