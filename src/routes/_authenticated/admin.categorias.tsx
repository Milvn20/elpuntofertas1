import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { adminCreateCategory, adminDeleteCategory, adminListCategories, adminUpdateCategory } from "@/lib/data/admin";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CategoriesAdmin,
});

type Cat = { id: string; name: string; slug: string; displayOrder: number; active: boolean };

function CategoriesAdmin() {
  const [items, setItems] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    try {
      const data = await adminListCategories();
      setItems(data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, displayOrder: c.displayOrder, active: c.active })));
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cargar");
    }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    try {
      await adminCreateCategory(newName.trim(), items.length);
      toast.success("Categoría creada");
      setNewName("");
      setCreating(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  async function save(c: Cat) {
    try {
      await adminUpdateCategory(c.id, { name: draftName || c.name });
      toast.success("Guardado");
      setEditing(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  async function remove(c: Cat) {
    if (!confirm(`¿Eliminar "${c.name}"?`)) return;
    try {
      await adminDeleteCategory(c.id);
      toast.success("Eliminada");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-3xl font-extrabold tracking-tighter">Categorías</h1>
        {!creating && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
            <Plus className="size-4" /> Nueva
          </button>
        )}
      </div>
      {creating && (
        <div className="flex gap-2 rounded-xl border border-border p-3">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-transparent outline-none" placeholder="Nombre" />
          <button onClick={create} className="rounded-md bg-foreground px-3 py-1 text-xs font-semibold text-background">Crear</button>
          <button onClick={() => setCreating(false)} className="rounded-md border p-1"><X className="size-4" /></button>
        </div>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-3 p-4">
            {editing === c.id ? (
              <>
                <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="flex-1 rounded-md border px-3 py-1.5 text-sm" />
                <button onClick={() => save(c)} className="rounded-md bg-foreground p-1.5 text-background"><Save className="size-3.5" /></button>
                <button onClick={() => setEditing(null)} className="rounded-md border p-1.5"><X className="size-3.5" /></button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">/{c.slug} · {c.active ? "activa" : "oculta"}</p>
                </div>
                <button onClick={async () => { await adminUpdateCategory(c.id, { active: !c.active }); load(); }} className="rounded-md border px-2 py-1 text-xs">{c.active ? "Ocultar" : "Activar"}</button>
                <button onClick={() => { setEditing(c.id); setDraftName(c.name); }} className="rounded-md border p-1.5"><Edit2 className="size-3.5" /></button>
                <button onClick={() => remove(c)} className="rounded-md border p-1.5 text-destructive"><Trash2 className="size-3.5" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
