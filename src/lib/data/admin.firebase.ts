import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseDb, getFirebaseStorage } from "@/integrations/firebase/client";
import type { CategoryRecord, ProductImage, ProductRecord } from "@/lib/db/types";
import { firestoreDocToProduct } from "@/lib/db/mappers";
import { slugify } from "@/lib/site";
import { validateImageFile, validateProductDraft } from "@/lib/products/validate";

export type AdminProductRow = ProductRecord & { categoryLabel?: string | null };

export async function adminListProducts(): Promise<AdminProductRow[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), "products"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => firestoreDocToProduct(d.id, d.data() as Record<string, unknown>));
}

export async function adminGetProduct(id: string): Promise<ProductRecord | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "products", id));
  if (!snap.exists()) return null;
  return firestoreDocToProduct(snap.id, snap.data() as Record<string, unknown>);
}

async function categoryMeta(categoryId: string | null) {
  if (!categoryId) return { categoryName: null, categorySlug: null };
  const snap = await getDoc(doc(getFirebaseDb(), "categories", categoryId));
  if (!snap.exists()) return { categoryName: null, categorySlug: null };
  const d = snap.data();
  return { categoryName: String(d.name ?? ""), categorySlug: String(d.slug ?? "") };
}

function imagesToFirestore(images: ProductImage[]) {
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  return {
    images,
    imageUrl: primary?.url ?? null,
  };
}

export type SaveProductInput = {
  id?: string;
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  categoryId?: string | null;
  condition: ProductRecord["condition"];
  price: number;
  previousPrice?: number | null;
  stock: number;
  minStock: number;
  internalCode?: string | null;
  featured: boolean;
  active: boolean;
  images: ProductImage[];
  createdBy?: string | null;
};

export async function adminSaveProduct(input: SaveProductInput): Promise<string> {
  const stock = Math.trunc(input.stock);
  const minStock = Math.trunc(input.minStock);
  const draftError = validateProductDraft({
    name: input.name,
    slug: input.slug,
    price: input.price,
    previousPrice: input.previousPrice,
    stock,
    minStock,
  });
  if (draftError) throw new Error(draftError);
  const db = getFirebaseDb();
  const dup = await getDocs(query(collection(db, "products"), where("slug", "==", input.slug)));
  const conflict = dup.docs.find((d) => d.id !== input.id);
  if (conflict) throw new Error("Ya existe un producto con ese slug");

  const cat = await categoryMeta(input.categoryId ?? null);
  if (input.categoryId && !cat.categorySlug) throw new Error("La categoría seleccionada no existe.");
  const { images, imageUrl } = imagesToFirestore(input.images);
  const payload = {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    brand: input.brand ?? null,
    model: input.model ?? null,
    categoryId: input.categoryId ?? null,
    categoryName: cat.categoryName,
    categorySlug: cat.categorySlug,
    condition: input.condition,
    price: input.price,
    previousPrice: input.previousPrice ?? null,
    stock,
    minStock,
    additionalImages: images.filter((img) => !img.isPrimary).map((img) => img.url),
    internalCode: input.internalCode ?? null,
    featured: input.featured,
    active: input.active,
    images,
    imageUrl,
    updatedAt: serverTimestamp(),
  };

  if (input.id) {
    await updateDoc(doc(db, "products", input.id), payload);
    return input.id;
  }
  const id = crypto.randomUUID();
  await setDoc(doc(db, "products", id), {
    ...payload,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy ?? null,
  });
  return id;
}

export async function adminToggleProductActive(id: string, active: boolean) {
  await updateDoc(doc(getFirebaseDb(), "products", id), { active, updatedAt: serverTimestamp() });
}

export async function adminDeleteProduct(id: string) {
  const p = await adminGetProduct(id);
  await deleteDoc(doc(getFirebaseDb(), "products", id));
  if (p?.images?.length) {
    const storage = getFirebaseStorage();
    for (const img of p.images) {
      if (img.storagePath) {
        try {
          await deleteObject(ref(storage, img.storagePath));
        } catch {
          /* ignore */
        }
      }
    }
  }
}

export async function adminUploadProductImage(file: File): Promise<ProductImage> {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const path = `product-images/${crypto.randomUUID()}.${ext}`;
  const storage = getFirebaseStorage();
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  const url = await getDownloadURL(ref(storage, path));
  return { url, storagePath: path, sortOrder: 0, isPrimary: false };
}

export async function adminListCategories(): Promise<CategoryRecord[]> {
  const snap = await getDocs(query(collection(getFirebaseDb(), "categories"), orderBy("displayOrder")));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      name: String(x.name),
      slug: String(x.slug),
      description: (x.description as string) ?? null,
      imageUrl: (x.imageUrl as string) ?? null,
      active: x.active !== false,
      displayOrder: Number(x.displayOrder ?? 0),
    };
  });
}

export async function adminCreateCategory(name: string, displayOrder: number) {
  const id = crypto.randomUUID();
  await setDoc(doc(getFirebaseDb(), "categories", id), {
    name: name.trim(),
    slug: slugify(name.trim()),
    active: true,
    displayOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function adminUpdateCategory(id: string, patch: { name?: string; description?: string | null; active?: boolean; displayOrder?: number }) {
  const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (patch.name) {
    data.name = patch.name.trim();
    data.slug = slugify(patch.name.trim());
  }
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.displayOrder !== undefined) data.displayOrder = patch.displayOrder;
  const db = getFirebaseDb();
  await updateDoc(doc(db, "categories", id), data);
  if (patch.name) {
    const products = await getDocs(query(collection(db, "products"), where("categoryId", "==", id)));
    await Promise.all(products.docs.map((product) => updateDoc(product.ref, {
      categoryName: data.name,
      categorySlug: data.slug,
      updatedAt: serverTimestamp(),
    })));
  }
}

export async function adminDeleteCategory(id: string) {
  const db = getFirebaseDb();
  const linked = await getDocs(query(collection(db, "products"), where("categoryId", "==", id), limit(1)));
  if (!linked.empty) {
    throw new Error("Esta categoría tiene productos. Reasígnalos o desactiva la categoría.");
  }
  await deleteDoc(doc(db, "categories", id));
}

export async function adminListOrders() {
  const snap = await getDocs(query(collection(getFirebaseDb(), "orders"), orderBy("createdAt", "desc"), limit(40)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, any> & { id: string }>;
}

export async function adminListAudit(max = 20) {
  const snap = await getDocs(query(collection(getFirebaseDb(), "auditLogs"), orderBy("timestamp", "desc"), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<Record<string, any> & { id: string }>;
}

export async function writeAuditLog(entry: {
  actorUid: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const id = crypto.randomUUID();
  await setDoc(doc(getFirebaseDb(), "auditLogs", id), {
    ...entry,
    timestamp: serverTimestamp(),
  });
}
