import { getDataBackend, useFirebaseBackend } from "@/lib/data/backend";

function assertBackend() {
  if (getDataBackend() === "none") {
    throw new Error(
      "Firebase no está configurado. Añade VITE_FIREBASE_* en .env (guía: docs/FIREBASE-SETUP.md). Supabase pausado no sirve como respaldo.",
    );
  }
}

export type AuthUser = { id: string; email: string | null; name: string | null };

export async function getCurrentSession(): Promise<{ user: AuthUser | null; isAdmin: boolean }> {
  if (useFirebaseBackend()) {
    const { getFirebaseAuth } = await import("@/integrations/firebase/client");
    const { getIdTokenResult, onAuthStateChanged } = await import("firebase/auth");
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (user) {
      const token = await getIdTokenResult(user, true);
      return {
        user: { id: user.uid, email: user.email, name: user.displayName },
        isAdmin: token.claims.admin === true,
      };
    }
    return new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        unsub();
        if (!u) return resolve({ user: null, isAdmin: false });
        const token = await getIdTokenResult(u, true);
        resolve({ user: { id: u.uid, email: u.email, name: u.displayName }, isAdmin: token.claims.admin === true });
      });
    });
  }
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!data.session) return { user: null, isAdmin: false };
  const uid = data.session.user.id;
  let isAdmin = false;
  const { data: roles, error: rolesErr } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  if (!rolesErr) {
    isAdmin = (roles ?? []).some((r) => r.role === "admin");
  } else {
    console.warn("[auth] No se pudo leer user_roles:", rolesErr.message);
  }
  return {
    user: { id: uid, email: data.session.user.email ?? null, name: null },
    isAdmin,
  };
}

export async function signIn(email: string, password: string) {
  assertBackend();
  if (useFirebaseBackend()) {
    const { getFirebaseAuth } = await import("@/integrations/firebase/client");
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    return;
  }
  const { supabase } = await import("@/integrations/supabase/client");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUp(name: string, email: string, password: string) {
  assertBackend();
  if (useFirebaseBackend()) {
    const { getFirebaseAuth } = await import("@/integrations/firebase/client");
    const { getFirebaseDb } = await import("@/integrations/firebase/client");
    const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
    const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
    const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    try {
      await setDoc(doc(getFirebaseDb(), "users", cred.user.uid), {
        uid: cred.user.uid,
        name: name.trim() || email.split("@")[0],
        email: email.trim(),
        role: "user",
        active: true,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } catch (profileErr) {
      console.warn("[auth] Perfil Firestore no creado (la cuenta Auth sí existe):", profileErr);
    }
    return;
  }
  const { supabase } = await import("@/integrations/supabase/client");
  const trimmedEmail = email.trim();
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: { data: { display_name: name.trim() || null } },
  });
  if (error) throw error;
  // Si la confirmación por correo está desactivada, suele venir sesión; si no, intentamos login directo.
  if (!data.session) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (signInErr) {
      throw new Error(
        "Cuenta creada. Si tu proyecto exige confirmar el correo, revisa tu bandeja antes de ingresar.",
      );
    }
    if (!signInData.session) {
      throw new Error("Cuenta creada pero no hay sesión activa. Confirma tu correo o intenta iniciar sesión.");
    }
  }
}

export async function signOut() {
  if (useFirebaseBackend()) {
    const { getFirebaseAuth } = await import("@/integrations/firebase/client");
    const { signOut: fbOut } = await import("firebase/auth");
    await fbOut(getFirebaseAuth());
    return;
  }
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  if (useFirebaseBackend()) {
    const { getFirebaseAuth } = await import("@/integrations/firebase/client");
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    return;
  }
  const { supabase } = await import("@/integrations/supabase/client");
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw error;
}

export function subscribeAuth(callback: (signedIn: boolean) => void) {
  if (useFirebaseBackend()) {
    let unsub = () => {};
    import("@/integrations/firebase/client").then(({ getFirebaseAuth }) =>
      import("firebase/auth").then(({ onAuthStateChanged }) => {
        unsub = onAuthStateChanged(getFirebaseAuth(), (u) => callback(!!u));
      }),
    );
    return () => unsub();
  }
  import("@/integrations/supabase/client").then(({ supabase }) => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => callback(!!s));
    return () => data.subscription.unsubscribe();
  });
  return () => {};
}
