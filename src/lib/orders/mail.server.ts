import { orderMessages, type MailKind, type MailOrder } from "./mail";

export type MailDelivery = "sent" | "skipped" | "failed";

function envValue(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

async function sendOne(to: string, subject: string, text: string): Promise<MailDelivery> {
  const key = envValue("RESEND_API_KEY");
  const from = envValue("ORDER_FROM_EMAIL");
  if (!key || !from || !to) return "skipped";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!response.ok) {
      console.error("[pedido] correo rechazado", response.status);
      return "failed";
    }
    return "sent";
  } catch {
    console.error("[pedido] no se pudo enviar el correo");
    return "failed";
  }
}

function addressText(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const parts = [data.line1, data.line2, data.city, data.region]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export async function notifyPaidOrder(orderId: string) {
  const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
  const snap = await getFirebaseAdminDb().collection("orders").doc(orderId).get();
  if (!snap.exists) return;
  const row = snap.data() ?? {};
  const items = Array.isArray(row.items) ? row.items : [];
  await deliverOrderMail(
    {
      orderId,
      customerName: String(row.customerName ?? "Cliente"),
      customerEmail: String(row.customerEmail ?? ""),
      customerPhone: String(row.customerPhone ?? ""),
      fulfillment: row.fulfillment === "despacho" ? "despacho" : "retiro",
      address: addressText(row.shippingAddress),
      items: items.map((item) => {
        const line = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: String(line.name ?? "Producto"),
          quantity: Math.max(1, Math.floor(Number(line.quantity ?? 1))),
          lineTotal: Number(line.lineTotal ?? 0),
        };
      }),
      subtotal: Number(row.subtotal ?? 0),
      shippingCost: row.shippingCost == null ? null : Number(row.shippingCost),
      total: Number(row.total ?? 0),
    },
    "paid",
  );
}

export async function deliverOrderMail(order: MailOrder, kind: MailKind) {
  const messages = orderMessages(order, kind);
  const store = envValue("ORDER_NOTIFY_EMAIL");
  const [buyer, owner] = await Promise.all([
    sendOne(order.customerEmail, messages.buyer.subject, messages.buyer.text),
    sendOne(store, messages.store.subject, messages.store.text),
  ]);
  return { buyer, store: owner };
}
