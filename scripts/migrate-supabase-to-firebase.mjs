/**
 * Migración idempotente Supabase → Firestore.
 * Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_PROJECT_ID
 *
 * Uso: npm run migrate:supabase-to-firebase
 */
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!url || !key || !projectId || !credPath) {
  console.error("Configura SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_PROJECT_ID, GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

const supabase = createClient(url, key);
initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, "utf8"))), projectId });
const db = getFirestore();

async function upsert(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.migratedFrom === "supabase") {
    console.log("skip", collection, id);
    return;
  }
  await ref.set({ ...data, migratedFrom: "supabase", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log("ok", collection, id);
}

const { data: categories } = await supabase.from("categories").select("*");
for (const c of categories ?? []) {
  await upsert("categories", c.id, {
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.image_url,
    active: true,
    displayOrder: c.sort_order ?? 0,
    createdAt: FieldValue.serverTimestamp(),
  });
}

const { data: products } = await supabase.from("products").select("*,product_images(*)");
for (const p of products ?? []) {
  const imgs = (p.product_images ?? []).map((i, idx) => ({
    url: i.url,
    storagePath: i.storage_path,
    sortOrder: i.sort_order ?? idx,
    isPrimary: i.is_primary,
  }));
  const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
  const cat = (categories ?? []).find((c) => c.id === p.category_id);
  await upsert("products", p.id, {
    name: p.name,
    slug: p.slug,
    description: p.description,
    brand: p.brand,
    model: p.model,
    categoryId: p.category_id,
    categoryName: cat?.name ?? null,
    categorySlug: cat?.slug ?? null,
    condition: p.condition,
    price: Number(p.price),
    previousPrice: null,
    stock: p.stock,
    minStock: p.min_stock,
    internalCode: p.internal_code,
    featured: p.is_featured,
    active: p.is_active,
    images: imgs,
    imageUrl: primary?.url ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

console.log("Migración finalizada. Verifica conteos en consola Firebase.");
