import type { ProductRecord } from "./types";
import type { ProductCardData } from "@/components/product/product-card";

export function productToCard(p: ProductRecord): ProductCardData {
  const imgs = p.images ?? [];
  const primary = imgs.find((i) => i.isPrimary) ?? imgs.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const imageUrl = p.imageUrl ?? primary?.url ?? null;
  const discountPct =
    p.previousPrice && p.previousPrice > p.price
      ? Math.round((1 - p.price / p.previousPrice) * 100)
      : null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand ?? null,
    price: p.price,
    previousPrice: p.previousPrice ?? null,
    discountPct,
    condition: p.condition,
    stock: p.stock,
    min_stock: p.minStock,
    internal_code: p.internalCode ?? null,
    image_url: imageUrl,
    category_name: p.categoryName ?? null,
  };
}

/** Compatibilidad con filas Supabase (join product_images + categories). */
export function supabaseRowToCard(row: any): ProductCardData {
  const imgs = (row.product_images ?? []) as Array<{ url: string; is_primary: boolean; sort_order: number }>;
  const primary = imgs.find((i) => i.is_primary) ?? imgs.sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    price: row.price,
    previousPrice: row.previous_price ?? null,
    discountPct: null,
    condition: row.condition,
    stock: row.stock,
    min_stock: row.min_stock,
    internal_code: row.internal_code,
    image_url: primary?.url ?? null,
    category_name: row.categories?.name ?? null,
  };
}

export function firestoreDocToProduct(id: string, data: Record<string, unknown>): ProductRecord {
  const images = (data.images as ProductRecord["images"]) ?? [];
  return {
    id,
    name: String(data.name ?? ""),
    slug: String(data.slug ?? ""),
    description: (data.description as string) ?? null,
    brand: (data.brand as string) ?? null,
    model: (data.model as string) ?? null,
    categoryId: (data.categoryId as string) ?? null,
    categoryName: (data.categoryName as string) ?? null,
    categorySlug: (data.categorySlug as string) ?? null,
    condition: (data.condition as ProductRecord["condition"]) ?? "nuevo",
    price: Number(data.price ?? 0),
    previousPrice: data.previousPrice != null ? Number(data.previousPrice) : null,
    imageUrl: (data.imageUrl as string) ?? null,
    images,
    stock: Number(data.stock ?? 0),
    minStock: Number(data.minStock ?? 1),
    internalCode: (data.internalCode as string) ?? null,
    featured: Boolean(data.featured),
    active: data.active !== false,
  };
}
