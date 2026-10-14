import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, Eye, Plus, AlertTriangle, FolderTree } from "lucide-react";
import { formatCLP } from "@/lib/site";
import { adminListCategories, adminListProducts } from "@/lib/data/admin";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

type Stats = { products: number; active: number; categories: number; lowStock: number; totalValue: number };

function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lowStockItems, setLowStockItems] = useState<Array<{ id: string; name: string; stock: number; minStock: number }>>([]);

  useEffect(() => {
    (async () => {
      try {
        const [products, categories] = await Promise.all([adminListProducts(), adminListCategories()]);
        const active = products.filter((p) => p.active).length;
        const totalValue = products.reduce((acc, p) => acc + Number(p.price) * Number(p.stock), 0);
        const lowStock = products.filter((p) => p.stock <= p.minStock).length;
        setStats({
          products: products.length,
          active,
          categories: categories.length,
          lowStock,
          totalValue,
        });
        setLowStockItems(
          products
            .filter((p) => p.stock <= 3)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 10)
            .map((p) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.minStock })),
        );
      } catch {
        setStats({ products: 0, active: 0, categories: 0, lowStock: 0, totalValue: 0 });
      }
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
          <h2 className="font-semibold">Acciones rápidas</h2>
          <div className="mt-4 grid gap-2">
            <Link to="/admin/productos/nuevo" className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-background">
              <Plus className="size-4" /> Nuevo producto
            </Link>
            <Link to="/admin/productos" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Ver productos</Link>
            <Link to="/admin/categorias" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Categorías</Link>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-accent" />
            <h2 className="font-semibold">Stock bajo</h2>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin alertas de stock.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {lowStockItems.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to="/admin/productos/$id" params={{ id: p.id }} className="line-clamp-1 hover:underline">{p.name}</Link>
                  <span className="font-mono text-xs text-accent">{p.stock} / mín {p.minStock}</span>
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
