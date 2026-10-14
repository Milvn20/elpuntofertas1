import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { adminListAudit } from "@/lib/data/admin";

export const Route = createFileRoute("/_authenticated/admin/actividad")({
  component: ActivityAdmin,
});

function ActivityAdmin() {
  const [rows, setRows] = useState<Array<Record<string, any> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListAudit(30));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo leer la actividad");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter">Actividad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Registros escritos por el servidor. No incluyen contraseñas ni tokens.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : error ? (
        <div>
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={load} className="mt-2 text-sm underline">Reintentar</button>
        </div>
      ) : rows.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay registros.</p> : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <p className="font-semibold">{row.action}</p>
              <p className="text-muted-foreground">{row.entityType} · {row.entityId}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{row.actorUid ?? "sistema"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
