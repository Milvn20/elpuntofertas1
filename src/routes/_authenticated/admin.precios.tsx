import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminListProducts } from "@/lib/data/admin";
import {
  adminUpdateProductPrice,
  getCommerceSettings,
  saveCommerceConfig,
} from "@/lib/commerce.functions";
import { pricePlan, type CommerceSettings } from "@/lib/commerce/policy";
import { formatCLP } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/precios")({
  component: PriceCalculatorPage,
});

const field = "mt-1 w-full rounded-xl border border-border bg-background px-3 py-2";

function PriceCalculatorPage() {
  const [settings, setSettings] = useState<CommerceSettings | null>(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [productId, setProductId] = useState("");
  const [cost, setCost] = useState("70000");
  const [profitMode, setProfitMode] = useState<"amount" | "percent">("amount");
  const [profit, setProfit] = useState("20000");
  const [shippingAssumed, setShippingAssumed] = useState("0");
  const [currentPrice, setCurrentPrice] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    getCommerceSettings()
      .then(setSettings)
      .catch(() => toast.error("No se pudo leer la configuración comercial."));
    adminListProducts()
      .then((rows) =>
        setProducts(rows.map((row) => ({ id: row.id, name: row.name, price: Number(row.price) }))),
      )
      .catch(() => toast.error("No se pudo leer el catálogo."));
  }, []);

  const plan = useMemo(() => {
    if (!settings) return null;
    return pricePlan({
      cost: Number(cost),
      profitAmount: profitMode === "amount" ? Number(profit) : null,
      profitPercent: profitMode === "percent" ? Number(profit) : null,
      cardFeePercent: settings.cardFeePercent,
      installmentsFeePercent: settings.installmentsFeePercent,
      shippingAssumed: Number(shippingAssumed),
      otherCosts: settings.operationalCostClp,
      currentPrice: currentPrice === "" ? null : Number(currentPrice),
      installmentCount: settings.installmentCount,
    });
  }, [settings, cost, profitMode, profit, shippingAssumed, currentPrice]);

  function update(partial: Partial<CommerceSettings>) {
    setSettings((current) => (current ? { ...current, ...partial } : current));
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingConfig(true);
    try {
      const result = await saveCommerceConfig({ data: settings });
      setSettings(result.settings);
      toast.success("Configuración guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la configuración");
    } finally {
      setSavingConfig(false);
    }
  }

  async function applyPrice() {
    if (!plan || !plan.ok || !productId) return;
    const product = products.find((item) => item.id === productId);
    const next = plan.plan.recommendedPrice;
    const accepted = window.confirm(
      `¿Guardar ${formatCLP(next)} como precio de “${product?.name ?? "este producto"}”? Solo cambia ese precio.`,
    );
    if (!accepted) return;
    setSavingPrice(true);
    try {
      await adminUpdateProductPrice({ data: { productId, price: next } });
      setProducts((rows) =>
        rows.map((row) => (row.id === productId ? { ...row, price: next } : row)),
      );
      setCurrentPrice(String(next));
      toast.success("Precio actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el precio");
    } finally {
      setSavingPrice(false);
    }
  }

  if (!settings) return <p className="text-sm text-muted-foreground">Cargando calculadora…</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter">
          Calculadora de precios y rentabilidad
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Las tasas de ejemplo no son tarifas oficiales de Mercado Pago. Revisa las reales en Tu
          negocio → Comisiones y cuotas, y cámbialas aquí. La comisión se considera dentro del
          precio; el checkout no le suma un recargo al cliente.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-extrabold">Configuración comercial</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Umbral de despacho gratis
            <input
              type="number"
              min={0}
              className={field}
              value={settings.freeShippingMinClp}
              onChange={(e) => update({ freeShippingMinClp: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Costo base de despacho
            <input
              type="number"
              min={0}
              className={field}
              value={settings.baseShippingClp}
              onChange={(e) => update({ baseShippingClp: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Comisión de tarjeta (%)
            <input
              type="number"
              min={0}
              step="0.01"
              className={field}
              value={settings.cardFeePercent}
              onChange={(e) => update({ cardFeePercent: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Comisión adicional de cuotas (%)
            <input
              type="number"
              min={0}
              step="0.01"
              className={field}
              value={settings.installmentsFeePercent}
              onChange={(e) => update({ installmentsFeePercent: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Cantidad de cuotas
            <input
              type="number"
              min={1}
              max={48}
              className={field}
              value={settings.installmentCount}
              onChange={(e) => update({ installmentCount: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            Otros costos operacionales
            <input
              type="number"
              min={0}
              className={field}
              value={settings.operationalCostClp}
              onChange={(e) => update({ operationalCostClp: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.showInstallments}
            onChange={(e) => update({ showInstallments: e.target.checked })}
            className="mt-1"
          />
          Mostrar la simulación de cuotas. No garantiza cuotas sin interés: eso se activa en la
          cuenta de Mercado Pago.
        </label>
        <p className="text-xs text-muted-foreground">
          El despacho es gratis solo si el subtotal de productos es superior al umbral. En el umbral
          exacto se cobra el costo base. No hay cupones en la tienda, así que el umbral no descuenta
          promociones.
        </p>
        <button
          type="button"
          onClick={saveSettings}
          disabled={savingConfig}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
        >
          {savingConfig ? "Guardando…" : "Guardar configuración"}
        </button>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-extrabold">Calcular un precio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Producto
            <select
              className={field}
              value={productId}
              onChange={(e) => {
                const id = e.target.value;
                setProductId(id);
                const product = products.find((item) => item.id === id);
                if (product) setCurrentPrice(String(product.price));
              }}
            >
              <option value="">Simular sin guardar</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {formatCLP(product.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Costo de compra
            <input
              type="number"
              min={0}
              className={field}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Ganancia deseada ({profitMode === "amount" ? "pesos" : "% del costo"})
            <input
              type="number"
              min={0}
              className={field}
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Despacho que asume la tienda
            <input
              type="number"
              min={0}
              className={field}
              value={shippingAssumed}
              onChange={(e) => setShippingAssumed(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Precio de venta actual
            <input
              type="number"
              min={0}
              className={field}
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-3 text-sm">
          <label className="flex gap-2">
            <input
              type="radio"
              checked={profitMode === "amount"}
              onChange={() => setProfitMode("amount")}
            />{" "}
            Pesos
          </label>
          <label className="flex gap-2">
            <input
              type="radio"
              checked={profitMode === "percent"}
              onChange={() => setProfitMode("percent")}
            />{" "}
            Porcentaje
          </label>
        </div>
        {plan && !plan.ok && <p className="text-sm text-destructive">{plan.message}</p>}
        {plan && plan.ok && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Result label="Precio recomendado" value={formatCLP(plan.plan.recommendedPrice)} />
            <Result
              label="Comisión estimada, una sola vez"
              value={formatCLP(plan.plan.commission)}
            />
            <Result label="Neto después de comisión" value={formatCLP(plan.plan.net)} />
            <Result label="Costos totales estimados" value={formatCLP(plan.plan.totalCosts)} />
            <Result label="Ganancia estimada" value={formatCLP(plan.plan.profit)} />
            <Result
              label="Margen sobre la venta"
              value={plan.plan.marginPercent == null ? "—" : `${plan.plan.marginPercent}%`}
            />
            <Result
              label="Cuota base"
              value={
                plan.plan.installmentAmount == null ? "—" : formatCLP(plan.plan.installmentAmount)
              }
            />
            <Result
              label="Última cuota"
              value={
                plan.plan.installmentLastAmount == null
                  ? "—"
                  : formatCLP(plan.plan.installmentLastAmount)
              }
            />
            {plan.plan.currentProfit != null && (
              <Result
                label="Ganancia del precio actual"
                value={formatCLP(plan.plan.currentProfit)}
              />
            )}
          </dl>
        )}
        <button
          type="button"
          onClick={applyPrice}
          disabled={!productId || !plan?.ok || savingPrice}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {savingPrice ? "Guardando precio…" : "Usar este precio en el producto"}
        </button>
      </section>
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
