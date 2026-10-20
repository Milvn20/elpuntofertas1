import { describe, expect, it } from "vitest";
import { orderMessages, type MailOrder } from "./mail";

const order: MailOrder = {
  orderId: "abc",
  customerName: "Ana Pérez",
  customerEmail: "ana@example.com",
  customerPhone: "56911111111",
  fulfillment: "despacho",
  address: "Calle 1, Santiago",
  items: [{ name: "Buzo", quantity: 1, lineTotal: 20000 }],
  subtotal: 20000,
  shippingCost: 3000,
  total: 23000,
};

describe("correos de pedido", () => {
  it("manda al comprador la copia y a la tienda el aviso", () => {
    const messages = orderMessages(order, "placed");
    expect(messages.buyer.subject).toContain("abc");
    expect(messages.buyer.text).toContain("ana@example.com");
    expect(messages.buyer.text).toContain("$23.000");
    expect(messages.store.subject).toContain("Nuevo pedido");
    expect(messages.store.text).toContain("Ana Pérez");
  });

  it("distingue un pedido pagado de uno recién ingresado", () => {
    const paid = orderMessages(order, "paid");
    expect(paid.buyer.subject).toContain("Pago confirmado");
    expect(paid.store.subject).toContain("Pedido pagado");
    expect(paid.buyer.text).not.toContain("Nuevo pedido");
  });
});
