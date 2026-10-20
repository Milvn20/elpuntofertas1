import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCommerceSettings } from "@/lib/commerce.functions";
import { DEFAULT_COMMERCE_SETTINGS, type CommerceSettings } from "@/lib/commerce/policy";

const CommerceContext = createContext<CommerceSettings>(DEFAULT_COMMERCE_SETTINGS);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_COMMERCE_SETTINGS);
  useEffect(() => {
    let live = true;
    getCommerceSettings()
      .then((next) => {
        if (live && next) setSettings(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return <CommerceContext.Provider value={settings}>{children}</CommerceContext.Provider>;
}

export function useCommerceSettings() {
  return useContext(CommerceContext);
}
