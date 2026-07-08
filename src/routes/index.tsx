import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, Truck, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { SITE, whatsappGeneral } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — Catálogo de productos seleccionados` },
      { name: "description", content: "Bicicletas, zapatillas, tecnología, perfumes, ropa y más. Stock real, atención por WhatsApp, retiro en Santiago." },
      { property: "og:title", content: `${SITE.name} — Catálogo` },
      { property: "og:description", content: "Stock real verificado. Consulta directa por WhatsApp." },
    ],
  }),
  component: Index,
});

type Category = { id: string; name: string; slug: string; image_url: string | null };

function Index() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [latest, setLatest] = useState<ProductCardData[]>([]);
  const [counts, setCounts] = useState({ products: 0 });

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: feat }, { data: rec }, { count }] = await Promise.all([
        supabase.from("categories").select("id,name,slug,image_url").order("sort_order"),
        supabase
          .from("products")
          .select("id,slug,name,brand,price,condition,stock,min_stock,internal_code,is_featured,product_images(url,is_primary,sort_order),categories(name)")
          .eq("is_active", true)
          .eq("is_featured", true)
          .limit(8),
        supabase
          .from("products")
          .select("id,slug,name,brand,price,condition,stock,min_stock,internal_code,product_images(url,is_primary,sort_order),categories(name)")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      setCategories(cats ?? []);
      setFeatured((feat ?? []).map(mapCard));
      setLatest((rec ?? []).map(mapCard));
      setCounts({ products: count ?? 0 });
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-12 md:px-6 md:py-20">
          <div className="md:col-span-7 lg:col-span-6">
            <div className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              Inventario actualizado · {counts.products} productos
            </div>
            <h1 className="text-balance text-4xl font-extrabold leading-[0.95] tracking-tighter md:text-6xl lg:text-7xl">
              Productos reales,
              <br />
              stock <span className="text-accent">verificado</span>,
              <br />
              atención directa.
            </h1>
            <p className="mt-6 max-w-lg text-balance text-base text-muted-foreground md:text-lg">
              Bicicletas, zapatillas, ropa, camas, tecnología y perfumes. Cada producto que ves
              está físicamente en bodega — preguntas y compras se cierran por WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/catalogo"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
              >
                Ver catálogo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href={whatsappGeneral()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-6 py-3 text-sm font-semibold text-whatsapp-foreground transition-transform hover:-translate-y-0.5"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </a>
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-border pt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 text-accent" />
                <span>Stock real</span>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 size-4 text-accent" />
                <span>Despacho/retiro</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-accent" />
                <span>{SITE.city}</span>
              </div>
            </dl>
          </div>

          <div className="relative md:col-span-5 lg:col-span-6">
            <div className="relative grid h-full grid-cols-2 gap-3">
              {(latest.slice(0, 4)).map((p, i) => (
                <Link
                  key={p.id}
                  to="/producto/$slug"
                  params={{ slug: p.slug }}
                  className={`group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted ${
                    i === 0 ? "row-span-2 aspect-auto" : ""
                  }`}
                >
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent p-3">
                    <p className="line-clamp-2 text-xs font-semibold text-background">{p.name}</p>
                  </div>
                </Link>
              ))}
              {latest.length === 0 && (
                <div className="col-span-2 flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Sin productos publicados
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categorias" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 01 / Explorar</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Categorías</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/catalogo"
                search={{ cat: c.slug } as any}
                className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/30"
              >
                <div className="flex size-10 items-center justify-center rounded-md bg-foreground font-mono text-xs font-bold text-background">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Ver</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 02 / Selección</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Destacados</h2>
              </div>
              <Link to="/catalogo" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
                Ver todos →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {featured.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 03 / Recién ingresados</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Últimos en bodega</h2>
            </div>
          </div>
          {latest.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Aún no hay productos publicados.
              </p>
              <Link to="/auth" className="mt-4 inline-block text-sm font-semibold underline">
                Ingresar como administrador para agregar productos →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
              {latest.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

export function mapCard(row: any): ProductCardData {
  const imgs = (row.product_images ?? []) as Array<{ url: string; is_primary: boolean; sort_order: number }>;
  const primary = imgs.find((i) => i.is_primary) ?? imgs.sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    price: row.price,
    condition: row.condition,
    stock: row.stock,
    min_stock: row.min_stock,
    internal_code: row.internal_code,
    image_url: primary?.url ?? null,
    category_name: row.categories?.name ?? null,
  };
}
