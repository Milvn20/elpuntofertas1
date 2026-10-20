import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  buildPreferenceItems,
  checkoutUrlFor,
  isMercadoPagoConfigured,
  resolveSiteOrigin,
  preferenceRedirect,
} from "@/lib/payments/mercadopago-core";
import { applyMercadoPagoPayment, fetchMercadoPagoPayment } from "@/lib/payments/webhook.server";

function accessToken() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || "";
}

function siteOrigin() {
  return resolveSiteOrigin(
    { SITE_URL: process.env.SITE_URL, PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL },
    getRequest()?.headers?.get("origin") ?? null,
  );
}

export const mercadoPagoConfigured = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: isMercadoPagoConfigured(accessToken()) };
});

export const createMercadoPagoCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => {
    const orderId = data?.orderId?.trim() ?? "";
    if (!orderId || orderId.length > 80) throw new Error("Pedido inválido");
    return { orderId };
  })
  .handler(async ({ data }) => {
    const token = accessToken();
    if (!token) {
      return {
        ok: false as const,
        message: "Mercado Pago todavía no está conectado. Falta el Access Token en el servidor.",
      };
    }
    const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getFirebaseAdminDb();
    const ref = db.collection("orders").doc(data.orderId);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false as const, message: "No encontramos el pedido para cobrar." };
    const order = snap.data() ?? {};
    if (order.paymentStatus === "paid") {
      return { ok: false as const, message: "Este pedido ya figura como pagado." };
    }
    const savedCheckout = order.mercadoPagoCheckoutUrl;
    if (typeof savedCheckout === "string" && savedCheckout.startsWith("https://")) {
      return { ok: true as const, checkoutUrl: savedCheckout };
    }
    if (order.shippingCost == null) {
      return {
        ok: false as const,
        message: "El despacho de este pedido aún no tiene un monto. Elige retiro o coordina el envío por WhatsApp.",
      };
    }
    const built = buildPreferenceItems(order);
    if (!built.ok) return { ok: false as const, message: "El pedido no tiene montos válidos para cobrar." };
    const items = built.items;

    const origin = siteOrigin();
    const { loadCommerceSettings } = await import("@/lib/commerce/settings.server");
    const commerce = await loadCommerceSettings();
    const installmentCount = commerce.showInstallments ? commerce.installmentCount : 1;
    const delivery = order.shippingAddress && typeof order.shippingAddress === "object"
      ? order.shippingAddress as Record<string, string>
      : null;
    const preferenceBody = (withInstallments: boolean) => ({
      items,
      payer: {
        name: String(delivery?.firstName || order.customerName || "").slice(0, 80),
        surname: String(delivery?.lastName || "").slice(0, 80),
        phone: { number: String(order.customerPhone ?? "").replace(/\D/g, "").slice(0, 15) },
        ...(delivery ? {
          address: {
            street_name: String(delivery.line1 || "").slice(0, 80),
            zip_code: String(delivery.postalCode || "").slice(0, 12),
          },
        } : {}),
      },
      ...(delivery ? {
        shipments: {
          receiver_address: {
            street_name: String(delivery.line1 || "").slice(0, 80),
            zip_code: String(delivery.postalCode || "").slice(0, 12),
            city_name: String(delivery.city || "").slice(0, 80),
            state_name: String(delivery.region || "").slice(0, 80),
            country_name: "Chile",
          },
        },
      } : {}),
      external_reference: data.orderId,
      statement_descriptor: "ELPUNTOFERTAS",
      ...preferenceRedirect(origin),
      ...(withInstallments && installmentCount > 1 ? { payment_methods: { installments: installmentCount } } : {}),
      ...(origin.startsWith("https://") ? { notification_url: `${origin}/api/mercadopago/webhook` } : {}),
    });
    const requestPreference = (withInstallments: boolean) => fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody(withInstallments)),
    });
    let response = await requestPreference(true);
    let payload = await response.json().catch(() => ({}));
    const firstCause = JSON.stringify(payload?.cause ?? payload?.message ?? "");
    if (!response.ok && installmentCount > 1 && /installment/i.test(firstCause)) {
      response = await requestPreference(false);
      payload = await response.json().catch(() => ({}));
    }
    if (!response.ok) {
      const cause = Array.isArray(payload?.cause)
        ? payload.cause.map((item: { code?: unknown; description?: unknown }) => String(item?.description || item?.code || "")).filter(Boolean).slice(0, 3).join(" | ")
        : "";
      console.error("[mercadopago] preferencia rechazada", response.status, String(payload?.error || payload?.message || "").slice(0, 160), cause.slice(0, 240));
      return { ok: false as const, message: "Mercado Pago no pudo abrir el pago. Inténtalo de nuevo o coordina por WhatsApp." };
    }
    const checkoutUrl = checkoutUrlFor(token, payload);
    if (!checkoutUrl) {
      return { ok: false as const, message: "Mercado Pago no entregó el enlace de pago." };
    }
    await ref.set(
      {
        paymentMethod: "mercadopago",
        paymentStatus: "unpaid",
        mercadoPagoPreferenceId: payload.id ?? null,
        mercadoPagoCheckoutUrl: checkoutUrl,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true as const, checkoutUrl };
  });

