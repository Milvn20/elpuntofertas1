export type CommerceSettings = {
  freeShippingMinClp: number;
  baseShippingClp: number;
  cardFeePercent: number;
  installmentsFeePercent: number;
  installmentCount: number;
  operationalCostClp: number;
  showInstallments: boolean;
};

export const DEFAULT_COMMERCE_SETTINGS: CommerceSettings = {
  freeShippingMinClp: 100_000,
  baseShippingClp: 3_000,
  cardFeePercent: 2.69,
  installmentsFeePercent: 3.49,
  installmentCount: 6,
  operationalCostClp: 0,
  showInstallments: true,
};

export type CommerceSettingsError = { ok: false; message: string };
export type CommerceSettingsOk = { ok: true; settings: CommerceSettings };

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(value: unknown, label: string): number | CommerceSettingsError {
  const number = finiteNumber(value);
  if (number == null || number < 0 || number >= 100) {
    return {
      ok: false,
      message: `${label} debe ser un porcentaje entre 0 y 100, sin incluir 100.`,
    };
  }
  return number;
}

export function parseCommerceSettings(raw: unknown): CommerceSettingsOk | CommerceSettingsError {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const freeShippingMinClp = finiteNumber(data.freeShippingMinClp);
  const baseShippingClp = finiteNumber(data.baseShippingClp);
  const operationalCostClp = finiteNumber(data.operationalCostClp);
  const installmentCount = finiteNumber(data.installmentCount);
  const card = percent(data.cardFeePercent, "La comisión de tarjeta");
  const installments = percent(data.installmentsFeePercent, "La comisión de cuotas");
  if (typeof card === "object") return card;
  if (typeof installments === "object") return installments;
  if (card + installments >= 100) {
    return { ok: false, message: "La suma de las comisiones debe ser menor a 100%." };
  }
  if (
    freeShippingMinClp == null ||
    freeShippingMinClp < 0 ||
    !Number.isInteger(freeShippingMinClp)
  ) {
    return {
      ok: false,
      message: "El umbral de despacho gratis debe ser un monto entero en pesos.",
    };
  }
  if (baseShippingClp == null || baseShippingClp < 0 || !Number.isInteger(baseShippingClp)) {
    return { ok: false, message: "El costo base de despacho debe ser un monto entero en pesos." };
  }
  if (
    operationalCostClp == null ||
    operationalCostClp < 0 ||
    !Number.isInteger(operationalCostClp)
  ) {
    return { ok: false, message: "Los costos operacionales deben ser un monto entero en pesos." };
  }
  if (
    installmentCount == null ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 48
  ) {
    return { ok: false, message: "La cantidad de cuotas debe estar entre 1 y 48." };
  }
  return {
    ok: true,
    settings: {
      freeShippingMinClp,
      baseShippingClp,
      cardFeePercent: card,
      installmentsFeePercent: installments,
      installmentCount,
      operationalCostClp,
      showInstallments: data.showInstallments !== false,
    },
  };
}

export function settingsFromFirestore(raw: unknown): CommerceSettings {
  const parsed = parseCommerceSettings({
    ...DEFAULT_COMMERCE_SETTINGS,
    ...(raw && typeof raw === "object" ? raw : {}),
  });
  return parsed.ok ? parsed.settings : DEFAULT_COMMERCE_SETTINGS;
}

export function totalCommissionRate(
  settings: Pick<CommerceSettings, "cardFeePercent" | "installmentsFeePercent">,
): number {
  return (settings.cardFeePercent + settings.installmentsFeePercent) / 100;
}

export function qualifiesForFreeShipping(
  subtotal: number,
  settings: Pick<CommerceSettings, "freeShippingMinClp">,
): boolean {
  return subtotal > settings.freeShippingMinClp;
}

export function shippingQuote(
  subtotal: number,
  fulfillment: "retiro" | "despacho",
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS,
): { cost: number; note: string; free: boolean; remaining: number } {
  if (fulfillment === "retiro") {
    return {
      cost: 0,
      free: false,
      remaining: 0,
      note: "Retiro coordinado. Este pedido no incluye costo de despacho.",
    };
  }
  if (qualifiesForFreeShipping(subtotal, settings)) {
    return {
      cost: 0,
      free: true,
      remaining: 0,
      note: `Despacho gratis: la compra supera los $${settings.freeShippingMinClp.toLocaleString("es-CL")}.`,
    };
  }
  const remaining = settings.freeShippingMinClp - subtotal + 1;
  return {
    cost: settings.baseShippingClp,
    free: false,
    remaining,
    note: `Despacho $${settings.baseShippingClp.toLocaleString("es-CL")}. Gratis en compras sobre $${settings.freeShippingMinClp.toLocaleString("es-CL")}.`,
  };
}

