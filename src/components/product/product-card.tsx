import { Link } from "@tanstack/react-router";
import { availability, conditionLabel, formatCLP } from "@/lib/site";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number | string;
  condition: string | null;
  stock: number;
  min_stock: number;
  internal_code: string | null;
  image_url: string | null;
  category_name?: string | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const av = availability(p.stock, p.min_stock);
  return (
    <Link
      to="/producto/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sin imagen</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {p.condition && (
            <span className="rounded-full border border-border bg-background/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest backdrop-blur">
              {conditionLabel(p.condition)}
            </span>
          )}
        </div>
        {av.tone !== "ok" && (
          <div className="absolute right-2 top-2">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                av.tone === "out"
                  ? "bg-destructive/90 text-destructive-foreground"
                  : "bg-accent/90 text-accent-foreground"
              }`}
            >
              {av.label}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div className="space-y-1">
          {p.internal_code && (
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Cód. {p.internal_code}
              {p.category_name ? ` · ${p.category_name}` : ""}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
          {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
        </div>
        <p className="text-base font-bold">{formatCLP(p.price)}</p>
      </div>
    </Link>
  );
}