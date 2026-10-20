import { Link } from "@tanstack/react-router";
import { useCommerceSettings } from "@/lib/commerce/context";
import { displayInstallmentAmount } from "@/lib/commerce/policy";
import { availability, conditionLabel, formatCLP } from "@/lib/site";

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
  const commerce = useCommerceSettings();
  const previous =
    p.previousPrice != null && Number(p.previousPrice) > Number(p.price)
      ? Number(p.previousPrice)
      : null;
  const installmentAmount = commerce.showInstallments
    ? displayInstallmentAmount(Number(p.price), commerce.installmentCount)
    : null;
  return (
    <Link
      to="/producto/$slug"
      params={{ slug: p.slug }}
      className="group flex flex-col rounded-2xl border border-border bg-card p-2.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sin imagen
            </span>
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex gap-1">
          {p.condition && (
            <span className="rounded-full bg-background/95 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-foreground">
              {conditionLabel(p.condition)}
            </span>
          )}
        </div>
        {av.tone !== "ok" && (
          <div className="absolute right-2.5 top-2.5">
            <span
              className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest ${
                av.tone === "out"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {av.label}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 px-1.5 pb-1 pt-3">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
          {p.brand && <p className="mt-0.5 text-xs text-muted-foreground">{p.brand}</p>}
        </div>
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-base font-bold">{formatCLP(p.price)}</p>
          {previous != null && (
            <p className="text-xs text-muted-foreground line-through">{formatCLP(previous)}</p>
          )}
          {installmentAmount != null && (
            <p className="w-full text-[11px] text-muted-foreground">
              {commerce.installmentCount} cuotas de {formatCLP(installmentAmount)} · se confirma al
              pagar
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
