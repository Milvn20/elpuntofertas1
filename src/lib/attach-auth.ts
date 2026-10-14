import { createMiddleware } from "@tanstack/react-start";
import { useFirebaseBackend } from "@/lib/data/backend";

export const attachAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  if (useFirebaseBackend()) {
    try {
      const { getFirebaseAuth } = await import("@/integrations/firebase/client");
      const user = getFirebaseAuth().currentUser;
      const token = user ? await user.getIdToken() : null;
      return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      return next({ headers: {} });
    }
  }
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
});
