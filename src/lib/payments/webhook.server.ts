import type { DocumentReference } from "firebase-admin/firestore";
import {
  decidePaymentUpdate,
  paymentEventKey,
  serverEnv,
  verifyWebhookSignature,
} from "@/lib/payments/mercadopago-core";

type PaymentRecord = Record<string, unknown>;

function statusMessage(status: string) {
  if (status === "approved") return "Mercado Pago confirmó el pago.";
  if (
    status === "pending" ||
    status === "in_process" ||
    status === "authorized" ||
    status === "in_mediation"
  ) {
    return "El pago quedó pendiente en Mercado Pago.";
  }
  return "Mercado Pago no aprobó el pago. El pedido sigue sin cobrar.";
}

function reasonMessage(reason: "missing" | "mismatch" | "amount" | "currency") {
  if (reason === "mismatch") return "El pago no corresponde a este pedido.";
  if (reason === "amount") return "El monto pagado no coincide con el pedido.";
  if (reason === "currency") return "La moneda del pago no es CLP.";
  return "No pudimos identificar el pago.";
}

export async function fetchMercadoPagoPayment(
  token: string,
  paymentId: string,
): Promise<PaymentRecord | null> {
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const payment = await response.json().catch(() => null);
  return payment && typeof payment === "object" ? (payment as PaymentRecord) : null;
}

export async function applyMercadoPagoPayment(orderId: string, payment: PaymentRecord) {
  const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = getFirebaseAdminDb();
  const ref = db.collection("orders").doc(orderId);
  return db
    .runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return {
          ok: false as const,
          reason: "missing" as const,
          message: "No encontramos el pedido.",
        };
      }
      const order = snap.data() ?? {};
      const decision = decidePaymentUpdate(order, payment, orderId);
      if (!decision.ok) {
        return {
          ok: false as const,
          reason: decision.reason,
          message: reasonMessage(decision.reason),
        };
      }
      if (decision.duplicate) {
        return {
          ok: true as const,
          duplicate: true,
          status: decision.status,
          message: statusMessage(decision.status),
        };
      }
      const events = Array.isArray(order.mercadoPagoEvents)
        ? order.mercadoPagoEvents.map(String)
        : [];
      const patch: Record<string, unknown> = {
        paymentMethod: "mercadopago",
        paymentStatus: decision.paymentStatus,
        mercadoPagoStatus: decision.status,
        mercadoPagoPaymentId: String(payment.id),
        mercadoPagoEvents: [...events, paymentEventKey(String(payment.id), decision.status)].slice(
          -20,
        ),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const stockUpdates: Array<{ ref: DocumentReference; stock: number }> = [];
      if (decision.confirmOrder) {
        patch.status = "confirmed";
        patch.inventoryPolicy = "decremented_on_payment";
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const productId = String(row.productId ?? "");
          const quantity = Math.floor(Number(row.quantity ?? 0));
          if (!productId || quantity < 1) continue;
          const productRef = db.collection("products").doc(productId);
          const productSnap = await tx.get(productRef);
          if (!productSnap.exists) continue;
          const stock = Math.floor(Number(productSnap.data()?.stock ?? 0));
          stockUpdates.push({ ref: productRef, stock: Math.max(0, stock - quantity) });
        }
      }
      for (const update of stockUpdates)
        tx.set(update.ref, { stock: update.stock }, { merge: true });
      tx.set(ref, patch, { merge: true });
      return {
        ok: true as const,
        duplicate: false,
        status: decision.status,
        paymentStatus: decision.paymentStatus,
        message: statusMessage(decision.status),
      };
    })
    .then(async (result) => {
      if (result.ok && !result.duplicate && result.paymentStatus === "paid") {
        const { notifyPaidOrder } = await import("@/lib/orders/mail.server");
        await notifyPaidOrder(orderId).catch(() => {
          console.error("[pedido] no se pudo avisar el pago por correo");
        });
      }
      return result;
    });
}

function notificationId(url: URL, body: PaymentRecord) {
  const fromQuery = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  const data = body.data && typeof body.data === "object" ? (body.data as PaymentRecord) : {};
  const fromBody = data.id == null ? "" : String(data.id);
  return (fromQuery || fromBody).trim();
}

export async function handleMercadoPagoWebhook(request: Request) {
  if (request.method === "GET") return Response.json({ ok: true });
  if (request.method !== "POST") return Response.json({ ok: false }, { status: 405 });

  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as PaymentRecord;
  const type = String(
    url.searchParams.get("type") || url.searchParams.get("topic") || body.type || "",
  );
  if (type && type !== "payment") return Response.json({ ok: true, ignored: true });

  const paymentId = notificationId(url, body);
  if (!/^\d{1,20}$/.test(paymentId)) return Response.json({ ok: false }, { status: 400 });

  const secret = serverEnv("MERCADOPAGO_WEBHOOK_SECRET");
  const valid = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: paymentId,
    secret,
  });
  if (!valid) return Response.json({ ok: false }, { status: 401 });

  const token = serverEnv("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return Response.json({ ok: false }, { status: 503 });
  const payment = await fetchMercadoPagoPayment(token, paymentId);
  if (!payment) return Response.json({ ok: false }, { status: 502 });

  const orderId = String(payment.external_reference ?? "");
  if (!orderId) return Response.json({ ok: true, ignored: true });
  try {
    const result = await applyMercadoPagoPayment(orderId, payment);
    if (!result.ok) console.error("[mercadopago] notificación no aplicada", result.reason);
    return Response.json({ ok: true, duplicate: "duplicate" in result ? result.duplicate : false });
  } catch {
    console.error("[mercadopago] no se pudo guardar la notificación");
    return Response.json({ ok: false }, { status: 500 });
  }
}
