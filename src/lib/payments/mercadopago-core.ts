import { createHmac, timingSafeEqual } from "node:crypto";

export type PreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: "CLP";
};

export type PaymentDecision =
  | { ok: false; reason: "missing" | "mismatch" | "amount" | "currency" }
  | { ok: true; duplicate: true; status: string }
  | {
      ok: true;
      duplicate: false;
      status: string;
      paymentStatus: "paid" | "pending" | "rejected" | "cancelled";
      confirmOrder: boolean;
    };

type OrderSnapshot = {
  total?: unknown;
  status?: unknown;
  mercadoPagoEvents?: unknown;
};

type PaymentSnapshot = {
  id?: unknown;
  status?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
  currency_id?: unknown;
};

export function isMercadoPagoConfigured(token: string) {
  return token.trim().length > 0;
}

/** Lectura en tiempo de ejecución. El acceso con punto lo puede vaciar el build de Vite. */
export function serverEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSiteOrigin(
  env: { SITE_URL?: string; PUBLIC_SITE_URL?: string },
  requestOrigin: string | null,
  requestHost?: string | null,
) {
  const site = (env.SITE_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//.test(site)) return site;

  const origin = (requestOrigin || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//.test(origin)) return origin;

  const host = (requestHost || "").split(",")[0]?.trim() ?? "";
  if (host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `https://${host}`;

  const pub = (env.PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  if (/^https?:\/\//.test(pub)) return pub;
  return "http://localhost:8080";
}

export function buildPreferenceItems(order: {
  items?: Array<{ productId?: unknown; name?: unknown; quantity?: unknown; unitPrice?: unknown }>;
  shippingCost?: unknown;
}): { ok: true; items: PreferenceItem[] } | { ok: false; reason: "invalid" } {
  const lines = Array.isArray(order.items) ? order.items : [];
  const items: PreferenceItem[] = lines.map((line) => ({
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
  if (items.length === 0 || items.some((item) => !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, items };
}

export function checkoutUrlFor(token: string, payload: { sandbox_init_point?: unknown; init_point?: unknown }) {
  const raw = token.startsWith("TEST-") ? payload.sandbox_init_point : payload.init_point;
  return typeof raw === "string" && raw.startsWith("https://") ? raw : null;
}

export function returnUrls(origin: string) {
  const result = `${origin}/pago/resultado`;
  return { success: result, pending: result, failure: result };
}

/** Mercado Pago rechaza auto_return si la vuelta no es https, como en localhost. */
export function preferenceRedirect(origin: string) {
  const back_urls = returnUrls(origin);
  if (!back_urls.success.startsWith("https://")) return { back_urls };
  return { back_urls, auto_return: "approved" as const };
}

function signatureParts(header: string) {
  const parts = new Map<string, string>();
  for (const piece of header.split(",")) {
    const index = piece.indexOf("=");
    if (index <= 0) continue;
    parts.set(piece.slice(0, index).trim(), piece.slice(index + 1).trim());
  }
  return { ts: parts.get("ts") ?? "", v1: parts.get("v1") ?? "" };
}

export function webhookManifest(dataId: string, requestId: string, ts: string) {
  const id = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `id:${id};request-id:${requestId};ts:${ts};`;
}

export function verifyWebhookSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
}) {
  if (!input.secret || !input.signatureHeader || !input.dataId) return false;
  const { ts, v1 } = signatureParts(input.signatureHeader);
  if (!ts || !/^[a-f0-9]{64}$/i.test(v1)) return false;
  const manifest = webhookManifest(input.dataId, input.requestId ?? "", ts);
  const expected = createHmac("sha256", input.secret).update(manifest).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(v1.toLowerCase(), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function paymentEventKey(paymentId: string, status: string) {
  return `${paymentId}:${status}`;
}

export function decidePaymentUpdate(order: OrderSnapshot, payment: PaymentSnapshot, orderId: string): PaymentDecision {
  const paymentId = String(payment.id ?? "");
  const status = String(payment.status ?? "");
  if (!paymentId || !status) return { ok: false, reason: "missing" };
  if (String(payment.external_reference ?? "") !== orderId) return { ok: false, reason: "mismatch" };
  if (String(payment.currency_id ?? "CLP") !== "CLP") return { ok: false, reason: "currency" };
  const paid = Math.round(Number(payment.transaction_amount));
  const expected = Math.round(Number(order.total ?? NaN));
  if (!Number.isFinite(paid) || paid !== expected) return { ok: false, reason: "amount" };
  const events = Array.isArray(order.mercadoPagoEvents) ? order.mercadoPagoEvents.map(String) : [];
  if (events.includes(paymentEventKey(paymentId, status))) {
    return { ok: true, duplicate: true, status };
  }
  if (status === "approved") {
    return {
      ok: true,
      duplicate: false,
      status,
      paymentStatus: "paid",
      confirmOrder: String(order.status ?? "") === "pending",
    };
  }
  if (status === "pending" || status === "in_process" || status === "authorized" || status === "in_mediation") {
    return { ok: true, duplicate: false, status, paymentStatus: "pending", confirmOrder: false };
  }
  if (status === "cancelled") {
    return { ok: true, duplicate: false, status, paymentStatus: "cancelled", confirmOrder: false };
  }
  return { ok: true, duplicate: false, status, paymentStatus: "rejected", confirmOrder: false };
}
