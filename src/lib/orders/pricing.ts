export const FREE_SHIPPING_MIN_CLP = 20_000;

export type Fulfillment = "retiro" | "despacho";

export type PricedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  active: boolean;
};

export type QuoteLineRequest = {
  productId: string;
  quantity: number;
  expectedUnitPrice?: number | null;
};

export type QuoteLine = {
  productId: string;
  name: string;
  slug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderQuote = {
  items: QuoteLine[];
  subtotal: number;
  shippingCost: number | null;
  shippingNote: string;
  total: number;
  fulfillment: Fulfillment;
};

export type QuoteFailure = {
  ok: false;
  code: "invalid" | "price_changed" | "stock_changed" | "unavailable";
  message: string;
  quote?: OrderQuote;
};

export type QuoteSuccess = { ok: true; quote: OrderQuote };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function clp(value: number): number {
  return Math.round(value);
}

export function shippingFor(subtotal: number, fulfillment: Fulfillment): { cost: number | null; note: string } {
  if (fulfillment === "retiro") {
    return { cost: 0, note: "Retiro coordinado. Este pedido no incluye costo de despacho." };
  }
  if (subtotal >= FREE_SHIPPING_MIN_CLP) {
    return {
      cost: 0,
      note: "Despacho sin costo: la compra alcanza los $20.000 indicados por la tienda.",
    };
  }
  return {
    cost: null,
    note: "El despacho bajo $20.000 se confirma por WhatsApp y no está incluido en el total.",
  };
}

export function discountPercent(price: number, previousPrice?: number | null): number | null {
  const current = Number(price);
  const previous = previousPrice == null ? null : Number(previousPrice);
  if (previous == null || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (previous <= current || previous <= 0 || current < 0) return null;
  return Math.round((1 - current / previous) * 100);
}

function mergeLines(lines: QuoteLineRequest[]): QuoteLineRequest[] {
  const map = new Map<string, QuoteLineRequest>();
  for (const line of lines) {
    const id = line.productId?.trim();
    if (!id) continue;
    const prev = map.get(id);
    const quantity = Math.floor(Number(line.quantity));
    if (!prev) {
      map.set(id, { productId: id, quantity, expectedUnitPrice: line.expectedUnitPrice });
      continue;
    }
    prev.quantity += Number.isFinite(quantity) ? quantity : 0;
    if (line.expectedUnitPrice != null) prev.expectedUnitPrice = line.expectedUnitPrice;
  }
  return [...map.values()];
}

export function quoteOrder(
  requested: QuoteLineRequest[],
  products: Map<string, PricedProduct>,
  fulfillment: Fulfillment,
): QuoteSuccess | QuoteFailure {
  if (fulfillment !== "retiro" && fulfillment !== "despacho") {
    return { ok: false, code: "invalid", message: "Elige retiro o despacho." };
  }
  const lines = mergeLines(requested);
  if (lines.length === 0) return { ok: false, code: "invalid", message: "El carrito está vacío." };
  if (lines.length > 40) return { ok: false, code: "invalid", message: "El pedido tiene demasiados productos distintos." };

  const freshItems: QuoteLine[] = [];
  let priceChanged = false;
  let stockChanged = false;

  for (const line of lines) {
    const product = products.get(line.productId);
    if (!product || !product.active) {
      return {
        ok: false,
        code: "unavailable",
        message: "Uno o más productos ya no están publicados. Revisa el carrito.",
      };
    }
    const quantity = Math.floor(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return { ok: false, code: "invalid", message: "Hay una cantidad inválida en el carrito." };
    }
    if (!Number.isFinite(product.price) || product.price < 0) {
      return { ok: false, code: "invalid", message: `El precio de «${product.name}» no es válido.` };
    }
    const stock = Math.floor(Number(product.stock));
    const stockShort = !Number.isFinite(stock) || stock < quantity;
    if (stockShort) stockChanged = true;
    const unitPrice = clp(product.price);
    if (line.expectedUnitPrice == null || clp(Number(line.expectedUnitPrice)) !== unitPrice) {
      priceChanged = true;
    }
    const safeStock = Number.isFinite(stock) ? stock : 0;
    const billableQty = stockShort ? Math.min(quantity, safeStock) : quantity;
    freshItems.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      quantity: billableQty,
      unitPrice,
      lineTotal: unitPrice * billableQty,
    });
  }

  const subtotal = freshItems.reduce((sum, line) => sum + line.lineTotal, 0);
  const shipping = shippingFor(subtotal, fulfillment);
  const quote: OrderQuote = {
    items: freshItems,
    subtotal,
    shippingCost: shipping.cost,
    shippingNote: shipping.note,
    total: subtotal + (shipping.cost ?? 0),
    fulfillment,
  };

  if (stockChanged) {
    return {
      ok: false,
      code: "stock_changed",
      message: "El stock cambió. Ajusta las cantidades antes de registrar el pedido.",
      quote,
    };
  }
  if (priceChanged) {
    return {
      ok: false,
      code: "price_changed",
      message: "El precio de algún producto cambió. Revisa el total y confirma de nuevo.",
      quote,
    };
  }
  return { ok: true, quote };
}

export function orderSummaryText(input: {
  customerName: string;
  items: QuoteLine[];
  subtotal: number;
  shippingNote: string;
  total: number;
  fulfillment: Fulfillment;
  orderId?: string;
  registered: boolean;
}): string {
  const lines = input.items.map((item) => `• ${item.name} x${item.quantity} — $${item.lineTotal.toLocaleString("es-CL")}`);
  const header = input.registered
    ? `Hola, acabo de registrar un pedido en Elpuntofertas${input.orderId ? ` (${input.orderId})` : ""}.`
    : "Hola, quiero consultar este pedido. Aún no quedó registrado en la tienda.";
  return [
    header,
    `Nombre: ${input.customerName}`,
    `Entrega: ${input.fulfillment === "retiro" ? "Retiro" : "Despacho"}`,
    ...lines,
    `Subtotal productos: $${input.subtotal.toLocaleString("es-CL")}`,
    input.shippingNote,
    `Total de productos${input.shippingNote.includes("no está incluido") ? "" : " (con despacho indicado)"}: $${input.total.toLocaleString("es-CL")}`,
  ].join("\n");
}
