import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Truck,
  MapPin,
  Bike,
  Footprints,
  Shirt,
  BedDouble,
  Laptop,
  SprayCan,
  Watch,
  Gamepad2,
  Headphones,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  const [slide, setSlide] = useState(0);

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

  // Carousel source: prefer featured, fall back to latest.
  const carousel = (featured.length > 0 ? featured : latest).slice(0, 6);

  useEffect(() => {
    if (carousel.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % carousel.length), 5000);
    return () => clearInterval(t);
  }, [carousel.length]);

  useEffect(() => {
    if (slide >= carousel.length) setSlide(0);
  }, [carousel.length, slide]);

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
              está físicamente en bodega — preguntas y compras se cordinan via WhatsApp.
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

          <div className="relative md:col-span-5 lg:col-span-6 lg:ml-22">
            <HeroCarousel
              items={carousel}
              index={slide}
              onSelect={setSlide}
              onPrev={() => setSlide((s) => (s - 1 + carousel.length) % carousel.length)}
              onNext={() => setSlide((s) => (s + 1) % carousel.length)}
            />
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
                <div className="flex size-10 items-center justify-center rounded-md bg-foreground text-background transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  <CategoryIcon name={c.name} slug={c.slug} className="size-5" />
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

function HeroCarousel({
  items,
  index,
  onSelect,
  onPrev,
  onNext,
}: {
  items: ProductCardData[];
  index: number;
  onSelect: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed border-border font-mono text-xs uppercase tracking-widest text-muted-foreground md:aspect-auto md:h-full md:min-h-[420px]">
        Sin productos publicados
      </div>
    );
  }
  const current = items[index] ?? items[0];
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted h-[360px] md:h-[450px]">
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {items.map((p) => (
          <Link
            key={p.id}
            to="/producto/$slug"
            params={{ slug: p.slug }}
            className="group relative block h-full w-full shrink-0"
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.name}
                className="size-full object-cover transition-transform duration-[6000ms] ease-out group-hover:scale-105"
              />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Sin imagen
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-foreground/80 via-foreground/40 to-transparent p-5">
              {p.category_name && (
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-background/80">
                  {p.category_name}
                </span>
              )}
              <p className="line-clamp-2 text-lg font-extrabold leading-tight tracking-tight text-background md:text-xl">
                {p.name}
              </p>
              <p className="font-mono text-xs text-background/90">
                ${Number(p.price).toLocaleString("es-CL")}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={onPrev}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground backdrop-blur transition hover:bg-background"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground backdrop-blur transition hover:bg-background"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={`Ir a ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-background" : "w-1.5 bg-background/50 hover:bg-background/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
      {current && <span className="sr-only">{current.name}</span>}
    </div>
  );
}

function CategoryIcon({
  name,
  slug,
  className,
}: {
  name: string;
  slug: string;
  className?: string;
}) 
{
  const key = `${slug} ${name}`.toLowerCase();
  const match = (...terms: string[]) => terms.some((t) => key.includes(t));
  const Icon = match("bici", "bike", "ciclismo")
    ? Bike
    : match("zapat", "zapa", "calza", "sneak", "shoe")
      ? Footprints
      : match("ropa", "polera", "camisa", "vestu", "cloth")
        ? Shirt
        : match("cama", "colch", "dormi", "bed")
          ? BedDouble
          : match("tecno", "tech", "compu", "notebook", "laptop", "celu", "phone")
            ? Laptop
            : match("perfume", "fragancia", "aroma")
              ? SprayCan
              : match("reloj", "watch")
                ? Watch
                : match("audio", "audi", "parlant", "headphone")
                  ? Headphones
                  : match("juego", "gamer", "console", "game")
                    ? Gamepad2
                    : Package;
  return <Icon className={className} />;
} 