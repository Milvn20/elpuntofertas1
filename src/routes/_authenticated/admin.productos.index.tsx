import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit2, Plus, Search, Trash2, Eye, EyeOff } from "lucide-react";
import { adminDeleteProduct, adminListProducts, adminToggleProductActive } from "@/lib/data/admin";
import { availability, conditionLabel, formatCLP } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/productos/")({
  component: ProductsList,
});

type Row = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  price: number;
  stock: number;
  minStock: number;
  internalCode: string | null;
  condition: string;
  active: boolean;
  featured: boolean;
  categoryName?: string | null;
  imageUrl?: string | null;
};

function ProductsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListProducts());
      setLoadError(null);
    } catch (e: any) {
      const message = e?.message ?? "Error al cargar productos";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleActive(r: Row) {
    try {
      await adminToggleProductActive(r.id, !r.active);
      toast.success(!r.active ? "Publicado" : "Despublicado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  async function remove(r: Row) {
    if (!confirm(`¿Eliminar "${r.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await adminDeleteProduct(r.id);
      toast.success("Producto eliminado");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  const filtered = rows.filter((r) =>
    !q.trim() ||
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    (r.internalCode ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Inventario</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">Productos</h1>
          <p className="mt-1 text-sm text-muted-foreground">{rows.length} en total</p>
        </div>
        <Link to="/admin/productos/nuevo" className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
          <Plus className="size-4" /> Nuevo
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o código…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Cargando…</p>
      ) : loadError ? (
        <div className="rounded-lg border border-destructive/30 p-8 text-center">
          <p className="text-sm font-semibold text-destructive">No se pudo leer el inventario.</p>
          <p className="mt-2 text-xs text-muted-foreground">{loadError}</p>
          <button type="button" onClick={load} className="mt-4 text-sm font-semibold underline">Reintentar</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            No hay productos. Crea el primero.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[64px_1fr_120px_100px_120px_100px_120px] gap-3 border-b border-border bg-muted/40 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:grid">
            <span></span><span>Producto</span><span>Categoría</span><span>Stock</span><span>Precio</span><span>Estado</span><span className="text-right">Acciones</span>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((r) => {
              const img = r.imageUrl;
              const av = availability(r.stock, r.minStock);
              return (
                <li key={r.id} className="grid grid-cols-[64px_1fr] items-center gap-3 px-4 py-3 md:grid-cols-[64px_1fr_120px_100px_120px_100px_120px]">
                  <div className="size-12 overflow-hidden rounded-md bg-muted">
                    {img && <img src={img} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {r.internalCode ? `#${r.internalCode} · ` : ""}{conditionLabel(r.condition)}
                    </p>
                  </div>
                  <span className="hidden text-sm text-muted-foreground md:inline">{r.categoryName ?? "—"}</span>
                  <span className={`hidden font-mono text-xs md:inline ${av.tone === "out" ? "text-destructive" : av.tone === "low" ? "text-accent" : ""}`}>
                    {r.stock} u.
                  </span>
                  <span className="hidden text-sm font-semibold md:inline">{formatCLP(r.price)}</span>
                  <span className="hidden md:inline">
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                      r.active ? "bg-whatsapp/15 text-whatsapp" : "bg-muted text-muted-foreground"
                    }`}>{r.active ? "Publicado" : "Oculto"}</span>
                  </span>
                  <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                    <button onClick={() => toggleActive(r)} title={r.active ? "Ocultar" : "Publicar"} className="rounded-md border border-border p-1.5 hover:bg-muted">
                      {r.active ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    <Link to="/admin/productos/$id" params={{ id: r.id }} className="rounded-md border border-border p-1.5 hover:bg-muted">
                      <Edit2 className="size-3.5" />
                    </Link>
                    <button onClick={() => remove(r)} title="Eliminar" className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}