import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cartCount, cartSubtotal, removeCartItem, setCartQuantity, upsertCartItem, type CartItem } from "./logic";

const STORAGE_KEY = "elpuntofertas.cart.v1";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  addItem: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => { ok: boolean; message: string };
  setQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  replaceItems: (items: CartItem[]) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStored(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.productId === "string" && item.quantity > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<CartContextValue>(() => ({
    items,
    count: cartCount(items),
    subtotal: cartSubtotal(items),
    ready,
    addItem: (item) => {
      const result = upsertCartItem(items, item);
      setItems(result.items);
      return { ok: result.ok, message: result.message };
    },
    setQuantity: (productId, quantity) => setItems((current) => setCartQuantity(current, productId, quantity)),
    removeItem: (productId) => setItems((current) => removeCartItem(current, productId)),
    replaceItems: (next) => setItems(next),
    clear: () => setItems([]),
  }), [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
