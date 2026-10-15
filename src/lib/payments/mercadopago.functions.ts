import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

type OrderItem = {
  productId?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
};

function accessToken() {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || "";
}

function siteOrigin() {
  const configured = process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const origin = getRequest()?.headers?.get("origin") ?? "";
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "http://localhost:8080";
}

export const mercadoPagoConfigured = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: accessToken().length > 0 };
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
    if (order.shippingCost == null) {
      return {
        ok: false as const,
        message: "El despacho de este pedido aún no tiene un monto. Elige retiro o coordina el envío por WhatsApp.",
      };
    }
    const lines = (Array.isArray(order.items) ? order.items : []) as OrderItem[];
    const items = lines.map((line) => ({
      id: String(line.productId ?? "").slice(0, 60),
      title: String(line.name ?? "Producto").slice(0, 120),
      quantity: Math.max(1, Math.trunc(Number(line.quantity ?? 1))),
      unit_price: Math.round(Number(line.unitPrice ?? 0)),
      currency_id: "CLP",
    }));
    const shipping = Math.round(Number(order.shippingCost ?? 0));
    if (shipping > 0) {
      items.push({ id: "despacho", title: "Despacho", quantity: 1, unit_price: shipping, currency_id: "CLP" });
    }
    if (items.length === 0 || items.some((item) => item.unit_price < 0)) {
      return { ok: false as const, message: "El pedido no tiene montos válidos para cobrar." };
    }

    const origin = siteOrigin();
    const delivery = order.shippingAddress && typeof order.shippingAddress === "object"
      ? order.shippingAddress as Record<string, string>
      : null;
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items,
        payer: {
          name: String(delivery?.firstName || order.customerName || "").slice(0, 80),
          surname: String(delivery?.lastName || "").slice(0, 80),
          email: String(order.customerEmail ?? ""),
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
        back_urls: {
          success: `${origin}/carrito?pago=retorno`,
          pending: `${origin}/carrito?pago=retorno`,
          failure: `${origin}/carrito?pago=retorno`,
        },
        auto_return: "approved",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) {
        return {
          ok: false as const,
          message: "Mercado Pago bloqueó este Access Token de prueba. En el panel abre Credenciales de producción, actívalas y usa el token que empieza con APP_USR-.",
        };
      }
      return { ok: false as const, message: "Mercado Pago no aceptó el cobro. Revisa el Access Token de la cuenta." };
    }
    const checkoutUrl = token.startsWith("TEST-") ? payload.sandbox_init_point : payload.init_point;
    if (typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://")) {
      return { ok: false as const, message: "Mercado Pago no entregó el enlace de pago." };
    }
    await ref.set(
      {
        paymentMethod: "mercadopago",
        paymentStatus: "unpaid",
        mercadoPagoPreferenceId: payload.id ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true as const, checkoutUrl };
  });

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
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${data.paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payment = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false as const, status: "unknown" as const, message: "No pudimos confirmar el pago con Mercado Pago." };
    if (String(payment.external_reference ?? "") !== data.orderId) {
      return { ok: false as const, status: "unknown" as const, message: "El pago no corresponde a este pedido." };
    }
    const status = String(payment.status ?? "");
    if (status === "approved") {
      const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      const { FieldValue } = await import("firebase-admin/firestore");
      await getFirebaseAdminDb().collection("orders").doc(data.orderId).set(
        {
          paymentStatus: "paid",
          paymentMethod: "mercadopago",
          mercadoPagoPaymentId: data.paymentId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return { ok: true as const, status: "approved" as const, message: "Mercado Pago confirmó el pago." };
    }
    if (status === "pending" || status === "in_process") {
      return { ok: true as const, status: "pending" as const, message: "El pago quedó pendiente en Mercado Pago." };
    }
    return { ok: true as const, status: "rejected" as const, message: "Mercado Pago no aprobó el pago. El pedido sigue sin cobrar." };
  });
