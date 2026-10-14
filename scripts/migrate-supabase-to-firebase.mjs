/**
 * Migración idempotente Supabase → Firestore.
 * No borra datos de Supabase. Escribe un respaldo local en backups/ (ignorado por Git).
 *
 * Requiere:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_PROJECT_ID
 *   GOOGLE_APPLICATION_CREDENTIALS
 *
 * Uso: npm run migrate:supabase-to-firebase
 *
 * Las contraseñas de Supabase Auth no se migran. Las cuentas deben registrarse de nuevo
 * o restablecer la contraseña en Firebase Authentication.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!url || !key || !projectId || !credPath) {
  console.error("Configura SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FIREBASE_PROJECT_ID y GOOGLE_APPLICATION_CREDENTIALS");
  process.exit(1);
}

const report = {
  startedAt: new Date().toISOString(),
  categories: { read: 0, written: 0, failed: 0 },
  products: { read: 0, written: 0, skipped: 0, failed: 0 },
  warnings: [],
  failures: [],
};

const supabase = createClient(url, key);
initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, "utf8"))), projectId });
const db = getFirestore();

const categoriesRes = await supabase.from("categories").select("*");
if (categoriesRes.error) {
  console.error("No se pudieron leer categorías:", categoriesRes.error.message);
  process.exit(1);
}
const productsRes = await supabase.from("products").select("*,product_images(*)");
if (productsRes.error) {
  console.error("No se pudieron leer productos:", productsRes.error.message);
  process.exit(1);
}

mkdirSync("backups", { recursive: true });
const backupPath = `backups/supabase-${Date.now()}.json`;
writeFileSync(backupPath, JSON.stringify({ categories: categoriesRes.data, products: productsRes.data }, null, 2));
console.log("Respaldo local:", backupPath);

const categories = categoriesRes.data ?? [];
const products = productsRes.data ?? [];
report.categories.read = categories.length;
report.products.read = products.length;
const categoryIds = new Set(categories.map((c) => c.id));
const slugs = new Map();

async function upsert(collection, id, data) {
  await db.collection(collection).doc(id).set(
    { ...data, migratedFrom: "supabase", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

for (const c of categories) {
  try {
    await upsert("categories", c.id, {
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      imageUrl: c.image_url ?? null,
      active: true,
      displayOrder: Number(c.sort_order ?? 0),
      createdAt: c.created_at ? new Date(c.created_at) : FieldValue.serverTimestamp(),
    });
    report.categories.written += 1;
  } catch (error) {
    report.categories.failed += 1;
    report.failures.push({ collection: "categories", id: c.id, message: error.message });
  }
}

for (const p of products) {
  const price = Number(p.price);
  if (!Number.isFinite(price) || price < 0) {
    report.products.skipped += 1;
    report.warnings.push(`Producto ${p.id} omitido: precio inválido`);
    continue;
  }
  if (p.category_id && !categoryIds.has(p.category_id)) {
    report.warnings.push(`Producto ${p.id} referencia una categoría inexistente`);
  }
  if (slugs.has(p.slug)) report.warnings.push(`Slug duplicado: ${p.slug}`);
  slugs.set(p.slug, p.id);
  const imgs = (p.product_images ?? []).map((i, idx) => ({
    url: i.url,
    storagePath: i.storage_path ?? null,
    sortOrder: i.sort_order ?? idx,
    isPrimary: Boolean(i.is_primary),
  }));
  const brokenImages = imgs.filter((img) => !img.url);
  if (brokenImages.length) report.warnings.push(`Producto ${p.id} tiene imágenes sin URL`);
  const primary = imgs.find((i) => i.isPrimary) ?? imgs[0];
  const cat = categories.find((c) => c.id === p.category_id);
  try {
    await upsert("products", p.id, {
      name: p.name,
      slug: p.slug,
      description: p.description ?? null,
      brand: p.brand ?? null,
      model: p.model ?? null,
      categoryId: p.category_id ?? null,
      categoryName: cat?.name ?? null,
      categorySlug: cat?.slug ?? null,
      condition: p.condition ?? "nuevo",
      price,
      previousPrice: null,
      stock: Number(p.stock ?? 0),
      minStock: Number(p.min_stock ?? 1),
      internalCode: p.internal_code ?? null,
      featured: Boolean(p.is_featured),
      active: p.is_active !== false,
      images: imgs.filter((img) => img.url),
      additionalImages: imgs.filter((img) => img.url && !img.isPrimary).map((img) => img.url),
      imageUrl: primary?.url ?? null,
      createdAt: p.created_at ? new Date(p.created_at) : FieldValue.serverTimestamp(),
      createdBy: null,
    });
    report.products.written += 1;
  } catch (error) {
    report.products.failed += 1;
    report.failures.push({ collection: "products", id: p.id, message: error.message });
  }
}

report.finishedAt = new Date().toISOString();
const reportPath = `backups/migration-report-${Date.now()}.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log("Informe:", reportPath);
console.log("Supabase no fue modificado. Para volver atrás, conserva este respaldo y no borres el proyecto Supabase.");
if (report.products.failed || report.categories.failed) process.exit(1);
