export type MailLine = { name: string; quantity: number; lineTotal: number };

export type MailOrder = {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillment: "retiro" | "despacho";
  address: string | null;
  items: MailLine[];
  subtotal: number;
  shippingCost: number | null;
  total: number;
};

export type MailKind = "placed" | "paid";

export type MailMessage = { subject: string; text: string };

function clp(value: number) {
  return `$${Math.round(value).toLocaleString("es-CL")}`;
}

function body(order: MailOrder, intro: string) {
  const lines = order.items.map(
    (item) => `• ${item.name} x${item.quantity} — ${clp(item.lineTotal)}`,
  );
  const shipping = order.shippingCost == null ? "Por confirmar" : clp(order.shippingCost);
  return [
    intro,
    "",
    `Pedido: ${order.orderId}`,
    `Nombre: ${order.customerName}`,
    `Correo: ${order.customerEmail}`,
    `Teléfono: ${order.customerPhone}`,
    `Entrega: ${order.fulfillment === "retiro" ? "Retiro" : "Despacho"}`,
    ...(order.address ? [`Dirección: ${order.address}`] : []),
    "",
    ...lines,
    "",
    `Subtotal: ${clp(order.subtotal)}`,
    `Despacho: ${shipping}`,
    `Total: ${clp(order.total)}`,
    "",
    "Elpuntofertas · Santiago",
  ].join("\n");
}

export function orderMessages(
  order: MailOrder,
  kind: MailKind,
): { buyer: MailMessage; store: MailMessage } {
  if (kind === "paid") {
    return {
      buyer: {
        subject: `Pago confirmado · pedido ${order.orderId}`,
        text: body(
          order,
          "Tu pago fue confirmado. Esta es la copia de tu compra en Elpuntofertas.",
        ),
      },
      store: {
        subject: `Pedido pagado ${order.orderId} · ${clp(order.total)}`,
        text: body(order, "Mercado Pago confirmó el pago de este pedido."),
      },
    };
  }
  return {
    buyer: {
      subject: `Copia de tu pedido ${order.orderId}`,
      text: body(
        order,
        "Recibimos tu pedido en Elpuntofertas. Si pagas con Mercado Pago, el pago se confirma cuando ellos lo aprueban.",
      ),
    },
    store: {
      subject: `Nuevo pedido ${order.orderId} · ${order.customerName} · ${clp(order.total)}`,
      text: body(order, "Entró un pedido nuevo en Elpuntofertas."),
    },
  };
}
