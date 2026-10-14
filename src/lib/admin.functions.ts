import { createServerFn } from "@tanstack/react-start";
import { assertAdminContext, requireAuth } from "@/lib/require-auth.middleware";
import { useFirebaseBackend } from "@/lib/data/backend";

type Role = "admin" | "user";

const redeemAttempts = new Map<string, { count: number; at: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const row = redeemAttempts.get(key);
  if (!row || now - row.at > 15 * 60 * 1000) {
    redeemAttempts.set(key, { count: 1, at: now });
    return;
  }
  row.count += 1;
  if (row.count > 8) throw new Error("Demasiados intentos. Inténtalo más tarde.");
}

export const redeemAdminCode = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { code: string }) => {
    if (typeof data?.code !== "string") throw new Error("Código inválido");
    return { code: data.code.trim() };
  })
  .handler(async ({ data, context }) => {
    checkRateLimit(context.userId);
    const expected = process.env.ADMIN_ACCESS_CODE ?? process.env.ADMIN_SIGNUP_CODE;
    if (!expected) throw new Error("Código de administrador no configurado en el servidor");
    if (!data.code || data.code !== expected) {
      return { ok: false as const };
    }

    if (useFirebaseBackend()) {
      const { getFirebaseAdminAuth, getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      const { FieldValue } = await import("firebase-admin/firestore");
      await getFirebaseAdminAuth().setCustomUserClaims(context.userId, { admin: true });
      await getFirebaseAdminDb().collection("users").doc(context.userId).set(
        { role: "admin", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await getFirebaseAdminDb().collection("auditLogs").doc(crypto.randomUUID()).set({
        actorUid: context.userId,
        action: "grant_admin",
        entityType: "user",
        entityId: context.userId,
        timestamp: FieldValue.serverTimestamp(),
      });
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: Role[];
};

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    assertAdminContext(context);

    if (useFirebaseBackend()) {
      const { getFirebaseAdminAuth, getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      const list = await getFirebaseAdminAuth().listUsers(200);
      const db = getFirebaseAdminDb();
      const rolesSnap = await db.collection("users").get();
      const roleByUid = new Map<string, Role>();
      rolesSnap.docs.forEach((d) => {
        const r = d.data().role;
        roleByUid.set(d.id, r === "admin" ? "admin" : "user");
      });
      return list.users.map((u) => ({
        id: u.uid,
        email: u.email ?? null,
        created_at: u.metadata.creationTime,
        last_sign_in_at: u.metadata.lastSignInTime ?? null,
        roles: roleByUid.get(u.uid) === "admin" || u.customClaims?.admin ? ["admin"] : ["user"],
      }));
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (authErr) throw new Error(authErr.message);
    const { data: roles, error: rolesErr } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);
    const rolesByUser = new Map<string, Role[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    return authList.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string; role: Role; grant: boolean }) => {
    if (!data?.userId) throw new Error("userId requerido");
    if (data.role !== "admin" && data.role !== "user") throw new Error("Rol inválido");
    return { userId: data.userId, role: data.role, grant: !!data.grant };
  })
  .handler(async ({ data, context }) => {
    assertAdminContext(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("No puedes quitarte a ti mismo el rol admin");
    }

    if (useFirebaseBackend()) {
      if (data.role !== "admin") throw new Error("Solo se gestiona rol admin en Firebase");
      const { getFirebaseAdminAuth, getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      const { FieldValue } = await import("firebase-admin/firestore");
      await getFirebaseAdminAuth().setCustomUserClaims(data.userId, data.grant ? { admin: true } : { admin: false });
      await getFirebaseAdminDb().collection("users").doc(data.userId).set(
        { role: data.grant ? "admin" : "user", updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      await getFirebaseAdminDb().collection("auditLogs").doc(crypto.randomUUID()).set({
        actorUid: context.userId,
        action: data.grant ? "grant_admin" : "revoke_admin",
        entityType: "user",
        entityId: data.userId,
        timestamp: FieldValue.serverTimestamp(),
        metadata: { role: data.grant ? "admin" : "user" },
      });
      return { ok: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId) throw new Error("userId requerido");
    return { userId: data.userId };
  })
  .handler(async ({ data, context }) => {
    assertAdminContext(context);
    if (data.userId === context.userId) throw new Error("No puedes eliminar tu propia cuenta desde el panel");

    if (useFirebaseBackend()) {
      const { getFirebaseAdminAuth, getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
      await getFirebaseAdminAuth().deleteUser(data.userId);
      await getFirebaseAdminDb().collection("users").doc(data.userId).delete();
      return { ok: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const appendAuditLog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: { action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }) => {
    if (!data?.action || !data.entityType || !data.entityId) throw new Error("Auditoría inválida");
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data.metadata ?? {})) {
      if (/password|token|secret|credential/i.test(key)) continue;
      metadata[key] = value;
    }
    return {
      action: String(data.action).slice(0, 80),
      entityType: String(data.entityType).slice(0, 40),
      entityId: String(data.entityId).slice(0, 128),
      metadata,
    };
  })
  .handler(async ({ data, context }) => {
    assertAdminContext(context);
    if (!useFirebaseBackend()) return { ok: false as const };
    const { getFirebaseAdminDb } = await import("@/integrations/firebase/admin.server");
    const { FieldValue } = await import("firebase-admin/firestore");
    await getFirebaseAdminDb().collection("auditLogs").doc(crypto.randomUUID()).set({
      actorUid: context.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata,
      timestamp: FieldValue.serverTimestamp(),
    });
    return { ok: true as const };
  });
