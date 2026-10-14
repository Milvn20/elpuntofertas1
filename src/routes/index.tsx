import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MessageCircle, ShieldCheck, Truck, MapPin, Package } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { SITE, whatsappGeneral } from "@/lib/site";
import {
  countActiveProducts,
  fetchCategories,
  fetchFeaturedProducts,
  fetchLatestProducts,
} from "@/lib/data/catalog";
import heroImg from "@/assets/elpuntofertas.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — Todo lo que buscas, en un solo lugar` },
      { name: "description", content: "Bicicletas, zapatillas, tecnología, perfumes, ropa y más. Stock real y atención por WhatsApp." },
    ],
  }),
  component: Index,
});

const CATEGORY_COLORS = ["bg-orange-500", "bg-sky-600", "bg-rose-500", "bg-violet-600", "bg-teal-500", "bg-pink-500"];

function Index() {
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; imageUrl?: string | null }[]>([]);
  const [featured, setFeatured] = useState<ProductCardData[]>([]);
  const [offers, setOffers] = useState<ProductCardData[]>([]);
  const [counts, setCounts] = useState({ products: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [cats, feat, latest, count] = await Promise.all([
        fetchCategories(),
        fetchFeaturedProducts(8),
        fetchLatestProducts(12),
        countActiveProducts(),
      ]);
      const err = cats.error ?? feat.error ?? latest.error ?? count.error;
      if (err) setLoadError(err);
      setCategories(cats.data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, imageUrl: c.imageUrl })));
      setFeatured(feat.data);
      const withOffer = latest.data.filter((p) => p.previousPrice != null && Number(p.previousPrice) > Number(p.price));
      setOffers(withOffer.length ? withOffer.slice(0, 8) : latest.data.slice(0, 8));
      setCounts({ products: count.data });
    })();
  }, []);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <img src={heroImg} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/85 via-foreground/70 to-foreground/40" />
        </div>
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-16 md:grid-cols-2 md:px-6 md:py-24">
          <div className="text-background">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/70">
              <span className="mr-2 inline-block h-px w-8 bg-accent align-middle" />
              {SITE.name}
            </p>
            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
              Calidad, variedad y los <span className="text-accent">mejores precios</span>.
            </h1>
            <p className="mt-4 max-w-lg text-pretty text-base text-background/85 md:text-lg">
              Bicicletas, zapatillas, ropa, camas, tecnología y perfumes. Todo en un solo lugar, con stock real y atención directa.
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
          <div className="hidden items-end justify-end md:flex">
            <p className="max-w-xs text-right text-lg text-background/90 italic">Tu pedido en buenas manos :)</p>
          </div>
        </div>
        {loadError && (
          <div className="relative border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
            Problema al cargar datos: {loadError}. Los productos en base de datos no se borran; revisa Firebase o Supabase.
          </div>
        )}
        <div className="relative border-t border-border/40 bg-background/95 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Inventario publicado · {counts.products} productos activos
        </div>
      </section>

      <section id="categorias" className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h2 className="text-2xl font-extrabold tracking-tighter md:text-3xl">Categorías</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                to="/catalogo"
                search={{ cat: c.slug } as any}
                className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] bg-muted">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`flex size-full items-center justify-center ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} text-white/90`}>
                      <Package className="size-8 opacity-80" />
                    </div>
                  )}
                </div>
                <div className={`px-3 py-2 text-sm font-semibold text-white ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}>{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-2xl font-extrabold tracking-tighter">Destacados</h2>
              <Link to="/catalogo" className="text-sm font-semibold text-accent">Ver todos →</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {featured.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h2 className="text-2xl font-extrabold tracking-tighter">Productos en oferta</h2>
          {offers.length === 0 ? (
            <div className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
              Aún no hay ofertas publicadas con precio anterior.
              <Link to="/auth" className="mt-2 block text-sm font-semibold underline">Panel admin →</Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
              {offers.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
