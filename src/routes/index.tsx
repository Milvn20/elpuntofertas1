import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Truck,
  MapPin,
  Package,
  ChevronLeft,
  ChevronRight,
  Bike,
  Footprints,
  Shirt,
  BedDouble,
  Laptop,
  SprayCan,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { SITE, formatCLP, whatsappGeneral } from "@/lib/site";
import {
  countActiveProducts,
  fetchCategories,
  fetchFeaturedProducts,
  fetchLatestProducts,
} from "@/lib/data/catalog";
import heroImg from "@/assets/elpuntofertas logo fondo.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — Todo lo que buscas, en un solo lugar` },
      { name: "description", content: "Bicicletas, zapatillas, tecnología, perfumes, ropa y más. Stock real y atención por WhatsApp." },
    ],
  }),
  component: Index,
});

function foldCategory(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function categoryIcon(name: string, slug: string): LucideIcon {
  const key = foldCategory(`${slug} ${name}`);
  if (/bici|bike|ciclo/.test(key)) return Bike;
  if (/zapat|sneak|calzado|zapato/.test(key)) return Footprints;
  if (/ropa|polera|polo|vest/.test(key)) return Shirt;
  if (/cama|bed|colchon/.test(key)) return BedDouble;
  if (/tecno|compu|notebook|electron/.test(key)) return Laptop;
  if (/perfum|fragan|colonia/.test(key)) return SprayCan;
  return Package;
}

function Index() {
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [latest, setLatest] = useState<ProductCardData[]>([]);
  const [counts, setCounts] = useState({ products: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pool = featured.length > 0 ? featured : latest;
  const carousel = [...pool.filter((product) => product.image_url), ...pool.filter((product) => !product.image_url)].slice(0, 8);

  useEffect(() => {
    (async () => {
      try {
        const [cats, feat, recent, count] = await Promise.all([
          fetchCategories(),
          fetchFeaturedProducts(8),
          fetchLatestProducts(12),
          countActiveProducts(),
        ]);
        const err = cats.error ?? feat.error ?? recent.error ?? count.error;
        setLoadError(err);
        setCategories(err ? [] : cats.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
        setFeatured(feat.error ? [] : feat.data);
        setLatest(recent.error ? [] : recent.data);
        setCounts({ products: count.error ? 0 : count.data });
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "No se pudo cargar el inicio");
      }
    })();
  }, [attempt]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/70 to-foreground/40" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
          <div className="text-background">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/70">
              <span className="mr-2 inline-block h-px w-8 bg-accent align-middle" />
              {SITE.tagline}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
              Todo lo que buscas, <span className="text-accent">en un solo lugar</span>.
            </h1>
            <p className="mt-4 max-w-lg text-pretty text-base text-background/85 md:text-lg">
              Trabajamos con productos publicados y stock verificado. Bicicletas, zapatillas, ropa, camas, tecnología y perfumes, con atención directa por WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalogo" className="inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-semibold text-foreground">
                Explorar catálogo <ArrowRight className="size-4" />
              </Link>
              <a href={whatsappGeneral()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-6 py-3 text-sm font-semibold text-whatsapp-foreground">
                <MessageCircle className="size-4" /> Escríbenos por WhatsApp
              </a>
            </div>
            <dl className="mt-10 flex flex-wrap gap-6 font-mono text-[10px] uppercase tracking-widest text-background/75">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" /> Stock verificado</div>
              <div className="flex items-center gap-2"><Truck className="size-4 text-accent" /> Despacho / retiro</div>
              <div className="flex items-center gap-2"><MapPin className="size-4 text-accent" /> {SITE.city}</div>
            </dl>
          </div>
          <HeroCarousel items={carousel} />
        </div>
        {loadError && (
          <div className="relative border-t border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            <p>No pudimos leer el catálogo: {loadError}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-2 rounded-full bg-background px-4 py-1.5 text-xs font-semibold text-foreground">Reintentar</button>
          </div>
        )}
        {!loadError && (
          <div className="relative border-t border-border/40 bg-background/95 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Inventario publicado · {counts.products} productos activos
          </div>
        )}
      </section>

      <section id="categorias" className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 01 / Explorar</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Categorías</h2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const Icon = categoryIcon(c.name, c.slug);
              return (
                <Link
                  key={c.id}
                  to="/catalogo"
                  search={{ cat: c.slug } as any}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-foreground text-background transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Ver</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 02 / Selección</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Destacados</h2>
              </div>
              <Link to="/catalogo" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground">Ver todos →</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">— 03 / Recién ingresados</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tighter md:text-4xl">Últimos en bodega</h2>
          </div>
          {loadError ? null : latest.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Aún no hay productos publicados.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
              {latest.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function HeroCarousel({ items }: { items: ProductCardData[] }) {
  const [index, setIndex] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      if (!paused.current) setIndex((current) => (current + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (items.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-background/30 font-mono text-xs uppercase tracking-widest text-background/70 md:h-[460px]">
        Sin productos publicados
      </div>
    );
  }

  const step = (direction: number) => setIndex((current) => (current + direction + items.length) % items.length);

  return (
    <div
      className="relative h-72 overflow-hidden rounded-2xl border border-background/15 bg-black/20 shadow-2xl md:h-[460px]"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <div className="flex h-full w-full transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((product) => (
          <Link
            key={product.id}
            to="/producto/$slug"
            params={{ slug: product.slug }}
            className="group relative block h-full w-full min-w-full shrink-0 basis-full overflow-hidden"
          >
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" />
            ) : (
              <div className="flex size-full items-center justify-center bg-muted font-mono text-xs uppercase tracking-widest text-muted-foreground">Sin imagen</div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
              {product.category_name && <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/75">{product.category_name}</p>}
              <p className="mt-1 line-clamp-2 text-xl font-extrabold tracking-tight text-white">{product.name}</p>
              <p className="mt-1 font-mono text-sm text-white/90">{formatCLP(product.price)}</p>
            </div>
          </Link>
        ))}
      </div>
      {items.length > 1 && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label="Producto anterior" className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow transition hover:scale-105 hover:bg-background">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Producto siguiente" className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow transition hover:scale-105 hover:bg-background">
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute right-4 top-4 z-10 flex gap-1.5">
            {items.map((product, dot) => (
              <button
                key={product.id}
                type="button"
                aria-label={`Ver ${product.name}`}
                onClick={() => setIndex(dot)}
                className={`h-1.5 rounded-full transition-all ${dot === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
