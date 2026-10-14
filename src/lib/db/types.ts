export type ProductCondition = "nuevo" | "seminuevo" | "usado";

export type ProductImage = {
  url: string;
  storagePath?: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

export type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  condition: ProductCondition;
  price: number;
  previousPrice?: number | null;
  imageUrl?: string | null;
  images?: ProductImage[];
  stock: number;
  minStock: number;
  internalCode?: string | null;
  featured: boolean;
  active: boolean;
};

export type CategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  active: boolean;
  displayOrder: number;
};
