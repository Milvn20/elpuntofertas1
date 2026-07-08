import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, Eye, Plus, AlertTriangle, FolderTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCLP } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type Stats = { products: number; active: number; categories: number; lowStock: number; totalValue: number };

function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<Array<{ id: string; name: string; stock: number; min_stock: number }>>([]);

  useEffect(() => {
    (async () => {
      const [{ count: products }, { count: active }, { count: categories }, { data: all }, { data: low }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        supabase.from("products").select("price,stock"),
        supabase.from("products").select("id,name,stock,min_stock").lte("stock", 3).order("stock").limit(10),
      ]);
      const totalValue = (all ?? []).reduce((acc, p: any) => acc + Number(p.price) * Number(p.stock), 0);
      const lowStock = (all ?? []).filter((p: any) => p.stock <= (p as any).min_stock).length;
      setStats({
        products: products ?? 0,
        active: active ?? 0,
        categories: categories ?? 0,
        lowStock,
        totalValue,
      });
      setLowStockItems((low ?? []) as any);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Inicio</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tighter md:text-4xl">Resumen</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Productos" value={stats?.products ?? "—"} icon={<Boxes className="size-4" />} />
        <Stat label="Publicados" value={stats?.active ?? "—"} icon={<Eye className="size-4" />} />
        <Stat label="Categorías" value={stats?.categories ?? "—"} icon={<FolderTree className="size-4" />} />
        <Stat label="Valor inventario" value={stats ? formatCLP(stats.totalValue) : "—"} icon={<Boxes className="size-4" />} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Acciones rápidas</h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <Link to="/admin/productos/nuevo" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background">
              <Plus className="size-4" /> Nuevo producto
            </Link>
            <Link to="/admin/productos" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">
              Ver listado de productos
            </Link>
            <Link to="/admin/categorias" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">
              Gestionar categorías
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-accent" />
            <h2 className="font-semibold">Stock bajo</h2>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin productos con stock bajo. 🎉</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {lowStockItems.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to="/admin/productos/$id" params={{ id: p.id }} className="line-clamp-1 hover:underline">{p.name}</Link>
                  <span className={`font-mono text-xs ${p.stock <= 0 ? "text-destructive" : "text-accent"}`}>
                    {p.stock} / mín {p.min_stock}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}