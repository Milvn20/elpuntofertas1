import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Search, X } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { ProductCard, type ProductCardData } from "@/components/product/product-card";
import { fetchActiveProducts, fetchCategories } from "@/lib/data/catalog";
import { SITE } from "@/lib/site";

const search = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  cond: z.enum(["nuevo", "seminuevo", "usado"]).optional(),
  sort: z.enum(["new", "price_asc", "price_desc"]).optional(),
});

export const Route = createFileRoute("/catalogo")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: `Catálogo · ${SITE.name}` },
      { name: "description", content: "Recorre el catálogo completo de productos disponibles." },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const params = Route.useSearch();
  const navigate = Route.useNavigate();
  const [cats, setCats] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState(params.q ?? "");

  useEffect(() => {
    fetchCategories().then(({ data, error }) => {
      if (error) console.error(error);
      setCats(data.map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    fetchActiveProducts({
      q: params.q,
      categorySlug: params.cat,
      condition: params.cond,
      sort: params.sort,
    }).then(({ data, error }) => {
      if (error) setLoadError(error);
      setItems(data);
      setLoading(false);
    });
  }, [params.q, params.cat, params.cond, params.sort]);

  const activeCount = useMemo(
    () => [params.q, params.cat, params.cond].filter(Boolean).length,
    [params],
  );

  function update(patch: Partial<typeof params>) {
    navigate({ search: { ...params, ...patch } as any });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">/ Catálogo</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tighter md:text-5xl">
            {params.cat ? cats.find((c) => c.slug === params.cat)?.name ?? "Catálogo" : "Todo el inventario"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {loading ? "Cargando…" : `${items.length} producto${items.length === 1 ? "" : "s"}`}
            {activeCount > 0 && " filtrados"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: q || undefined });
            }}
            className="mt-6 flex max-w-xl items-center gap-2 rounded-full border border-border bg-card px-4 py-2"
          >
            <Search className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            {q && (
              <button type="button" onClick={() => { setQ(""); update({ q: undefined }); }} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
          </form>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="space-y-6">
            <FilterGroup title="Categoría">
              <FilterChip label="Todas" active={!params.cat} onClick={() => update({ cat: undefined })} />
              {cats.map((c) => (
                <FilterChip key={c.id} label={c.name} active={params.cat === c.slug} onClick={() => update({ cat: c.slug })} />
              ))}
            </FilterGroup>
            <FilterGroup title="Condición">
              <FilterChip label="Todas" active={!params.cond} onClick={() => update({ cond: undefined })} />
              <FilterChip label="Nuevo" active={params.cond === "nuevo"} onClick={() => update({ cond: "nuevo" })} />
              <FilterChip label="Seminuevo" active={params.cond === "seminuevo"} onClick={() => update({ cond: "seminuevo" })} />
              <FilterChip label="Usado" active={params.cond === "usado"} onClick={() => update({ cond: "usado" })} />
            </FilterGroup>
            <FilterGroup title="Orden">
              <FilterChip label="Más nuevos" active={!params.sort || params.sort === "new"} onClick={() => update({ sort: "new" })} />
              <FilterChip label="Precio ↑" active={params.sort === "price_asc"} onClick={() => update({ sort: "price_asc" })} />
              <FilterChip label="Precio ↓" active={params.sort === "price_desc"} onClick={() => update({ sort: "price_desc" })} />
            </FilterGroup>
          </aside>
          <div>
            {loadError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
                <p className="text-sm font-semibold text-destructive">No pudimos cargar el catálogo.</p>
                <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-12 text-center">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">No hay productos que coincidan.</p>
                <Link to="/catalogo" className="mt-4 inline-block text-sm font-semibold underline">Limpiar filtros →</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {items.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40"}`}
    >
      {label}
    </button>
  );
}
