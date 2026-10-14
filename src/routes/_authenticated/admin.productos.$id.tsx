import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ProductForm, type ProductFormInitial } from "@/components/admin/product-form";
import { adminGetProduct } from "@/lib/data/admin";

export const Route = createFileRoute("/_authenticated/admin/productos/$id")({
  component: EditProduct,
});

function EditProduct() {
  const { id } = Route.useParams();
  const [initial, setInitial] = useState<ProductFormInitial | null | undefined>(undefined);

  useEffect(() => {
    adminGetProduct(id).then((data) => {
      if (!data) {
        setInitial(null);
        return;
      }
      setInitial({
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description ?? "",
        brand: data.brand ?? "",
        model: data.model ?? "",
        category_id: data.categoryId ?? "",
        condition: data.condition,
        price: Number(data.price),
        previous_price: data.previousPrice ?? undefined,
        stock: data.stock,
        min_stock: data.minStock,
        internal_code: data.internalCode ?? "",
        is_featured: data.featured,
        is_active: data.active,
        images: (data.images ?? []).map((img, i) => ({
          id: undefined,
          url: img.url,
          storage_path: img.storagePath ?? null,
          is_primary: img.isPrimary,
          sort_order: img.sortOrder ?? i,
        })),
      });
    });
  }, [id]);

  if (initial === undefined) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (initial === null) {
    return (
      <div>
        <Link to="/admin/productos" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-3.5" /> Productos</Link>
        <p className="mt-4 text-lg font-semibold">Producto no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/productos" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-3.5" /> Productos</Link>
      <h1 className="text-3xl font-extrabold tracking-tighter">{initial.name}</h1>
      <ProductForm initial={initial} />
    </div>
  );
}
