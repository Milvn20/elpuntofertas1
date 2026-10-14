import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/integrations/firebase/client";
import type { CategoryRecord, ProductRecord } from "@/lib/db/types";
import { firestoreDocToProduct, productToCard } from "@/lib/db/mappers";
import type { ProductCardData } from "@/components/product/product-card";
import type { CatalogFilters, CatalogResult } from "./catalog";

export async function fetchCategoriesFirebase(): Promise<CatalogResult<CategoryRecord[]>> {
  try {
    const snap = await getDocs(
      query(collection(getFirebaseDb(), "categories"), where("active", "==", true), orderBy("displayOrder")),
    );
    const data = snap.docs
      .filter((d) => d.data().active !== false)
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          name: String(x.name),
          slug: String(x.slug),
          description: (x.description as string) ?? null,
          imageUrl: (x.imageUrl as string) ?? null,
          active: x.active !== false,
          displayOrder: Number(x.displayOrder ?? 0),
        } satisfies CategoryRecord;
      });
    return { data, error: null };
  } catch (e: any) {
    console.error("[categories/firebase]", e);
    return { data: [], error: e?.message ?? "Error al cargar categorías" };
  }
}

export async function fetchProductsFirebase(filters: CatalogFilters): Promise<CatalogResult<ProductRecord[]>> {
  try {
    const col = collection(getFirebaseDb(), "products");
    const constraints = [where("active", "==", true)];
    if (filters.categorySlug) constraints.push(where("categorySlug", "==", filters.categorySlug));
    if (filters.condition) constraints.push(where("condition", "==", filters.condition));
    const sortField = filters.sort === "price_asc" || filters.sort === "price_desc" ? "price" : "createdAt";
    const asc = filters.sort === "price_asc";
    constraints.push(orderBy(sortField, asc ? "asc" : "desc"));
    if (filters.limit) constraints.push(limit(filters.limit));
    const snap = await getDocs(query(col, ...constraints));
    let rows = snap.docs.map((d) => firestoreDocToProduct(d.id, d.data() as Record<string, unknown>));
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(q));
    }
    return { data: rows, error: null };
  } catch (e: any) {
    console.error("[products/firebase]", e);
    return { data: [], error: e?.message ?? "Error al cargar productos desde Firestore" };
  }
}

export async function countActiveProductsFirebase(): Promise<CatalogResult<number>> {
  try {
    const snap = await getCountFromServer(query(collection(getFirebaseDb(), "products"), where("active", "==", true)));
    return { data: snap.data().count, error: null };
  } catch (e: any) {
    return { data: 0, error: e?.message ?? "Error al contar productos" };
  }
}

export async function fetchFeaturedProductsFirebase(limitN: number): Promise<CatalogResult<ProductCardData[]>> {
  try {
    const snap = await getDocs(
      query(collection(getFirebaseDb(), "products"), where("active", "==", true), where("featured", "==", true), limit(limitN)),
    );
    const rows = snap.docs.map((d) => firestoreDocToProduct(d.id, d.data() as Record<string, unknown>));
    return { data: rows.map(productToCard), error: null };
  } catch (e: any) {
    return { data: [], error: e?.message ?? "Error al cargar productos destacados" };
  }
}
