import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Package, Tag, ShoppingBag, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { availability, conditionLabel, formatCLP, whatsappLink, SITE } from "@/lib/site";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/data/catalog";
import type { ProductRecord } from "@/lib/db/types";
import { discountPercent } from "@/lib/orders/pricing";
import { useCart } from "@/lib/cart/cart-context";
import { useCommerceSettings } from "@/lib/commerce/context";
import { displayInstallmentAmount, shippingProgressMessage } from "@/lib/commerce/policy";

export const Route = createFileRoute("/producto/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} · ${SITE.name}` },
      { name: "description", content: `Detalle de producto en ${SITE.name}. Stock y precio publicados en el catálogo.` },
    ],
  }),
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const cart = useCart();
  const commerce = useCommerceSettings();
  const [p, setP] = useState<ProductRecord | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setP(undefined);
    setError(null);
    setActive(0);
    setQuantity(1);
    fetchProductBySlug(slug).then(async ({ product, error: loadError }) => {
      if (cancelled) return;
      setError(loadError);
      setP(product);
      if (!product || loadError) {
        setRelated([]);
        return;
      }
      const rel = await fetchRelatedProducts(product);
      if (!cancelled) setRelated(rel.data);
    });
    return () => { cancelled = true; };
  }, [slug, attempt]);

  if (p === undefined && !error) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 py-20 text-sm text-muted-foreground">Cargando producto…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold">No pudimos cargar el producto</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold">Producto no encontrado</h1>
          <p className="mt-2 text-muted-foreground">No hay un producto publicado con esta dirección.</p>
          <Link to="/catalogo" className="mt-6 inline-block text-sm font-semibold underline">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  const images = [...(p.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder);
  const av = availability(p.stock, p.minStock);
  const discount = discountPercent(p.price, p.previousPrice);
  const maxQty = Math.max(p.stock, 0);
  const installmentAmount = commerce.showInstallments ? displayInstallmentAmount(p.price, commerce.installmentCount) : null;

  function addToCart() {
    const result = cart.addItem({
      productId: p!.id,
      slug: p!.slug,
      name: p!.name,
      imageUrl: p!.imageUrl ?? images[0]?.url ?? null,
      listedPrice: p!.price,
      listedStock: p!.stock,
      active: p!.active,
      quantity,
    });
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <Link to="/catalogo" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Catálogo
        </Link>
      </div>
      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 md:grid-cols-2 md:px-6">
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
            {images[active]?.url ? (
              <img src={images[active].url} alt={p.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-xs uppercase tracking-widest text-muted-foreground">Sin imagen</div>
            )}
            {images.length > 1 && (
              <>
                <button type="button" onClick={() => setActive((i) => (i - 1 + images.length) % images.length)} aria-label="Imagen anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => setActive((i) => (i + 1) % images.length)} aria-label="Imagen siguiente" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button key={`${img.url}-${i}`} type="button" onClick={() => setActive(i)} aria-label={`Ver imagen ${i + 1}`} className={`aspect-square overflow-hidden rounded-md border ${i === active ? "border-foreground" : "border-border"}`}>
                  <img src={img.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            {p.categoryName && <span>{p.categoryName}</span>}
            {p.internalCode && <span>Cód. {p.internalCode}</span>}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">{p.name}</h1>
          {p.brand && <p className="mt-1 text-muted-foreground">{p.brand}{p.model ? ` · ${p.model}` : ""}</p>}
          <div className="my-6 flex flex-wrap items-baseline gap-3">
            <p className="text-4xl font-extrabold">{formatCLP(p.price)}</p>
            {discount != null && p.previousPrice != null && (
              <>
                <p className="text-lg text-muted-foreground line-through">{formatCLP(p.previousPrice)}</p>
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">-{discount}%</span>
              </>
            )}
            <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-widest ${av.tone === "ok" ? "bg-whatsapp/15 text-whatsapp" : av.tone === "low" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
              {av.label}
            </span>
          </div>
          <div className="mb-6 space-y-1 text-sm text-muted-foreground">
            {installmentAmount != null && (
              <p>
                Simulación: {commerce.installmentCount} cuotas de {formatCLP(installmentAmount)}. El interés lo confirma Mercado Pago al pagar; esta tienda no agrega un recargo.
              </p>
            )}
            <p>{shippingProgressMessage(p.price, commerce)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-border">
              <button type="button" aria-label="Disminuir cantidad" className="p-3" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="size-4" /></button>
              <span className="min-w-8 text-center text-sm font-semibold">{quantity}</span>
              <button type="button" aria-label="Aumentar cantidad" className="p-3" onClick={() => setQuantity((q) => Math.min(maxQty || 1, q + 1))}><Plus className="size-4" /></button>
            </div>
            <button type="button" onClick={addToCart} disabled={av.tone === "out"} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground disabled:bg-muted disabled:text-muted-foreground">
              <ShoppingBag className="size-4" /> Agregar al carrito
            </button>
          </div>
          <a href={whatsappLink(p.name)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-3 text-sm font-semibold text-whatsapp-foreground">
            <MessageCircle className="size-4" /> Consultar por WhatsApp
          </a>
          {p.description && (
            <div className="mt-8">
              <h2 className="text-xl font-extrabold tracking-tight">Descripción</h2>
              <p className="mt-2 whitespace-pre-line text-base leading-relaxed">{p.description}</p>
            </div>
          )}
          <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm">
            <div className="flex items-start gap-2">
              <Tag className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Condición</dt>
                <dd className="font-semibold">{conditionLabel(p.condition)}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">Stock</dt>
                <dd className="font-semibold">{p.stock} unidad{p.stock === 1 ? "" : "es"}</dd>
              </div>
            </div>
          </dl>
        </div>
      </section>
      {related.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <h2 className="text-2xl font-extrabold tracking-tighter">También te puede interesar</h2>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {related.map((rp) => <ProductCard key={rp.id} p={rp} />)}
            </div>
          </div>
        </section>
      )}
      <SiteFooter />
    </div>
  );
}
