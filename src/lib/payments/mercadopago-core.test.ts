import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildPreferenceItems,
  checkoutUrlFor,
  decidePaymentUpdate,
  isMercadoPagoConfigured,
  resolveSiteOrigin,
  preferenceRedirect,
  returnUrls,
  verifyWebhookSignature,
} from "./mercadopago-core";

const secret = "secreto-de-prueba";

function signed(dataId: string, requestId: string, ts: string) {
  const manifest = `id:${/[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("preferencia de Mercado Pago", () => {
  it("arma los ítems con el precio guardado en el pedido", () => {
    const result = buildPreferenceItems({
      items: [{ productId: "p1", name: "Buzo", quantity: 2, unitPrice: 10000 }],
      shippingCost: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toEqual([
      { id: "p1", title: "Buzo", quantity: 2, unit_price: 10000, currency_id: "CLP" },
    ]);
  });

  it("rechaza un pedido sin montos válidos", () => {
    expect(buildPreferenceItems({ items: [], shippingCost: 0 }).ok).toBe(false);
    expect(buildPreferenceItems({ items: [{ unitPrice: -1, quantity: 1 }], shippingCost: 0 }).ok).toBe(false);
  });

  it("usa el enlace de prueba solo con un token TEST", () => {
    const payload = { sandbox_init_point: "https://sandbox.mercadopago.cl/checkout", init_point: "https://www.mercadopago.cl/checkout" };
    expect(checkoutUrlFor("TEST-abc", payload)).toBe(payload.sandbox_init_point);
    expect(checkoutUrlFor("APP_USR-abc", payload)).toBe(payload.init_point);
    expect(checkoutUrlFor("TEST-abc", {})).toBeNull();
  });

  it("no marca el pago como configurado si falta el token", () => {
    expect(isMercadoPagoConfigured("")).toBe(false);
    expect(isMercadoPagoConfigured("   ")).toBe(false);
    expect(isMercadoPagoConfigured("TEST-token")).toBe(true);
  });

  it("arma el retorno con la URL pública y no con un dominio inventado", () => {
    expect(resolveSiteOrigin({ SITE_URL: "https://tienda.example" }, "http://localhost:8080")).toBe("https://tienda.example");
    expect(resolveSiteOrigin({}, "http://localhost:8080")).toBe("http://localhost:8080");
    expect(resolveSiteOrigin({ PUBLIC_SITE_URL: "http://localhost:8080" }, "https://elpuntofertas.netlify.app")).toBe("https://elpuntofertas.netlify.app");
    expect(resolveSiteOrigin({}, null, "elpuntofertas.netlify.app")).toBe("https://elpuntofertas.netlify.app");
    expect(returnUrls("http://localhost:8080").success).toBe("http://localhost:8080/pago/resultado");
    expect(preferenceRedirect("http://localhost:8080").auto_return).toBeUndefined();
    expect(preferenceRedirect("https://tienda.example").auto_return).toBe("approved");
  });
});

describe("notificaciones de Mercado Pago", () => {
  it("acepta una firma válida y rechaza una firma alterada", () => {
    const header = signed("999", "req-1", "1700000000");
    expect(verifyWebhookSignature({
      signatureHeader: header,
      requestId: "req-1",
      dataId: "999",
      secret,
    })).toBe(true);
    expect(verifyWebhookSignature({
      signatureHeader: `ts=1700000000,v1=${"0".repeat(64)}`,
      requestId: "req-1",
      dataId: "999",
      secret,
    })).toBe(false);
    expect(verifyWebhookSignature({
      signatureHeader: header,
      requestId: "req-1",
      dataId: "999",
      secret: "",
    })).toBe(false);
  });

  it("normaliza el identificador alfanumérico antes de firmar", () => {
    const header = signed("PAY-1", "req-2", "1700000001");
    expect(verifyWebhookSignature({
      signatureHeader: header,
      requestId: "req-2",
      dataId: "PAY-1",
      secret,
    })).toBe(true);
  });
});

describe("actualización del pedido", () => {
  const order = { total: 20000, status: "pending", mercadoPagoEvents: [] };

  it("marca pagado solo si Mercado Pago aprobó el monto del pedido", () => {
    const decision = decidePaymentUpdate(order, {
      id: "10",
      status: "approved",
      external_reference: "pedido-1",
      transaction_amount: 20000,
      currency_id: "CLP",
    }, "pedido-1");
    expect(decision).toMatchObject({ ok: true, duplicate: false, paymentStatus: "paid", confirmOrder: true });
  });

  it("no aprueba un monto manipulado ni un pago de otro pedido", () => {
    expect(decidePaymentUpdate(order, {
      id: "10",
      status: "approved",
      external_reference: "pedido-1",
      transaction_amount: 1,
      currency_id: "CLP",
    }, "pedido-1").ok).toBe(false);
    expect(decidePaymentUpdate(order, {
      id: "10",
      status: "approved",
      external_reference: "otro",
      transaction_amount: 20000,
      currency_id: "CLP",
    }, "pedido-1")).toMatchObject({ ok: false, reason: "mismatch" });
  });

  it("registra pendiente y rechazado sin confirmar el pedido", () => {
    expect(decidePaymentUpdate(order, {
      id: "11", status: "pending", external_reference: "pedido-1", transaction_amount: 20000, currency_id: "CLP",
    }, "pedido-1")).toMatchObject({ paymentStatus: "pending", confirmOrder: false });
    expect(decidePaymentUpdate(order, {
      id: "12", status: "rejected", external_reference: "pedido-1", transaction_amount: 20000, currency_id: "CLP",
    }, "pedido-1")).toMatchObject({ paymentStatus: "rejected", confirmOrder: false });
    expect(decidePaymentUpdate(order, {
      id: "13", status: "in_process", external_reference: "pedido-1", transaction_amount: 20000, currency_id: "CLP",
    }, "pedido-1")).toMatchObject({ paymentStatus: "pending" });
  });

  it("ignora una notificación repetida del mismo estado", () => {
    const decision = decidePaymentUpdate(
      { ...order, mercadoPagoEvents: ["10:approved"] },
      { id: "10", status: "approved", external_reference: "pedido-1", transaction_amount: 20000, currency_id: "CLP" },
      "pedido-1",
    );
    expect(decision).toMatchObject({ ok: true, duplicate: true });
  });

  it("una URL de éxito no alcanza para marcar el pedido como pagado", () => {
    const browserOnly = decidePaymentUpdate(order, { status: "approved", external_reference: "pedido-1" }, "pedido-1");
    expect(browserOnly).toMatchObject({ ok: false, reason: "missing" });
  });
});
