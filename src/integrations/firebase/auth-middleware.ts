import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { getFirebaseAdminAuth } from "./admin.server";

export const requireFirebaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const authHeader = getRequest()?.headers?.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return next({
      context: {
        userId: decoded.uid,
        email: decoded.email ?? null,
        isAdmin: decoded.admin === true,
        claims: decoded,
      },
    });
  } catch {
    throw new Error("Unauthorized: Invalid token");
  }
});
