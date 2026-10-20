export const SITE = {
  name: "Elpuntofertas",
  tagline: "Ofertas reales, stock real",
  city: "Santiago, Chile",
  whatsapp: "56956509004",
  instagram: "elpuntofertas",
  hours: "Lun a Sáb · 10:00 – 20:00",
  shippingBanner: "🚚 Despacho gratis en compras sobre $100.000",
} as const;

export function whatsappLink(productName: string) {
  const message = `Hola, vi este producto en su página web:\n\n${productName}\n\nQuisiera consultar si aún tiene stock disponible, cuál es el método de pago y cómo funciona la entrega o retiro.\n\nQuedo atento. Gracias.`;
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function whatsappGeneral() {
  const message = "Hola, los contacto desde su catálogo en línea. Quisiera hacer una consulta sobre sus productos.";
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function whatsappTextLink(text: string) {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
}

export function formatCLP(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}

export function conditionLabel(c: string | null | undefined) {
  switch (c) {
    case "nuevo": return "Nuevo";
    case "seminuevo": return "Seminuevo";
    case "usado": return "Usado";
    default: return "—";
  }
}

export function availability(stock: number, minStock: number) {
  if (stock <= 0) return { label: "Sin stock", tone: "out" as const };
  if (stock <= minStock) return { label: "Últimas unidades", tone: "low" as const };
  return { label: "Disponible", tone: "ok" as const };
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}