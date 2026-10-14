import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { fetchActiveProducts } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/ofertas")({
  head: () => ({
    meta: [
      { title: `Ofertas · ${SITE.name}` },
      { name: "description", content: "Productos con un precio anterior real mayor al precio actual." },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetchActiveProducts().then(({ data, error: loadError }) => {
      setError(loadError);
      setItems(data.filter((p) => p.previousPrice != null && Number(p.previousPrice) > Number(p.price)));
      setLoading(false);
    });
  }, [attempt]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tighter">Ofertas</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Solo aparecen productos cuyo precio anterior guardado es mayor que el precio actual. No se muestran descuentos calculados de otra forma.</p>
        {error ? (
          <div className="mt-8 rounded-xl border border-destructive/30 p-8 text-center">
            <p className="font-semibold text-destructive">No pudimos cargar las ofertas.</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">Reintentar</button>
          </div>
        ) : loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-10 text-center">
            <p>No hay ofertas publicadas con precio anterior.</p>
            <Link to="/catalogo" className="mt-3 inline-block text-sm font-semibold text-accent">Ver catálogo</Link>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
