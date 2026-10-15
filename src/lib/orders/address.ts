export const CHILE_REGIONS = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén",
  "Magallanes",
] as const;

export type ChileRegion = (typeof CHILE_REGIONS)[number];

export type ShippingAddress = {
  country: "Chile";
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  postalCode: string;
  city: string;
  region: ChileRegion;
};

function clean(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export function parseShippingAddress(raw: unknown): ShippingAddress {
  const data = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const firstName = clean(data.firstName, 60);
  const lastName = clean(data.lastName, 60);
  const line1 = clean(data.line1, 160);
  const line2 = clean(data.line2, 80);
  const postalCode = clean(data.postalCode, 12);
  const city = clean(data.city, 80);
  const region = clean(data.region, 40);
  if (firstName.length < 2) throw new Error("Escribe el nombre de quien recibe el despacho.");
  if (lastName.length < 2) throw new Error("Escribe los apellidos de quien recibe el despacho.");
  if (line1.length < 5) throw new Error("Escribe la dirección de despacho.");
  if (city.length < 2) throw new Error("Escribe la ciudad de despacho.");
  if (!CHILE_REGIONS.includes(region as ChileRegion)) throw new Error("Elige la región de despacho.");
  return {
    country: "Chile",
    firstName,
    lastName,
    line1,
    line2,
    postalCode,
    city,
    region: region as ChileRegion,
  };
}

export function formatShippingAddress(address: ShippingAddress) {
  const detail = address.line2 ? `, ${address.line2}` : "";
  const postal = address.postalCode ? ` ${address.postalCode}` : "";
  return `${address.line1}${detail}, ${address.city}${postal}, ${address.region}, ${address.country}`;
}
