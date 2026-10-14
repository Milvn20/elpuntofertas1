import { useFirebaseBackend } from "@/lib/data/backend";
import type { CategoryRecord } from "@/lib/db/types";
import type { AdminProductRow, SaveProductInput } from "./admin.firebase";
import type { ProductImage } from "@/lib/db/types";

async function getSb() {
  const { supabase: client } = await import("@/integrations/supabase/client");
  return client;
}
import { slugify } from "@/lib/site";
import { firestoreDocToProduct } from "@/lib/db/mappers";

async function fb() {
  return import("./admin.firebase");
}

export async function adminListProducts(): Promise<AdminProductRow[]> {
  if (useFirebaseBackend()) return (await fb()).adminListProducts();
  const sb = await getSb();
  const { data, error } = await sb
    .from("products")
    .select("id,name,slug,brand,price,stock,min_stock,internal_code,condition,is_active,is_featured,category_id,categories(name),product_images(url,is_primary,sort_order)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => {
    const imgs = (row.product_images ?? []).map((i: any, idx: number) => ({
      url: i.url,
      storagePath: null,
      sortOrder: i.sort_order ?? idx,
      isPrimary: i.is_primary,
    }));
    const primary = imgs.find((i: ProductImage) => i.isPrimary) ?? imgs[0];
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      brand: row.brand,
      price: row.price,
      stock: row.stock,
      minStock: row.min_stock,
      internalCode: row.internal_code,
      condition: row.condition,
      featured: row.is_featured,
      active: row.is_active,
      categoryId: row.category_id,
      categoryName: row.categories?.name ?? null,
      imageUrl: primary?.url ?? null,
      images: imgs,
      categoryLabel: row.categories?.name ?? null,
    };
  });
}

export async function adminGetProduct(id: string) {
  if (useFirebaseBackend()) return (await fb()).adminGetProduct(id);
  const sb = await getSb();
  const { data, error } = await sb
    .from("products")
    .select("*,product_images(id,url,storage_path,is_primary,sort_order),categories(name,slug)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const imgs = (data.product_images ?? []).map((i: any, idx: number) => ({
    url: i.url,
    storagePath: i.storage_path,
    sortOrder: i.sort_order ?? idx,
    isPrimary: i.is_primary,
  }));
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    brand: data.brand,
    model: data.model,
    categoryId: data.category_id,
    condition: data.condition,
    price: data.price,
    previousPrice: null,
    stock: data.stock,
    minStock: data.min_stock,
    internalCode: data.internal_code,
    featured: data.is_featured,
    active: data.is_active,
    images: imgs,
    imageUrl: imgs.find((i: ProductImage) => i.isPrimary)?.url ?? imgs[0]?.url ?? null,
  };
}

export async function adminSaveProduct(input: SaveProductInput & { supabaseImageRows?: Array<{ id?: string; url: string; storage_path: string | null; is_primary: boolean; sort_order: number }> }) {
  if (useFirebaseBackend()) return (await fb()).adminSaveProduct(input);
  const payload = {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    category_id: input.categoryId || null,
    condition: input.condition,
    price: input.price,
    stock: input.stock,
    min_stock: input.minStock,
    internal_code: input.internalCode ?? null,
    is_featured: input.featured,
    is_active: input.active,
  };
  const sb = await getSb();
  let productId = input.id;
  if (productId) {
    const { error } = await sb.from("products").update(payload as any).eq("id", productId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await sb.from("products").insert(payload as any).select("id").single();
    if (error) throw new Error(error.message);
    productId = data.id;
  }
  const rows = input.supabaseImageRows ?? [];
  for (let i = 0; i < rows.length; i++) {
    const img = rows[i];
    if (!img.id) {
      await sb.from("product_images").insert({
        product_id: productId,
        url: img.url,
        storage_path: img.storage_path,
        is_primary: img.is_primary,
        sort_order: i,
      } as any);
    } else {
      await sb.from("product_images").update({ is_primary: img.is_primary, sort_order: i } as any).eq("id", img.id);
    }
  }
  return productId!;
}

export async function adminToggleProductActive(id: string, active: boolean) {
  if (useFirebaseBackend()) return (await fb()).adminToggleProductActive(id, active);
  const sb = await getSb();
  const { error } = await sb.from("products").update({ is_active: active } as any).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteProduct(id: string) {
  if (useFirebaseBackend()) return (await fb()).adminDeleteProduct(id);
  const sb = await getSb();
  const { error } = await sb.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminUploadProductImage(file: File): Promise<ProductImage> {
  if (useFirebaseBackend()) return (await fb()).adminUploadProductImage(file);
  const sb = await getSb();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await sb.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (upErr) throw new Error(upErr.message);
  const { data: signed, error: sErr } = await sb.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (sErr || !signed) throw new Error(sErr?.message ?? "No se pudo firmar URL");
  return { url: signed.signedUrl, storagePath: path, sortOrder: 0, isPrimary: false };
}

export async function adminListCategories(): Promise<CategoryRecord[]> {
  if (useFirebaseBackend()) return (await fb()).adminListCategories();
  const sb = await getSb();
  const { data, error } = await sb.from("categories").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
    active: true,
    displayOrder: c.sort_order ?? 0,
  }));
}

export async function adminCreateCategory(name: string, displayOrder: number) {
  if (useFirebaseBackend()) return (await fb()).adminCreateCategory(name, displayOrder);
  const sb = await getSb();
  const { error } = await sb.from("categories").insert({ name: name.trim(), slug: slugify(name.trim()), sort_order: displayOrder } as any);
  if (error) throw new Error(error.message);
}

export async function adminUpdateCategory(id: string, patch: { name?: string }) {
  if (useFirebaseBackend()) return (await fb()).adminUpdateCategory(id, patch);
  const payload: any = {};
  if (patch.name) {
    payload.name = patch.name.trim();
    payload.slug = slugify(patch.name.trim());
  }
  const sb = await getSb();
  const { error } = await sb.from("categories").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteCategory(id: string) {
  if (useFirebaseBackend()) return (await fb()).adminDeleteCategory(id);
  const sb = await getSb();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function adminWriteAudit(actorUid: string, action: string, entityType: string, entityId: string, metadata?: Record<string, unknown>) {
  if (!useFirebaseBackend()) return;
  await (await fb()).writeAuditLog({ actorUid, action, entityType, entityId, metadata });
}
