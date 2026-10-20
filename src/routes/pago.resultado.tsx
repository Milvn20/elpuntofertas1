import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { orderSummaryText, type Fulfillment, type QuoteLine } from "@/lib/orders/pricing";
import { confirmMercadoPagoReturn, syncMercadoPagoOrder } from "@/lib/payments/mercadopago.functions";
import { formatCLP, SITE, whatsappTextLink } from "@/lib/site";

type Receipt = {
  orderId: string;
  customerName: string;
  fulfillment: Fulfillment;
  address: string | null;
  items: Array<{ name: string; quantity: number; lineTotal: number }>;
  subtotal: number;
  shippingCost: number | null;
  shippingNote: string;
  total: number;
  status: string;
  paymentStatus: string;
  mercadoPagoStatus: string | null;
};

type View = {
  tone: "wait" | "ok" | "pending" | "bad";
  message: string;
  receipt: Receipt | null;
};

export const Route = createFileRoute("/pago/resultado")({
  head: () => ({
    meta: [
      { title: `Confirmación de compra · ${SITE.name}` },
      { name: "description", content: "Comprobante del pedido verificado con Mercado Pago." },
    ],
  }),
  component: PaymentResultPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de preparación",
  confirmed: "Confirmado",
  ready: "Listo para entrega",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

function PaymentResultPage() {
  const [state, setState] = useState<View>({
    tone: "wait",
    message: "Estamos confirmando el pago con Mercado Pago.",
    receipt: null,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id") || params.get("collection_id") || "";
    const orderId = params.get("external_reference") || params.get("pedido") || "";
    if (!orderId) {
      setState({ tone: "bad", message: "No encontramos el pedido. Si ya pagaste, escríbenos por WhatsApp con el comprobante de Mercado Pago.", receipt: null });
      return;
    }
    const request = paymentId
      ? confirmMercadoPagoReturn({ data: { orderId, paymentId } })
      : syncMercadoPagoOrder({ data: { orderId } });
    request
      .then((result) => {
        const tone = result.ok && result.status === "approved" ? "ok" : result.ok && result.status === "pending" ? "pending" : "bad";
        setState({ tone, message: result.message, receipt: result.receipt ?? null });
      })
      .catch(() => setState({ tone: "bad", message: "Volviste desde Mercado Pago, pero no pudimos confirmar el pago.", receipt: null }));
  }, []);

  const receipt = state.receipt;
  const lines: QuoteLine[] = (receipt?.items ?? []).map((item, index) => ({
    productId: String(index),
    name: item.name,
    slug: "",
    quantity: item.quantity,
    unitPrice: item.quantity > 0 ? Math.round(item.lineTotal / item.quantity) : item.lineTotal,
    lineTotal: item.lineTotal,
  }));
  const whatsapp = receipt
    ? orderSummaryText({
      customerName: receipt.customerName || "Cliente",
      items: lines,
      subtotal: receipt.subtotal,
      shippingNote: receipt.shippingNote,
      total: receipt.total,
      fulfillment: receipt.fulfillment,
      address: receipt.address,
      orderId: receipt.orderId,
      registered: true,
    })
    : "";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-4 py-16 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Orden de compra</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tighter">
          {state.tone === "ok" ? "Compra confirmada" : state.tone === "pending" ? "Pago pendiente" : state.tone === "bad" ? "Pago no confirmado" : "Confirmando pago"}
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">{state.message}</p>
        {receipt && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm">Pedido <span className="font-mono">{receipt.orderId}</span></p>
            <p className="mt-1 text-sm">Para: {receipt.customerName}</p>
            <p className="mt-1 text-sm">{STATUS_LABEL[receipt.status] ?? receipt.status} · {receipt.paymentStatus === "paid" ? "Pagado con Mercado Pago" : "Pago aún no acreditado"}</p>
            <p className="mt-3 text-sm font-semibold">{receipt.fulfillment === "retiro" ? "Retiro en tienda" : "Despacho"}</p>
            {receipt.address && <p className="text-sm text-muted-foreground">{receipt.address}</p>}
            <ul className="mt-4 space-y-2 text-sm">
              {receipt.items.map((item, index) => (
                <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
                  <span>{item.name} × {item.quantity}</span>
                  <span>{formatCLP(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
              <p className="flex justify-between"><span>Productos</span><span>{formatCLP(receipt.subtotal)}</span></p>
              <p className="flex justify-between"><span>Despacho</span><span>{receipt.shippingCost == null ? "Por confirmar" : formatCLP(receipt.shippingCost)}</span></p>
              <p className="text-xs text-muted-foreground">{receipt.shippingNote}</p>
              <p className="flex justify-between text-base font-extrabold"><span>Total pagado</span><span>{formatCLP(receipt.total)}</span></p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {state.tone === "ok"
                ? "La tienda ya recibió el pedido en su panel. Te contactamos por WhatsApp para coordinar la entrega."
                : "El pedido quedó guardado. La tienda lo ve en su panel y confirma el pago directo con Mercado Pago."}
            </p>
            <a href={whatsappTextLink(`${state.tone === "ok" ? "Hola, ya pagué esta compra.\n\n" : "Hola, necesito confirmar esta compra.\n\n"}${whatsapp}`)} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-whatsapp px-5 py-3 text-sm font-semibold text-whatsapp-foreground">
              Enviar comprobante por WhatsApp
            </a>
          </section>
        )}
        <Link to="/catalogo" className="mt-8 inline-flex rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background">Volver al catálogo</Link>
      </main>
      <SiteFooter />
    </div>
  );
}
