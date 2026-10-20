import { describe, expect, it } from "vitest";
import { buildPreferenceItems } from "../payments/mercadopago-core";
import { quoteOrder, type PricedProduct } from "../orders/pricing";
import {
  canEditCommerce,
  DEFAULT_COMMERCE_SETTINGS,
  installmentPlan,
  parseCommerceSettings,
  pricePlan,
  qualifiesForFreeShipping,
  shippingProgressMessage,
  shippingQuote,
  totalCommissionRate,
} from "./policy";

const settings = DEFAULT_COMMERCE_SETTINGS;
const product = (price: number): PricedProduct => ({
  id: "p1",
  name: "Producto",
  slug: "producto",
  price,
  stock: 2,
  active: true,
});

describe("despacho gratis sobre $100.000", () => {
  it("no lo activa en $99.990", () => {
    expect(qualifiesForFreeShipping(99_990, settings)).toBe(false);
    expect(shippingQuote(99_990, "despacho", settings).cost).toBe(3_000);
  });

  it("en $100.000 aplica el umbral estricto y todavía cobra despacho", () => {
    expect(qualifiesForFreeShipping(100_000, settings)).toBe(false);
    expect(shippingQuote(100_000, "despacho", settings).cost).toBe(3_000);
    expect(shippingProgressMessage(100_000, settings)).toBe(
      "Te faltan $1 para obtener despacho gratis.",
    );
  });

  it("lo activa desde $100.001 y no vuelve a sumar el despacho", () => {
    const quote = shippingQuote(100_001, "despacho", settings);
    expect(quote.free).toBe(true);
    expect(quote.cost).toBe(0);
    const order = quoteOrder(
      [{ productId: "p1", quantity: 1, expectedUnitPrice: 100_001 }],
      new Map([["p1", product(100_001)]]),
      "despacho",
      settings,
    );
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    expect(order.quote.total).toBe(100_001);
    const preference = buildPreferenceItems(order.quote);
    expect(preference.ok).toBe(true);
    if (!preference.ok) return;
    const charged = preference.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );
    expect(charged).toBe(order.quote.total);
  });
});

describe("comisiones y precio recomendado", () => {
  it("suma una sola vez la tarjeta y las cuotas", () => {
    expect(totalCommissionRate(settings)).toBeCloseTo(0.0618, 5);
    expect(totalCommissionRate(settings)).not.toBeCloseTo(0.1236, 5);
  });

  it("cubre el costo y la ganancia después de la comisión", () => {
    const result = pricePlan({
      cost: 70_000,
      profitAmount: 20_000,
      cardFeePercent: 2.69,
      installmentsFeePercent: 3.49,
      shippingAssumed: 0,
      otherCosts: 0,
      installmentCount: 6,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.recommendedPrice).toBe(95_929);
    expect(result.plan.net).toBeGreaterThanOrEqual(90_000);
    expect(result.plan.commission).toBe(Math.round(95_929 * 0.0618));
  });

  it("rechaza una tasa inválida", () => {
    expect(parseCommerceSettings({ ...settings, cardFeePercent: 100 }).ok).toBe(false);
    expect(parseCommerceSettings({ ...settings, cardFeePercent: -1 }).ok).toBe(false);
    expect(
      pricePlan({
        cost: 1000,
        profitAmount: 100,
        cardFeePercent: 80,
        installmentsFeePercent: 30,
        shippingAssumed: 0,
        otherCosts: 0,
        installmentCount: 6,
      }).ok,
    ).toBe(false);
  });

  it("divide el total en seis cuotas que suman el precio", () => {
    const plan = installmentPlan(95_929, 6);
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.count).toBe(6);
    expect(plan.amount * 5 + plan.lastAmount).toBe(95_929);
    expect(Math.round(95_929 / 6)).toBe(15_988);
  });
});

describe("permiso de la configuración comercial", () => {
  it("solo un administrador puede guardarla", () => {
    expect(canEditCommerce(true)).toBe(true);
    expect(canEditCommerce(false)).toBe(false);
  });

  it("conserva los valores al leerlos de nuevo", () => {
    const saved = parseCommerceSettings({
      ...settings,
      freeShippingMinClp: 120_000,
      baseShippingClp: 4_500,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const again = parseCommerceSettings(saved.settings);
    expect(again).toEqual(saved);
  });
});
