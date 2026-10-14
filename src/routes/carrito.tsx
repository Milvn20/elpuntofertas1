import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { useCart } from "@/lib/cart/cart-context";
import { formatCLP, SITE, whatsappTextLink } from "@/lib/site";
import { orderSummaryText, shippingFor, type Fulfillment } from "@/lib/orders/pricing";
import { createOrder } from "@/lib/orders.functions";
import type { CartItem } from "@/lib/cart/logic";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [
      { title: `Carrito · ${SITE.name}` },
      { name: "description", content: "Revisa tu carrito y registra un pedido para coordinar el pago por WhatsApp." },
    ],
  }),
  component: CartPage,
});

function requestId() {
  const key = "elpuntofertas.orderRequest";
  const current = sessionStorage.getItem(key);
  if (current) return current;
  const next = crypto.randomUUID();
  sessionStorage.setItem(key, next);
  return next;
}

function CartPage() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<Fulfillment>("retiro");
  const [saving, setSaving] = useState(false);
  const [registered, setRegistered] = useState<{ id: string; total: number; note: string; text: string } | null>(null);

  const shipping = useMemo(() => shippingFor(cart.subtotal, fulfillment), [cart.subtotal, fulfillment]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || cart.items.length === 0) return;
    setSaving(true);
    try {
      const result = await createOrder({
        data: {
          clientRequestId: requestId(),
          customerName: name,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            expectedUnitPrice: item.listedPrice,
          })),
        },
      });
      if (!result.ok) {
        if (result.quote) {
          const stock = new Map(result.quote.items.map((line) => [line.productId, line.quantity]));
          cart.replaceItems(cart.items.flatMap((item) => {
            const line = result.quote?.items.find((entry) => entry.productId === item.productId);
            if (!line) return [];
            const next: CartItem = { ...item, listedPrice: line.unitPrice, name: line.name, slug: line.slug, quantity: Math.max(1, stock.get(item.productId) || item.quantity) };
            return [next];
          }));
        }
        toast.error(result.message);
        return;
      }
      sessionStorage.removeItem("elpuntofertas.orderRequest");
      cart.clear();
      const text = "whatsappText" in result && result.whatsappText
        ? result.whatsappText
        : orderSummaryText({
          customerName: name,
          items: result.items,
          subtotal: result.subtotal,
          shippingNote: result.shippingNote,
          total: result.total,
          fulfillment: result.fulfillment,
          orderId: result.orderId,
          registered: true,
        });
      setRegistered({ id: result.orderId, total: result.total, note: result.shippingNote, text });
      toast.success(result.alreadyExisted ? "Este pedido ya estaba registrado" : "Pedido registrado");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo registrar el pedido. La compra no quedó confirmada.");
    } finally {
      setSaving(false);
    }
  }

  const consultText = orderSummaryText({
    customerName: name || "Cliente",
    items: cart.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      slug: item.slug,
      quantity: item.quantity,
      unitPrice: item.listedPrice,
      lineTotal: item.listedPrice * item.quantity,
    })),
    subtotal: cart.subtotal,
    shippingNote: shipping.note,
    total: cart.subtotal + (shipping.cost ?? 0),
    fulfillment,
    registered: false,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tighter">Carrito</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Los precios que ves aquí son una referencia. Al registrar el pedido, el servidor vuelve a leer el precio y el stock. El pago no se cobra en el sitio: se coordina por WhatsApp.
        </p>
        {registered ? (
          <section className="mt-8 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-2xl font-extrabold">Pedido registrado</h2>
            <p className="mt-2 text-sm">Identificador: <span className="font-mono">{registered.id}</span></p>
            <p className="mt-1 text-sm">Total de productos: {formatCLP(registered.total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{registered.note}</p>
            <p className="mt-3 text-sm">El stock no se descuenta hasta que la tienda confirme la entrega. El estado queda pendiente.</p>
            <a href={whatsappTextLink(registered.text)} target="_blank" rel="noreferrer" className="mt-6 inline-flex rounded-full bg-whatsapp px-5 py-3 text-sm font-semibold text-whatsapp-foreground">
              Enviar resumen por WhatsApp
            </a>
          </section>
        ) : cart.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-10 text-center">
            <p>Tu carrito está vacío.</p>
            <Link to="/catalogo" className="mt-4 inline-block text-sm font-semibold text-accent">Ir al catálogo</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <ul className="space-y-3">
              {cart.items.map((item) => (
                <li key={item.productId} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className="size-20 overflow-hidden rounded-lg bg-muted">
                    {item.imageUrl && <img src={item.imageUrl} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to="/producto/$slug" params={{ slug: item.slug }} className="font-semibold hover:underline">{item.name}</Link>
                    <p className="text-sm text-muted-foreground">{formatCLP(item.listedPrice)} · stock publicado {item.listedStock}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" aria-label="Disminuir" className="rounded-full border p-1" onClick={() => cart.setQuantity(item.productId, item.quantity - 1)}><Minus className="size-3.5" /></button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button type="button" aria-label="Aumentar" className="rounded-full border p-1" onClick={() => cart.setQuantity(item.productId, item.quantity + 1)}><Plus className="size-3.5" /></button>
                      <button type="button" aria-label="Quitar producto" className="ml-auto rounded-full border p-1 text-destructive" onClick={() => cart.removeItem(item.productId)}><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                </li>
              ))}
              <button type="button" onClick={() => cart.clear()} className="text-sm text-muted-foreground underline">Vaciar carrito</button>
            </ul>
            <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-extrabold">Datos de contacto</h2>
              <label className="block text-sm">Nombre
                <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" />
              </label>
              <label className="block text-sm">Correo
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" />
              </label>
              <label className="block text-sm">Teléfono
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" />
              </label>
              <fieldset className="space-y-2 text-sm">
                <legend className="font-semibold">Entrega</legend>
                <label className="flex gap-2"><input type="radio" name="entrega" checked={fulfillment === "retiro"} onChange={() => setFulfillment("retiro")} /> Retiro</label>
                <label className="flex gap-2"><input type="radio" name="entrega" checked={fulfillment === "despacho"} onChange={() => setFulfillment("despacho")} /> Despacho</label>
              </fieldset>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between"><span>Subtotal</span><span>{formatCLP(cart.subtotal)}</span></p>
                <p className="flex justify-between"><span>Despacho</span><span>{shipping.cost == null ? "Por confirmar" : formatCLP(shipping.cost)}</span></p>
                <p className="text-xs text-muted-foreground">{shipping.note}</p>
                <p className="flex justify-between text-base font-extrabold"><span>Total a verificar</span><span>{formatCLP(cart.subtotal + (shipping.cost ?? 0))}</span></p>
              </div>
              <button type="submit" disabled={saving} className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-60">
                {saving ? "Verificando precios…" : "Registrar pedido"}
              </button>
              <a href={whatsappTextLink(consultText)} target="_blank" rel="noreferrer" className="block text-center text-sm font-semibold text-whatsapp">
                Consultar por WhatsApp sin registrar
              </a>
            </form>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
