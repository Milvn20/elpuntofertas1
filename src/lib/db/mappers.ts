import type { ProductRecord } from "./types";
import type { ProductCardData } from "@/components/product/product-card";
import { discountPercent } from "@/lib/orders/pricing";

export function productToCard(p: ProductRecord): ProductCardData {
  const imgs = p.images ?? [];
  const primary = imgs.find((i) => i.isPrimary) ?? imgs.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const imageUrl = p.imageUrl ?? primary?.url ?? null;
  const discountPct = discountPercent(p.price, p.previousPrice);
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
    discountPct: discountPercent(Number(row.price), row.previous_price ?? null),
    condition: row.condition,
    stock: row.stock,
    min_stock: row.min_stock,
    internal_code: row.internal_code,
    image_url: primary?.url ?? null,
    category_name: row.categories?.name ?? null,
  };
}

export function supabaseRowToProduct(row: any): ProductRecord {
  const imgs = (row.product_images ?? []) as Array<{ url: string; is_primary: boolean; sort_order: number; storage_path?: string | null }>;
  const images = imgs.map((img, idx) => ({
    url: img.url,
    storagePath: img.storage_path ?? null,
    sortOrder: img.sort_order ?? idx,
    isPrimary: Boolean(img.is_primary),
  }));
  const primary = images.find((img) => img.isPrimary) ?? images[0];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    brand: row.brand ?? null,
    model: row.model ?? null,
    categoryId: row.category_id ?? null,
    categoryName: row.categories?.name ?? null,
    categorySlug: row.categories?.slug ?? null,
    condition: row.condition ?? "nuevo",
    price: Number(row.price ?? 0),
    previousPrice: row.previous_price != null ? Number(row.previous_price) : null,
    imageUrl: primary?.url ?? null,
    images,
    stock: Number(row.stock ?? 0),
    minStock: Number(row.min_stock ?? 1),
    internalCode: row.internal_code ?? null,
    featured: Boolean(row.is_featured),
    active: row.is_active !== false,
  };
}

export function firestoreDocToProduct(id: string, data: Record<string, unknown>): ProductRecord {
  let images = (data.images as ProductRecord["images"]) ?? [];
  if ((!images || images.length === 0) && Array.isArray(data.additionalImages)) {
    images = (data.additionalImages as string[]).map((url, idx) => ({
      url,
      sortOrder: idx + 1,
      isPrimary: false,
    }));
  }
  if (typeof data.imageUrl === "string" && data.imageUrl && !images.some((img) => img.url === data.imageUrl)) {
    images = [{ url: data.imageUrl, sortOrder: 0, isPrimary: true }, ...images];
  }
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
