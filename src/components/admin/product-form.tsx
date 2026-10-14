import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Star, Trash2, Upload } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  adminListCategories,
  adminSaveProduct,
  adminUploadProductImage,
  adminWriteAudit,
} from "@/lib/data/admin";
import { getCurrentSession } from "@/lib/auth/client";
import { useFirebaseBackend } from "@/lib/data/backend";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/site";
import { toast } from "sonner";

type Category = { id: string; name: string };
type ImageRow = { id?: string; url: string; storage_path: string | null; is_primary: boolean; sort_order: number };

export type ProductFormInitial = {
  id?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  category_id?: string | null;
  condition?: "nuevo" | "seminuevo" | "usado";
  price?: number;
  previous_price?: number | null;
  stock?: number;
  min_stock?: number;
  internal_code?: string | null;
  is_featured?: boolean;
  is_active?: boolean;
  images?: ImageRow[];
};

export function ProductForm({ initial }: { initial?: ProductFormInitial }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [condition, setCondition] = useState(initial?.condition ?? "nuevo");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [previousPrice, setPreviousPrice] = useState<number | "">(initial?.previous_price ?? "");
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [minStock, setMinStock] = useState(initial?.min_stock ?? 1);
  const [internalCode, setInternalCode] = useState(initial?.internal_code ?? "");
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured ?? false);
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [images, setImages] = useState<ImageRow[]>(initial?.images ?? []);

  useEffect(() => {
    adminListCategories().then((data) => setCats(data.map((c) => ({ id: c.id, name: c.name })))).catch(() => setCats([]));
  }, []);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const newImgs: ImageRow[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await adminUploadProductImage(file);
        newImgs.push({
          url: uploaded.url,
          storage_path: uploaded.storagePath ?? null,
          is_primary: images.length === 0 && newImgs.length === 0,
          sort_order: images.length + newImgs.length,
        });
      }
      setImages((prev) => [...prev, ...newImgs]);
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeImage(idx: number) {
    const img = images[idx];
    if (img.storage_path && !img.id) {
      if (useFirebaseBackend()) {
        const { getFirebaseStorage } = await import("@/integrations/firebase/client");
        const { deleteObject, ref } = await import("firebase/storage");
        try {
          await deleteObject(ref(getFirebaseStorage(), img.storage_path));
        } catch { /* ignore */ }
      } else {
        await supabase.storage.from("product-images").remove([img.storage_path]);
      }
    }
    if (img.id && !useFirebaseBackend()) {
      await supabase.from("product_images").delete().eq("id", img.id);
      if (img.storage_path) await supabase.storage.from("product-images").remove([img.storage_path]);
    }
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // ensure a primary
      if (next.length && !next.some((i) => i.is_primary)) next[0].is_primary = true;
      return next;
    });
  }

  function setPrimary(idx: number) {
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === idx })));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!slug.trim()) return toast.error("El slug es obligatorio");
    setSaving(true);
    try {
      const { user } = await getCurrentSession();
      const imagePayload = images.map((img, i) => ({
        url: img.url,
        storagePath: img.storage_path,
        sortOrder: i,
        isPrimary: img.is_primary,
      }));
      const productId = await adminSaveProduct({
        id: initial?.id,
        name: name.trim(),
        slug: slug.trim(),
        description: description || null,
        brand: brand || null,
        model: model || null,
        categoryId: categoryId || null,
        condition,
        price,
        previousPrice: previousPrice === "" ? null : Number(previousPrice),
        stock,
        minStock,
        internalCode: internalCode || null,
        featured: isFeatured,
        active: isActive,
        images: imagePayload,
        createdBy: user?.id ?? null,
        supabaseImageRows: images.map((img, i) => ({
          id: img.id,
          url: img.url,
          storage_path: img.storage_path,
          is_primary: img.is_primary,
          sort_order: i,
        })),
      });
      if (user?.id) {
        await adminWriteAudit(user.id, initial?.id ? "product_update" : "product_create", "product", productId, { slug });
      }
      toast.success(initial?.id ? "Producto actualizado" : "Producto creado");
      navigate({ to: "/admin/productos" });
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Información básica">
            <Field label="Nombre">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marca">
                <input className={inputCls} value={brand} onChange={(e) => setBrand(e.target.value)} />
              </Field>
              <Field label="Modelo">
                <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} />
              </Field>
            </div>
            <Field label="Slug (URL)">
              <input className={inputCls} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} required />
            </Field>
            <Field label="Descripción">
              <textarea className={`${inputCls} min-h-[140px] resize-y`} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </Section>

          <Section title="Imágenes">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-6 text-sm font-semibold transition-colors hover:bg-muted"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? "Subiendo…" : "Subir imágenes"}
            </button>
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {images.map((img, i) => (
                  <div key={img.id ?? i} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                    <img src={img.url} alt="" className="size-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 50%)" }}>
                      <button
                        type="button"
                        onClick={() => setPrimary(i)}
                        title="Marcar como principal"
                        className={`rounded-md p-1 ${img.is_primary ? "bg-accent text-accent-foreground" : "bg-background/80 text-foreground"}`}
                      >
                        <Star className="size-3.5" fill={img.is_primary ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        title="Eliminar"
                        className="rounded-md bg-background/80 p-1 text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {img.is_primary && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent-foreground">
                        Principal
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {images.length === 0 && (
              <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <ImageIcon className="size-3.5" /> Sin imágenes — agrega al menos una.
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Inventario y precio">
            <Field label="Precio (CLP)">
              <input type="number" min={0} className={inputCls} value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
            </Field>
            <Field label="Precio anterior (oferta, opcional)">
              <input type="number" min={0} className={inputCls} value={previousPrice} onChange={(e) => setPreviousPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stock">
                <input type="number" min={0} className={inputCls} value={stock} onChange={(e) => setStock(Number(e.target.value))} required />
              </Field>
              <Field label="Mín.">
                <input type="number" min={0} className={inputCls} value={minStock} onChange={(e) => setMinStock(Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Código interno">
              <input className={inputCls} value={internalCode ?? ""} onChange={(e) => setInternalCode(e.target.value)} placeholder="Ej. BIC-001" />
            </Field>
          </Section>

          <Section title="Clasificación">
            <Field label="Categoría">
              <select className={inputCls} value={categoryId ?? ""} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— Sin categoría —</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Condición">
              <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value as any)}>
                <option value="nuevo">Nuevo</option>
                <option value="seminuevo">Seminuevo</option>
                <option value="usado">Usado</option>
              </select>
            </Field>
          </Section>

          <Section title="Visibilidad">
            <Toggle label="Publicado en el catálogo" checked={isActive} onChange={setIsActive} />
            <Toggle label="Destacar en home" checked={isFeatured} onChange={setIsFeatured} />
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-6">
        <button type="button" onClick={() => navigate({ to: "/admin/productos" })} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {initial?.id ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-foreground" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 size-5 rounded-full bg-background transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}