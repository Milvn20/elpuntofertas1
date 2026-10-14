import { getFirebaseWebConfig } from "@/integrations/firebase/config";

export type DataBackend = "firebase" | "supabase" | "none";

function readEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
    return String(import.meta.env[key]).trim();
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key]?.trim();
  }
  return undefined;
}

function hasSupabaseEnv(): boolean {
  return !!(readEnv("VITE_SUPABASE_URL") && readEnv("VITE_SUPABASE_PUBLISHABLE_KEY"));
}

/** Las cuentas y el catálogo viven en Firebase. Supabase pausado no se usa si Firebase está listo. */
export function getDataBackend(): DataBackend {
  if (getFirebaseWebConfig()) return "firebase";
  if (hasSupabaseEnv() && readEnv("VITE_DATA_BACKEND")?.toLowerCase() !== "firebase") return "supabase";
  return "none";
}

export function backendSetupMessage(): string {
  const b = getDataBackend();
  if (b === "firebase") return "";
  if (b === "supabase") {
    return "Estás usando Supabase. Si el proyecto está pausado, configura Firebase (docs/FIREBASE-SETUP.md) y añade VITE_DATA_BACKEND=firebase.";
  }
  return "No hay backend de datos activo. Configura las variables VITE_FIREBASE_* (recomendado) siguiendo docs/FIREBASE-SETUP.md.";
}

export function useFirebaseBackend(): boolean {
  return getDataBackend() === "firebase";
}
