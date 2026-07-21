import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Package, Tag, ShoppingBag, Minus, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { availability, conditionLabel, formatCLP, whatsappLink } from "@/lib/site";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { mapCard } from "@/routes/index";

export const Route = createFileRoute("/producto/$slug")({
  component: ProductDetail,
});

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  condition: string;
  price: number;
  stock: number;
  min_stock: number;
  internal_code: string | null;
  category_id: string | null;
  product_images: { id: string; url: string; is_primary: boolean; sort_order: number }[];
  categories: { name: string; slug: string } | null;
};

function ProductDetail() {
  const { slug } = Route.useParams();
  const [p, setP] = useState<Product | null | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [popular, setPopular] = useState<ProductCardData[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,slug,name,description,brand,model,condition,price,stock,min_stock,internal_code,category_id,product_images(id,url,is_primary,sort_order),categories(name,slug)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      setP((data as any) ?? null);
    })();
  }, [slug]);

    useEffect(() => {
    if (!p) return;
    (async () => {
      const select =
        "id,slug,name,brand,price,condition,stock,min_stock,internal_code,product_images(url,is_primary,sort_order),categories(name)";
      let items: any[] = [];
      if (p.category_id) {
        const { data } = await supabase
          .from("products")
          .select(select)
          .eq("is_active", true)
          .eq("category_id", p.category_id)
          .neq("id", p.id)
          .limit(8);
        items = data ?? [];
      }
      if (items.length < 4) {
        const { data } = await supabase
          .from("products")
          .select(select)
          .eq("is_active", true)
          .neq("id", p.id)
          .order("created_at", { ascending: false })
          .limit(8);
        const existing = new Set(items.map((i) => i.id));
        for (const r of data ?? []) if (!existing.has(r.id) && items.length < 8) items.push(r);
      }
      setRelated(items.map(mapCard));

      const { data: feat } = await supabase
        .from("products")
        .select(select)
        .eq("is_active", true)
        .eq("is_featured", true)
        .neq("id", p.id)
        .limit(8);
      setPopular((feat ?? []).map(mapCard));
    })();
  }, [p]);

  if (p === undefined) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 py-20 font-mono text-xs uppercase tracking-widest text-muted-foreground">Cargando…</div>
      </div>
    );
  }

  if (p === null) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-3xl font-bold">Producto no encontrado</h1>
          <p className="mt-2 text-muted-foreground">Puede haberse retirado del catálogo.</p>
          <Link to="/catalogo" className="mt-6 inline-block text-sm font-semibold underline">← Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  const images = [...p.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  const av = availability(p.stock, p.min_stock);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <Link to="/catalogo" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Catálogo
        </Link>
      </div>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 md:grid-cols-2 md:px-6">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {images[active]?.url ? (
              <img src={images[active].url} alt={p.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">Sin imagen</div>
            )}
          
          {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActive((i) => (i - 1 + images.length) % images.length)}
                  aria-label="Imagen anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow ring-1 ring-border transition hover:scale-110"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setActive((i) => (i + 1) % images.length)}
                  aria-label="Imagen siguiente"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 shadow ring-1 ring-border transition hover:scale-110"
                >
                  <ChevronRight className="size-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Ir a imagen ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === active ? "w-6 bg-foreground" : "w-1.5 bg-foreground/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActive(i)}
                  className={`aspect-square overflow-hidden rounded-md border ${i === active ? "border-foreground" : "border-border"}`}
                >
                  <img src={img.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
<div className="flex flex-col">
  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
    {p.categories && <span>{p.categories.name}</span>}
    {p.internal_code && (
      <>
        <span>·</span>
        <span>Cód. {p.internal_code}</span>
      </>
    )}
  </div>

  <h1 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">
    {p.name}
  </h1>

  {p.brand && (
    <p className="mt-1 text-muted-foreground">
      {p.brand}
      {p.model ? ` · ${p.model}` : ""}
    </p>
  )}

  <div className="my-6 flex items-baseline gap-3">
    <p className="text-4xl font-extrabold">{formatCLP(p.price)}</p>

    <span
      className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
        av.tone === "ok"
          ? "bg-whatsapp/15 text-whatsapp"
          : av.tone === "low"
            ? "bg-accent/15 text-accent"
            : "bg-destructive/15 text-destructive"
      }`}
    >
      {av.label}
    </span>
  </div>

  <a
    href={whatsappLink(p.name)}
    target="_blank"
    rel="noreferrer"
    className={`inline-flex items-center justify-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
      av.tone === "out"
        ? "pointer-events-none bg-muted text-muted-foreground"
        : "bg-whatsapp text-whatsapp-foreground"
    }`}
  >
    <MessageCircle className="size-4" />
    {av.tone === "out" ? "Sin stock disponible" : "Consultar por WhatsApp"}
  </a>

  {p.description && (
    <div className="mt-8 space-y-3">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
        Descripción
      </h2>
      <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
        {p.description}
      </p>
    </div>
  )}

  <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 text-sm">
    <div className="flex items-start gap-2">
      <Tag className="mt-0.5 size-4 text-muted-foreground" />
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Condición
        </dt>
        <dd className="font-semibold">{conditionLabel(p.condition)}</dd>
      </div>
    </div>

    <div className="flex items-start gap-2">
      <Package className="mt-0.5 size-4 text-muted-foreground" />
      <div>
        <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Stock
        </dt>
        <dd className="font-semibold">
          {p.stock} unidad{p.stock === 1 ? "" : "es"}
        </dd>
      </div>
    </div>
  </dl>
</div>
</section>

{related.length > 0 && (
  <section className="border-t border-border">
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          — Relacionados
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tighter md:text-3xl">
          También te puede interesar
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {related.slice(0, 8).map((rp) => (
          <ProductCard key={rp.id} p={rp} />
        ))}
      </div>
    </div>
  </section>
)}

{popular.length > 0 && (
  <section className="border-t border-border">
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          — Destacados
        </p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tighter md:text-3xl">
          Lo más visto
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {popular.slice(0, 8).map((rp) => (
          <ProductCard key={rp.id} p={rp} />
        ))}
      </div>
    </div>
  </section>
)}

<SiteFooter />
</div>
);
}