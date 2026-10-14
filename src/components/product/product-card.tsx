import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { availability, conditionLabel, formatCLP } from "@/lib/site";
import { useCart } from "@/lib/cart/cart-context";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  price: number | string;
  previousPrice?: number | string | null;
  discountPct?: number | null;
  condition: string | null;
  stock: number;
  min_stock: number;
  internal_code: string | null;
  image_url: string | null;
  category_name?: string | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  const av = availability(p.stock, p.min_stock);
  const cart = useCart();
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <Link to="/producto/$slug" params={{ slug: p.slug }} className="flex flex-1 flex-col">
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
          {(p.internal_code || p.category_name) && (
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {p.category_name ?? ""}
              {p.internal_code ? `${p.category_name ? " · " : ""}Cód. ${p.internal_code}` : ""}
            </p>
          )}
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
          {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-base font-bold">{formatCLP(p.price)}</p>
          {p.previousPrice != null && Number(p.previousPrice) > Number(p.price) && (
            <>
              <p className="text-xs text-muted-foreground line-through">{formatCLP(p.previousPrice)}</p>
              {p.discountPct != null && p.discountPct > 0 && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">-{p.discountPct}%</span>
              )}
            </>
          )}
        </div>
      </div>
      </Link>
      <div className="px-3 pb-3">
        <button
          type="button"
          disabled={av.tone === "out"}
          onClick={() => {
            const result = cart.addItem({
              productId: p.id,
              slug: p.slug,
              name: p.name,
              imageUrl: p.image_url,
              listedPrice: Number(p.price),
              listedStock: p.stock,
              active: true,
              quantity: 1,
            });
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:bg-muted disabled:text-muted-foreground"
        >
          <ShoppingBag className="size-3.5" /> {av.tone === "out" ? "Sin stock" : "Agregar"}
        </button>
      </div>
    </article>
  );
}