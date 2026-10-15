import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListOrders } from "@/lib/data/admin";
import { updateOrderStatus } from "@/lib/orders.functions";
import { formatCLP } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/pedidos")({
  component: OrdersAdmin,
});

const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

function OrdersAdmin() {
  const changeStatus = useServerFn(updateOrderStatus);
  const [rows, setRows] = useState<Array<Record<string, any> & { id: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await adminListOrders());
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron leer los pedidos");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, status: string) {
    setBusy(id);
    try {
      await changeStatus({ data: { orderId: id, status: status as "pending" } });
      toast.success("Estado actualizado");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cambiar el estado");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">El stock no se descuenta al crear un pedido pendiente. El cambio de estado queda auditado en el servidor.</p>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : error ? (
        <div className="rounded-xl border border-destructive/30 p-6">
          <p className="font-semibold text-destructive">No se pudieron cargar los pedidos.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={load} className="mt-3 text-sm font-semibold underline">Reintentar</button>
        </div>
      ) : rows.length === 0 ? <p className="text-sm text-muted-foreground">No hay pedidos registrados.</p> : (
        <ul className="space-y-3">
          {rows.map((order) => (
            <li key={order.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.customerName}</p>
                  <p className="text-xs text-muted-foreground">{order.customerEmail} · {order.customerPhone}</p>
                  {order.shippingAddress?.line1 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}, {order.shippingAddress.city}, {order.shippingAddress.region}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold">{formatCLP(order.total)}</p>
                  <p className="text-xs">{LABEL[order.status] ?? order.status}</p>
                </div>
              </div>
              <ul className="mt-3 text-sm">
                {(order.items ?? []).map((item: any) => (
                  <li key={item.productId}>{item.name} × {item.quantity} · {formatCLP(item.lineTotal)}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">{order.shippingNote}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(NEXT[order.status] ?? []).map((status) => (
                  <button key={status} type="button" disabled={busy === order.id} onClick={() => update(order.id, status)} className="rounded-full border border-border px-3 py-1 text-xs font-semibold disabled:opacity-50">
                    Marcar {LABEL[status]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
