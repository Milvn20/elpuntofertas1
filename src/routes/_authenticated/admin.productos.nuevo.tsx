import { createFileRoute } from "@tanstack/react-router";
import { ProductForm } from "@/components/admin/product-form";

export const Route = createFileRoute("/_authenticated/admin/productos/nuevo")({
  component: NewProduct,
});

function NewProduct() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Nuevo</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">Crear producto</h1>
      </div>
      <ProductForm />
    </div>
  );
}