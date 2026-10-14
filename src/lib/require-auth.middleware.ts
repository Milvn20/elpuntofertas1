import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { useFirebaseBackend } from "@/lib/data/backend";

export type AuthContext = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  supabase?: import("@supabase/supabase-js").SupabaseClient;
};

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  const authHeader = request?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("Unauthorized");

  if (useFirebaseBackend()) {
    const { getFirebaseAdminAuth } = await import("@/integrations/firebase/admin.server");
    try {
      const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
      return next({
        context: {
          userId: decoded.uid,
          email: decoded.email ?? null,
          isAdmin: decoded.admin === true,
        } satisfies AuthContext,
      });
    } catch {
      throw new Error("Unauthorized: Invalid token");
    }
  }

  const { createClient } = await import("@supabase/supabase-js");
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error("Supabase no configurado en servidor");
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");
  const userId = data.claims.sub as string;
  const { data: roleRow } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return next({
    context: { userId, email: (data.claims.email as string) ?? null, isAdmin: !!roleRow, supabase } satisfies AuthContext,
  });
});

export function assertAdminContext(ctx: AuthContext) {
  if (!ctx.isAdmin) throw new Error("Forbidden");
}
