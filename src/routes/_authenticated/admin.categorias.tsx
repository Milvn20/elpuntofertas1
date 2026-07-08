import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Edit2, Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: CategoriesAdmin,
});

type Cat = { id: string; name: string; slug: string; description: string | null; sort_order: number };

function CategoriesAdmin() {
  const [items, setItems] = useState<Cat[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Cat>>({});
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    setItems((data ?? []) as any);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!newName.trim()) return;
    const { error } = await supabase.from("categories").insert({
      name: newName.trim(),
      slug: slugify(newName.trim()),
      sort_order: items.length,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Categoría creada");
    setNewName(""); setCreating(false); load();
  }

  async function save(c: Cat) {
    const payload = { ...draft, slug: draft.name ? slugify(draft.name) : c.slug };
    const { error } = await supabase.from("categories").update(payload as any).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Guardado"); setEditing(null); load();
  }

  async function remove(c: Cat) {
    if (!confirm(`¿Eliminar "${c.name}"? Los productos quedarán sin categoría.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada"); load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Clasificación</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">Categorías</h1>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
            <Plus className="size-4" /> Nueva
          </button>
        )}
      </div>

      {creating && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Nombre de la nueva categoría"
            className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <button onClick={create} className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background">Crear</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} className="rounded-md border border-border p-1.5"><X className="size-4" /></button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              {editing === c.id ? (
                <>
                  <input
                    value={draft.name ?? c.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none"
                  />
                  <button onClick={() => save(c)} className="rounded-md bg-foreground p-1.5 text-background"><Save className="size-3.5" /></button>
                  <button onClick={() => setEditing(null)} className="rounded-md border border-border p-1.5"><X className="size-3.5" /></button>
                </>
              ) : (
                <>
                  <div className="flex flex-1 flex-col">
                    <p className="font-semibold">{c.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/{c.slug}</p>
                  </div>
                  <button onClick={() => { setEditing(c.id); setDraft({ name: c.name }); }} className="rounded-md border border-border p-1.5">
                    <Edit2 className="size-3.5" />
                  </button>
                  <button onClick={() => remove(c)} className="rounded-md border border-border p-1.5 text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="p-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Sin categorías
          </p>
        )}
      </div>
    </div>
  );
}