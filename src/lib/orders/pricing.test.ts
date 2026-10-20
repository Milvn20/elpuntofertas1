import { describe, expect, it } from "vitest";
import { cartCount, cartSubtotal, clampQuantity, setCartQuantity, upsertCartItem } from "../cart/logic";
import { discountPercent, quoteOrder, shippingFor, type PricedProduct } from "./pricing";
import { validateProductDraft } from "../products/validate";

const bike: PricedProduct = { id: "p1", name: "Bici", slug: "bici", price: 15000, stock: 2, active: true };

describe("carrito", () => {
  it("no supera el stock ni acepta cantidades negativas", () => {
    expect(clampQuantity(5, 2)).toBe(2);
    expect(clampQuantity(0, 2)).toBe(0);
    expect(clampQuantity(-3, 4)).toBe(0);
  });

  it("calcula cantidad y subtotal con el precio listado", () => {
    const added = upsertCartItem([], { productId: "p1", slug: "bici", name: "Bici", imageUrl: null, listedPrice: 10000.4, listedStock: 3, active: true, quantity: 2 });
    expect(added.ok).toBe(true);
    expect(cartCount(added.items)).toBe(2);
    expect(cartSubtotal(added.items)).toBe(20000);
    expect(setCartQuantity(added.items, "p1", 1)[0]?.quantity).toBe(1);
  });

  it("rechaza productos sin stock", () => {
    const result = upsertCartItem([], { productId: "p1", slug: "bici", name: "Bici", imageUrl: null, listedPrice: 1000, listedStock: 0, active: true });
    expect(result.ok).toBe(false);
    expect(result.items).toHaveLength(0);
  });
});

describe("cotización de pedido", () => {
  it("usa el precio del catálogo y no el enviado por el cliente", () => {
    const result = quoteOrder(
      [{ productId: "p1", quantity: 2, expectedUnitPrice: 15000 }],
      new Map([[bike.id, bike]]),
      "retiro",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.subtotal).toBe(30000);
    expect(result.quote.shippingCost).toBe(0);
    expect(result.quote.total).toBe(30000);
  });

  it("rechaza un producto que no está en el catálogo", () => {
    const result = quoteOrder([{ productId: "no-existe", quantity: 1, expectedUnitPrice: 1000 }], new Map(), "retiro");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unavailable");
  });

  it("detiene el pedido si el precio esperado no coincide", () => {
    const result = quoteOrder(
      [{ productId: "p1", quantity: 1, expectedUnitPrice: 1000 }],
      new Map([[bike.id, bike]]),
      "retiro",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("price_changed");
    expect(result.quote?.items[0]?.unitPrice).toBe(15000);
  });

  it("no registra cantidades mayores al stock", () => {
    const result = quoteOrder([{ productId: "p1", quantity: 5, expectedUnitPrice: 15000 }], new Map([[bike.id, bike]]), "despacho");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("stock_changed");
    expect(result.quote?.items[0]?.quantity).toBe(2);
  });

  it("cobra el despacho base bajo el umbral y lo deja gratis al superarlo", () => {
    const cheap = { ...bike, price: 10000, stock: 1 };
    const result = quoteOrder([{ productId: "p1", quantity: 1, expectedUnitPrice: 10000 }], new Map([[cheap.id, cheap]]), "despacho");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quote.shippingCost).toBe(3000);
    expect(result.quote.total).toBe(13000);
    expect(shippingFor(100_001, "despacho").cost).toBe(0);
    expect(shippingFor(100_001, "retiro").cost).toBe(0);
  });

  it("solo calcula descuento con un precio anterior real y mayor", () => {
    expect(discountPercent(8000, 10000)).toBe(20);
    expect(discountPercent(10000, 8000)).toBeNull();
    expect(discountPercent(10000, null)).toBeNull();
  });
});

describe("validación de producto", () => {
  it("rechaza precio negativo y precio anterior inválido", () => {
    expect(validateProductDraft({ name: "Bici", slug: "bici-roja", price: -1, stock: 1, minStock: 1 })).toMatch(/negativo/);
    expect(validateProductDraft({ name: "Bici", slug: "bici-roja", price: 1000, previousPrice: 1000, stock: 1, minStock: 1 })).toMatch(/precio anterior/);
    expect(validateProductDraft({ name: "Bici", slug: "bici-roja", price: 1000, previousPrice: 1500, stock: 1, minStock: 1 })).toBeNull();
  });
});