function orderReceipt(orderId: string, order: Record<string, unknown>) {
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const address = order.shippingAddress && typeof order.shippingAddress === "object"
    ? order.shippingAddress as Record<string, unknown>
    : null;
  const addressText = address
    ? [address.line1, address.line2, address.city, address.region].map((value) => String(value ?? "").trim()).filter(Boolean).join(", ")
    : "";
  return {
    orderId,
    customerName: String(order.customerName ?? ""),
    fulfillment: order.fulfillment === "retiro" ? "retiro" as const : "despacho" as const,
    address: addressText || null,
    items: rawItems.map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        name: String(row.name ?? "Producto"),
        quantity: Math.max(0, Math.floor(Number(row.quantity ?? 0))),
        lineTotal: Math.round(Number(row.lineTotal ?? 0)),
      };
    }),
    subtotal: Math.round(Number(order.subtotal ?? 0)),
    shippingCost: order.shippingCost == null ? null : Math.round(Number(order.shippingCost)),
    shippingNote: String(order.shippingNote ?? ""),
    total: Math.round(Number(order.total ?? 0)),
    status: String(order.status ?? "pending"),
    paymentStatus: String(order.paymentStatus ?? "unpaid"),
    mercadoPagoStatus: order.mercadoPagoStatus == null ? null : String(order.mercadoPagoStatus),
  };
}

async function readReceipt(orderId: string) {
  const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
  const snap = await getFirebaseAdminDb().collection("orders").doc(orderId).get();
  if (!snap.exists) return null;
  return orderReceipt(orderId, snap.data() ?? {});
}

async function paymentForOrder(token: string, orderId: string) {
  const url = new URL("https://api.mercadopago.com/v1/payments/search");
  url.searchParams.set("external_reference", orderId);
  url.searchParams.set("sort", "date_created");
  url.searchParams.set("criteria", "desc");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const results = Array.isArray(payload.results) ? payload.results : [];
  return results.find((item: { status?: string }) => item?.status === "approved") ?? results[0] ?? null;
}

export const confirmMercadoPagoReturn = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string; paymentId: string }) => {
    const orderId = data?.orderId?.trim() ?? "";
    const paymentId = data?.paymentId?.trim() ?? "";
    if (!orderId || !/^\d{1,20}$/.test(paymentId)) throw new Error("No se pudo identificar el pago.");
    return { orderId, paymentId };
  })
  .handler(async ({ data }) => {
    const token = accessToken();
    if (!token) return { ok: false as const, status: "unknown" as const, message: "Mercado Pago no está conectado." };
    const payment = await fetchMercadoPagoPayment(token, data.paymentId);
    if (!payment) return { ok: false as const, status: "unknown" as const, message: "No pudimos confirmar el pago con Mercado Pago." };
    const result = await applyMercadoPagoPayment(data.orderId, payment);
    if (!result.ok) return { ok: false as const, status: "unknown" as const, message: result.message, receipt: null };
    const status = result.status === "approved"
      ? "approved" as const
      : result.status === "pending" || result.status === "in_process" || result.status === "authorized" || result.status === "in_mediation"
        ? "pending" as const
        : "rejected" as const;
    return { ok: true as const, status, message: result.message, receipt: await readReceipt(data.orderId) };
  });

export const syncMercadoPagoOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { orderId: string }) => {
    const orderId = data?.orderId?.trim() ?? "";
    if (!orderId || orderId.length > 80) throw new Error("Pedido inválido");
    return { orderId };
  })
  .handler(async ({ data }) => {
    const token = accessToken();
    if (!token) return { ok: false as const, status: "unknown" as const, message: "Mercado Pago no está conectado.", receipt: null };
    const payment = await paymentForOrder(token, data.orderId);
    if (!payment) return { ok: false as const, status: "unknown" as const, message: "Todavía no hay un pago de Mercado Pago para este pedido.", receipt: await readReceipt(data.orderId) };
    const result = await applyMercadoPagoPayment(data.orderId, payment);
    if (!result.ok) return { ok: false as const, status: "unknown" as const, message: result.message, receipt: await readReceipt(data.orderId) };
    const status = result.status === "approved"
      ? "approved" as const
      : result.status === "pending" || result.status === "in_process" || result.status === "authorized" || result.status === "in_mediation"
        ? "pending" as const
        : "rejected" as const;
    return { ok: true as const, status, message: result.message, receipt: await readReceipt(data.orderId) };
  });
