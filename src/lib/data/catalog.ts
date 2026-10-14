import { useFirebaseBackend } from "@/lib/data/backend";

async function getSb() {
  const { supabase: client } = await import("@/integrations/supabase/client");
  return client;
}
import type { CategoryRecord } from "@/lib/db/types";
import { productToCard, supabaseRowToCard } from "@/lib/db/mappers";
import type { ProductCardData } from "@/components/product/product-card";

export type CatalogFilters = {
  q?: string;
  categorySlug?: string;
  condition?: "nuevo" | "seminuevo" | "usado";
  sort?: "new" | "price_asc" | "price_desc";
  limit?: number;
};

export type CatalogResult<T> = { data: T; error: string | null };

const PRODUCT_SELECT =
  "id,slug,name,brand,price,condition,stock,min_stock,internal_code,product_images(url,is_primary,sort_order),categories(name,slug)";

async function fb() {
  return import("./catalog.firebase");
}

export async function fetchCategories(): Promise<CatalogResult<CategoryRecord[]>> {
  if (useFirebaseBackend()) return (await fb()).fetchCategoriesFirebase();
  const sb = await getSb();
  const { data, error } = await sb.from("categories").select("id,name,slug,description,image_url,sort_order").order("sort_order");
  if (error) {
    console.error("[categories/supabase]", error);
    return { data: [], error: error.message };
  }
  return {
    data: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      active: true,
      displayOrder: c.sort_order ?? 0,
    })),
    error: null,
  };
}

async function fetchProductsSupabase(filters: CatalogFilters): Promise<CatalogResult<any[]>> {
  const sb = await getSb();
  let queryBuilder = sb
    .from("products")
    .select(`${PRODUCT_SELECT}${filters.categorySlug ? ",categories!inner(name,slug)" : ",categories(name,slug)"}`)
    .eq("is_active", true);
  if (filters.categorySlug) queryBuilder = queryBuilder.eq("categories.slug", filters.categorySlug);
  if (filters.condition) queryBuilder = queryBuilder.eq("condition", filters.condition);
  if (filters.q) queryBuilder = queryBuilder.ilike("name", `%${filters.q}%`);
  const order =
    filters.sort === "price_asc" ? { col: "price", asc: true } :
    filters.sort === "price_desc" ? { col: "price", asc: false } :
    { col: "created_at", asc: false };
  queryBuilder = queryBuilder.order(order.col, { ascending: order.asc });
  if (filters.limit) queryBuilder = queryBuilder.limit(filters.limit);
  const { data, error } = await queryBuilder;
  if (error) {
    console.error("[products/supabase]", error);
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

export async function fetchActiveProducts(filters: CatalogFilters = {}): Promise<CatalogResult<ProductCardData[]>> {
  if (useFirebaseBackend()) {
    const { data, error } = await (await fb()).fetchProductsFirebase(filters);
    return { data: data.map(productToCard), error };
  }
  const { data, error } = await fetchProductsSupabase(filters);
  return { data: data.map(supabaseRowToCard), error };
}

export async function countActiveProducts(): Promise<CatalogResult<number>> {
  if (useFirebaseBackend()) return (await fb()).countActiveProductsFirebase();
  const sb = await getSb();
  const { count, error } = await sb.from("products").select("id", { count: "exact", head: true }).eq("is_active", true);
  if (error) return { data: 0, error: error.message };
  return { data: count ?? 0, error: null };
}

export async function fetchFeaturedProducts(limitN = 8): Promise<CatalogResult<ProductCardData[]>> {
  if (useFirebaseBackend()) return (await fb()).fetchFeaturedProductsFirebase(limitN);
  const sb = await getSb();
  const { data, error } = await sb
    .from("products")
    .select(PRODUCT_SELECT + ",categories(name)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .limit(limitN);
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []).map(supabaseRowToCard), error: null };
}

export async function fetchLatestProducts(limitN = 12): Promise<CatalogResult<ProductCardData[]>> {
  return fetchActiveProducts({ sort: "new", limit: limitN });
}

export { supabaseRowToCard as mapCard } from "@/lib/db/mappers";

export async function fetchProductBySlug(slug: string) {
  if (useFirebaseBackend()) {
    const { collection, getDocs, limit, query, where } = await import("firebase/firestore");
    const { getFirebaseDb } = await import("@/integrations/firebase/client");
    const { firestoreDocToProduct, productToCard } = await import("@/lib/db/mappers");
    const snap = await getDocs(
      query(collection(getFirebaseDb(), "products"), where("slug", "==", slug), where("active", "==", true), limit(1)),
    );
    const doc = snap.docs[0];
    if (!doc) return { product: null, card: null, error: null };
    const p = firestoreDocToProduct(doc.id, doc.data() as Record<string, unknown>);
    return { product: p, card: productToCard(p), error: null };
  }
  const sb = await getSb();
  const { data, error } = await sb
    .from("products")
    .select("id,slug,name,description,brand,model,condition,price,stock,min_stock,internal_code,category_id,product_images(id,url,is_primary,sort_order),categories(name,slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return { product: null, card: null, error: error.message };
  if (!data) return { product: null, card: null, error: null };
  return { product: data, card: supabaseRowToCard(data), error: null };
}
