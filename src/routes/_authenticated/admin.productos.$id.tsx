import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductForm, type ProductFormInitial } from "@/components/admin/product-form";

export const Route = createFileRoute("/_authenticated/admin/productos/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const [initial, setInitial] = useState<ProductFormInitial | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*,product_images(id,url,storage_path,is_primary,sort_order)")
        .eq("id", id)
        .maybeSingle();
      if (!data) { setInitial(null); return; }
      setInitial({
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        brand: data.brand,
        model: data.model,
        category_id: data.category_id,
        condition: data.condition as any,
        price: Number(data.price),
        stock: data.stock,
        min_stock: data.min_stock,
        internal_code: data.internal_code,
        is_featured: data.is_featured,
        is_active: data.is_active,
        images: (data.product_images ?? [])
          .sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)
          .map((img: any) => ({ id: img.id, url: img.url, storage_path: img.storage_path, is_primary: img.is_primary, sort_order: img.sort_order })),
      });
    })();
  }, [id]);

  if (initial === undefined) return <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Cargando…</p>;
  if (initial === null) {
    return (
      <div>
        <Link to="/admin/productos" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><ArrowLeft className="size-3.5" /> Productos</Link>
        <p className="mt-4 text-lg font-semibold">Producto no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/productos" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"><ArrowLeft className="size-3.5" /> Productos</Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">{initial.name}</h1>
      </div>
      <ProductForm initial={initial} />
    </div>
  );
}