export function shippingProgressMessage(
  subtotal: number,
  settings: CommerceSettings = DEFAULT_COMMERCE_SETTINGS,
): string {
  const quote = shippingQuote(subtotal, "despacho", settings);
  if (quote.free) return "¡Tu compra tiene despacho gratis!";
  if (subtotal <= 0)
    return `¡Despacho gratis en compras sobre $${settings.freeShippingMinClp.toLocaleString("es-CL")}!`;
  return `Te faltan $${quote.remaining.toLocaleString("es-CL")} para obtener despacho gratis.`;
}

export function displayInstallmentAmount(total: number, count: number): number | null {
  const plan = installmentPlan(total, count);
  if (!plan) return null;
  return Math.round(total / plan.count);
}

export function installmentPlan(
  total: number,
  count: number,
): { count: number; amount: number; lastAmount: number } | null {
  const installments = Math.floor(count);
  const amount = Math.round(total);
  if (installments < 2 || !Number.isFinite(amount) || amount < 0) return null;
  const base = Math.floor(amount / installments);
  const remainder = amount - base * installments;
  return { count: installments, amount: base, lastAmount: base + remainder };
}

export type PricePlanInput = {
  cost: number;
  profitAmount?: number | null;
  profitPercent?: number | null;
  cardFeePercent: number;
  installmentsFeePercent: number;
  shippingAssumed: number;
  otherCosts: number;
  currentPrice?: number | null;
  installmentCount: number;
};

export type PricePlan = {
  recommendedPrice: number;
  commission: number;
  net: number;
  totalCosts: number;
  profit: number;
  marginPercent: number | null;
  currentNet: number | null;
  currentProfit: number | null;
  installmentAmount: number | null;
  installmentLastAmount: number | null;
};

export function pricePlan(
  input: PricePlanInput,
): { ok: true; plan: PricePlan } | { ok: false; message: string } {
  const rates = parseCommerceSettings({
    ...DEFAULT_COMMERCE_SETTINGS,
    cardFeePercent: input.cardFeePercent,
    installmentsFeePercent: input.installmentsFeePercent,
    installmentCount: input.installmentCount,
    operationalCostClp: input.otherCosts,
  });
  if (!rates.ok) return rates;
  const cost = finiteNumber(input.cost);
  const shippingAssumed = finiteNumber(input.shippingAssumed);
  const otherCosts = finiteNumber(input.otherCosts);
  if (cost == null || cost < 0)
    return { ok: false, message: "El costo del producto no es válido." };
  if (shippingAssumed == null || shippingAssumed < 0)
    return { ok: false, message: "El despacho asumido no es válido." };
  if (otherCosts == null || otherCosts < 0)
    return { ok: false, message: "Los otros costos no son válidos." };
  let profit = finiteNumber(input.profitAmount);
  if (profit == null) {
    const percentProfit = finiteNumber(input.profitPercent);
    if (percentProfit == null || percentProfit < 0)
      return { ok: false, message: "Indica la ganancia en pesos o en porcentaje." };
    profit = cost * (percentProfit / 100);
  }
  if (profit < 0) return { ok: false, message: "La ganancia no puede ser negativa." };
  const rate = totalCommissionRate(rates.settings);
  const target = cost + profit + shippingAssumed + otherCosts;
  const recommendedPrice = Math.ceil(target / (1 - rate) - 1e-9);
  const commission = Math.round(recommendedPrice * rate);
  const net = recommendedPrice - commission;
  const totalCosts = cost + shippingAssumed + otherCosts + commission;
  const resultingProfit = net - cost - shippingAssumed - otherCosts;
  const marginPercent =
    recommendedPrice > 0 ? Math.round((resultingProfit / recommendedPrice) * 1000) / 10 : null;
  const currentPrice = input.currentPrice == null ? null : finiteNumber(input.currentPrice);
  const currentCommission = currentPrice == null ? null : Math.round(currentPrice * rate);
  const currentNet =
    currentPrice == null || currentCommission == null ? null : currentPrice - currentCommission;
  const currentProfit =
    currentNet == null ? null : currentNet - cost - shippingAssumed - otherCosts;
  const installments = installmentPlan(recommendedPrice, rates.settings.installmentCount);
  return {
    ok: true,
    plan: {
      recommendedPrice,
      commission,
      net,
      totalCosts,
      profit: resultingProfit,
      marginPercent,
      currentNet,
      currentProfit,
      installmentAmount: installments?.amount ?? null,
      installmentLastAmount: installments?.lastAmount ?? null,
    },
  };
}

export function canEditCommerce(isAdmin: boolean): boolean {
  return isAdmin === true;
}
