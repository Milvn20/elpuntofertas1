import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { useCart } from "@/lib/cart/cart-context";
import { formatCLP, SITE, whatsappTextLink } from "@/lib/site";
import { CHILE_REGIONS, formatShippingAddress, type ShippingAddress } from "@/lib/orders/address";
import { orderSummaryText, shippingFor, type Fulfillment } from "@/lib/orders/pricing";
import { createOrder } from "@/lib/orders.functions";
import { confirmMercadoPagoReturn, createMercadoPagoCheckout, mercadoPagoConfigured } from "@/lib/payments/mercadopago.functions";
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

const CHECKOUT_KEY = "elpuntofertas.checkout.v1";

const fieldClass = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5";

function CartPage() {
  const cart = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState<(typeof CHILE_REGIONS)[number]>("Metropolitana de Santiago");
  const [saveInfo, setSaveInfo] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("retiro");
  const [payWith, setPayWith] = useState<"mercadopago" | "whatsapp">("whatsapp");
  const [mpReady, setMpReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentNote, setPaymentNote] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ id: string; total: number; note: string; text: string } | null>(null);

  const shipping = useMemo(() => shippingFor(cart.subtotal, fulfillment), [cart.subtotal, fulfillment]);
  const shippingAddress: ShippingAddress | null = fulfillment === "despacho"
    ? { country: "Chile", firstName, lastName, line1, line2, postalCode, city, region }
    : null;
  const customerName = shippingAddress ? `${firstName} ${lastName}`.trim() : name;

  useEffect(() => {
    const saved = localStorage.getItem(CHECKOUT_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved) as Partial<ShippingAddress> & { email?: string; phone?: string; name?: string };
      setEmail(data.email ?? "");
      setPhone(data.phone ?? "");
      setName(data.name ?? "");
      setFirstName(data.firstName ?? "");
      setLastName(data.lastName ?? "");
      setLine1(data.line1 ?? "");
      setLine2(data.line2 ?? "");
      setPostalCode(data.postalCode ?? "");
      setCity(data.city ?? "");
      if (data.region && CHILE_REGIONS.includes(data.region)) setRegion(data.region);
      setSaveInfo(true);
    } catch {
      localStorage.removeItem(CHECKOUT_KEY);
    }
  }, []);

  useEffect(() => {
    mercadoPagoConfigured().then((result) => {
      setMpReady(result.configured);
      if (result.configured) setPayWith("mercadopago");
    }).catch(() => setMpReady(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get("payment_id") || params.get("collection_id");
    const orderId = params.get("external_reference");
    if (!paymentId || !orderId) return;
    confirmMercadoPagoReturn({ data: { orderId, paymentId } })
      .then((result) => setPaymentNote(result.message))
      .catch(() => setPaymentNote("Volviste desde Mercado Pago, pero no pudimos confirmar el pago."));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || cart.items.length === 0) return;
    setSaving(true);
    try {
      const result = await createOrder({
        data: {
          clientRequestId: requestId(),
          customerName,
          customerEmail: email,
          customerPhone: phone,
          fulfillment,
          shippingAddress,
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
      if (saveInfo) {
        localStorage.setItem(CHECKOUT_KEY, JSON.stringify({ email, phone, name, ...shippingAddress }));
      } else {
        localStorage.removeItem(CHECKOUT_KEY);
      }
      if (payWith === "mercadopago") {
        const checkout = await createMercadoPagoCheckout({ data: { orderId: result.orderId } });
        if (!checkout.ok) {
          toast.error(checkout.message);
          return;
        }
        sessionStorage.removeItem("elpuntofertas.orderRequest");
        cart.clear();
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      sessionStorage.removeItem("elpuntofertas.orderRequest");
      cart.clear();
      const text = "whatsappText" in result && result.whatsappText
        ? result.whatsappText
        : orderSummaryText({
          customerName,
          items: result.items,
          subtotal: result.subtotal,
          shippingNote: result.shippingNote,
          total: result.total,
          fulfillment: result.fulfillment,
          address: shippingAddress ? formatShippingAddress(shippingAddress) : null,
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
    customerName: customerName || "Cliente",
    address: shippingAddress && line1 ? formatShippingAddress(shippingAddress) : null,
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
          Los precios que ves aquí son una referencia. Al continuar, el servidor vuelve a leer el precio y el stock. Si pagas con Mercado Pago, te lleva a su página para terminar. La tarjeta no se escribe en esta tienda.
        </p>
        {paymentNote && <p className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">{paymentNote}</p>}
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
              <h2 className="text-lg font-extrabold">Contacto</h2>
              {fulfillment === "retiro" && (
                <label className="block text-sm">Nombre
                  <input required value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
                </label>
              )}
              <label className="block text-sm">Correo electrónico
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={fieldClass} />
              </label>
              <label className="block text-sm">Teléfono
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={fieldClass} />
              </label>
              <fieldset className="space-y-3 text-sm">
                <legend className="font-semibold">Entrega</legend>
                <label className="flex gap-2"><input type="radio" name="entrega" checked={fulfillment === "retiro"} onChange={() => setFulfillment("retiro")} /> Retiro</label>
                <label className="flex gap-2"><input type="radio" name="entrega" checked={fulfillment === "despacho"} onChange={() => setFulfillment("despacho")} /> Despacho</label>
                {fulfillment === "despacho" && (
                  <div className="space-y-3 pt-1">
                    <label className="block">País / Región
                      <input readOnly value="Chile" className={fieldClass} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">Nombre
                        <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={fieldClass} />
                      </label>
                      <label className="block">Apellidos
                        <input required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={fieldClass} />
                      </label>
                    </div>
                    <label className="block">Dirección
                      <input required value={line1} onChange={(e) => setLine1(e.target.value)} autoComplete="address-line1" className={fieldClass} />
                    </label>
                    <label className="block">Casa, apartamento, etc. (opcional)
                      <input value={line2} onChange={(e) => setLine2(e.target.value)} autoComplete="address-line2" className={fieldClass} />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">Código postal (opcional)
                        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} autoComplete="postal-code" className={fieldClass} />
                      </label>
                      <label className="block">Ciudad
                        <input required value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" className={fieldClass} />
                      </label>
                    </div>
                    <label className="block">Región
                      <select required value={region} onChange={(e) => setRegion(e.target.value as (typeof CHILE_REGIONS)[number])} autoComplete="address-level1" className={fieldClass}>
                        {CHILE_REGIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="flex items-start gap-2 text-xs text-muted-foreground">
                      <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} className="mt-0.5" />
                      Guardar mi información y consultarla más rápido la próxima vez
                    </label>
                  </div>
                )}
              </fieldset>
              <fieldset className="space-y-2 text-sm">
                <legend className="font-semibold">Pago</legend>
                <label className={`flex gap-2 rounded-xl border px-3 py-2 ${payWith === "mercadopago" ? "border-foreground bg-muted/60" : "border-border"}`}>
                  <input type="radio" name="pago" checked={payWith === "mercadopago"} onChange={() => setPayWith("mercadopago")} />
                  <span>Mercado Pago · tarjeta, débito o transferencia</span>
                </label>
                <label className={`flex gap-2 rounded-xl border px-3 py-2 ${payWith === "whatsapp" ? "border-foreground bg-muted/60" : "border-border"}`}>
                  <input type="radio" name="pago" checked={payWith === "whatsapp"} onChange={() => setPayWith("whatsapp")} />
                  <span>Registrar y coordinar por WhatsApp</span>
                </label>
                {payWith === "mercadopago" && !mpReady && (
                  <p className="text-xs text-muted-foreground">Falta pegar el Access Token de Mercado Pago en el servidor. Hasta entonces este botón no puede cobrar.</p>
                )}
              </fieldset>
              <div className="space-y-1 text-sm">
                <p className="flex justify-between"><span>Subtotal</span><span>{formatCLP(cart.subtotal)}</span></p>
                <p className="flex justify-between"><span>Despacho</span><span>{shipping.cost == null ? "Por confirmar" : formatCLP(shipping.cost)}</span></p>
                <p className="text-xs text-muted-foreground">{shipping.note}</p>
                <p className="flex justify-between text-base font-extrabold"><span>Total a verificar</span><span>{formatCLP(cart.subtotal + (shipping.cost ?? 0))}</span></p>
              </div>
              <button type="submit" disabled={saving || (payWith === "mercadopago" && !mpReady)} className="w-full rounded-full bg-[#009ee3] py-3 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Verificando precios…" : payWith === "mercadopago" ? "Pagar ahora" : "Registrar pedido"}
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
