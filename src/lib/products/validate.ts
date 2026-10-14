const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: { type: string; size: number; name: string }): string | null {
  if (!IMAGE_TYPES.has(file.type)) return "Solo se permiten imágenes JPG, PNG, WEBP o GIF.";
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) return "La imagen debe pesar menos de 5 MB.";
  return null;
}

export function validateProductDraft(input: {
  name: string;
  slug: string;
  price: number;
  previousPrice?: number | null;
  stock: number;
  minStock: number;
}): string | null {
  const name = input.name.trim();
  const slug = input.slug.trim();
  if (name.length < 2 || name.length > 180) return "El nombre debe tener entre 2 y 180 caracteres.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "El slug solo puede usar minúsculas, números y guiones.";
  if (!Number.isFinite(input.price) || input.price < 0) return "El precio no puede ser negativo.";
  if (!Number.isInteger(input.stock) || input.stock < 0) return "El stock debe ser un entero mayor o igual a 0.";
  if (!Number.isInteger(input.minStock) || input.minStock < 0) return "El stock mínimo no es válido.";
  if (input.previousPrice != null) {
    if (!Number.isFinite(input.previousPrice) || input.previousPrice <= input.price) {
      return "El precio anterior solo se guarda si es mayor que el precio actual.";
    }
  }
  return null;
}
