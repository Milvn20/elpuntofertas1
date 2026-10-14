import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Shield, ShieldOff, Trash2, RefreshCw, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import {
  listUsers,
  setUserRole,
  deleteUser,
  type AdminUserRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsersAdmin,
});

function UsersAdmin() {
  const fetchUsers = useServerFn(listUsers);
  const changeRole = useServerFn(setUserRole);
  const removeUser = useServerFn(deleteUser);

  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setRows(data);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar los usuarios");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function toggleAdmin(u: AdminUserRow) {
    const isAdmin = u.roles.includes("admin");
    setBusyId(u.id);
    try {
      await changeRole({ data: { userId: u.id, role: "admin", grant: !isAdmin } });
      toast.success(isAdmin ? "Rol admin removido" : "Rol admin asignado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo actualizar el rol");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: AdminUserRow) {
    if (!confirm(`¿Eliminar la cuenta "${u.email ?? u.id}"? Esta acción es irreversible.`)) return;
    setBusyId(u.id);
    try {
      await removeUser({ data: { userId: u.id } });
      toast.success("Usuario eliminado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    } finally {
      setBusyId(null);
    }
  }

  const admins = rows.filter((r) => r.roles.includes("admin")).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">/ Cuentas</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} en total · {admins} administrador{admins === 1 ? "" : "es"}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          <RefreshCw className="size-4" /> Actualizar
        </button>
      </div>

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Sin usuarios registrados
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {rows.map((u) => {
              const isAdmin = u.roles.includes("admin");
              const busy = busyId === u.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <UserIcon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{u.email ?? "(sin email)"}</p>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Alta {new Date(u.created_at).toLocaleDateString("es-CL")}
                      {u.last_sign_in_at && ` · Últ. ingreso ${new Date(u.last_sign_in_at).toLocaleDateString("es-CL")}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
                      isAdmin ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isAdmin ? "Admin" : "Usuario"}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => toggleAdmin(u)}
                    title={isAdmin ? "Quitar admin" : "Hacer admin"}
                    className="rounded-md border border-border p-1.5 hover:bg-muted disabled:opacity-50"
                  >
                    {isAdmin ? <ShieldOff className="size-3.5" /> : <Shield className="size-3.5" />}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => remove(u)}
                    title="Eliminar cuenta"
                    className="rounded-md border border-border p-1.5 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}