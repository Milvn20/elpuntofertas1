export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
  listedPrice: number;
  listedStock: number;
  active: boolean;
};

export function clampQuantity(quantity: number, stock: number): number {
  const qty = Math.floor(Number(quantity));
  const max = Math.floor(Number(stock));
  if (!Number.isFinite(qty) || qty < 1) return 0;
  if (!Number.isFinite(max) || max < 1) return 0;
  return Math.min(qty, max);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(0, Math.floor(item.quantity)), 0);
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.listedPrice) * Math.max(0, Math.floor(item.quantity)), 0);
}

export function upsertCartItem(items: CartItem[], incoming: Omit<CartItem, "quantity"> & { quantity?: number }): { items: CartItem[]; message: string; ok: boolean } {
  if (!incoming.active) {
    return { items, ok: false, message: "Este producto no está publicado." };
  }
  const stock = Math.floor(incoming.listedStock);
  if (!Number.isFinite(stock) || stock < 1) {
    return { items, ok: false, message: "Sin stock disponible." };
  }
  const addQty = clampQuantity(incoming.quantity ?? 1, stock);
  if (addQty < 1) return { items, ok: false, message: "La cantidad no es válida." };

  const index = items.findIndex((item) => item.productId === incoming.productId);
  if (index === -1) {
    return {
      ok: true,
      message: "Producto agregado al carrito.",
      items: [...items, { ...incoming, quantity: addQty, listedStock: stock, listedPrice: Math.round(incoming.listedPrice) }],
    };
  }
  const current = items[index]!;
  const nextQty = clampQuantity(current.quantity + addQty, stock);
  if (nextQty === current.quantity) {
    return { items, ok: false, message: `Solo hay ${stock} unidad${stock === 1 ? "" : "es"} disponibles.` };
  }
  const next = items.slice();
  next[index] = {
    ...current,
    ...incoming,
    quantity: nextQty,
    listedStock: stock,
    listedPrice: Math.round(incoming.listedPrice),
  };
  const capped = current.quantity + addQty > stock;
  return {
    ok: true,
    message: capped ? `Se ajustó la cantidad al stock disponible (${stock}).` : "Cantidad actualizada.",
    items: next,
  };
}

export function setCartQuantity(items: CartItem[], productId: string, quantity: number): CartItem[] {
  return items.flatMap((item) => {
    if (item.productId !== productId) return [item];
    const next = clampQuantity(quantity, item.listedStock);
    if (next < 1) return [];
    return [{ ...item, quantity: next }];
  });
}

export function removeCartItem(items: CartItem[], productId: string): CartItem[] {
  return items.filter((item) => item.productId !== productId);
}

export function applyServerQuote(
  items: CartItem[],
  lines: Array<{ productId: string; unitPrice: number; quantity: number; name: string; slug: string }>,
  stockById?: Map<string, number>,
): CartItem[] {
  return items.map((item) => {
    const line = lines.find((entry) => entry.productId === item.productId);
    if (!line) return { ...item, active: false };
    const stock = stockById?.get(item.productId);
    return {
      ...item,
      name: line.name,
      slug: line.slug,
      listedPrice: line.unitPrice,
      quantity: stock != null ? clampQuantity(item.quantity, stock) || item.quantity : item.quantity,
      listedStock: stock ?? item.listedStock,
      active: true,
    };
  });
}
