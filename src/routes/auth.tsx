import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Mail, ArrowLeft, KeyRound, User } from "lucide-react";
import { toast } from "sonner";
import { SITE } from "@/lib/site";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapEmulatorAdmin, redeemAdminCode } from "@/lib/admin.functions";
import { getCurrentSession, signIn, signUp, resetPassword } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { backendSetupMessage, getDataBackend, useFirebaseBackend } from "@/lib/data/backend";
import { useFirebaseEmulators } from "@/integrations/firebase/config";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: `Acceso · ${SITE.name}` }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);
  const redeem = useServerFn(redeemAdminCode);
  const bootstrapAdmin = useServerFn(bootstrapEmulatorAdmin);

  useEffect(() => {
    getCurrentSession()
      .then(({ user, isAdmin }) => {
        if (user && isAdmin) navigate({ to: "/admin" });
      })
      .catch(() => {
        /* sin sesión o red caída al cargar */
      });
  }, [navigate]);

  async function afterAuth(isSignup: boolean) {
    if (useFirebaseEmulators()) {
      try {
        const boot = await bootstrapAdmin();
        const { getFirebaseAuth } = await import("@/integrations/firebase/client");
        await getFirebaseAuth().currentUser?.getIdToken(true);
        if (boot.ok) {
          toast.success("Entraste como administrador");
          navigate({ to: "/admin" });
          return;
        }
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudo activar el administrador. Enciende Firebase con npm run emulators.");
      }
    }
    const { isAdmin } = await getCurrentSession();
    if (isSignup && adminCode.trim()) {
      try {
        const res = await redeem({ data: { code: adminCode.trim() } });
        if (res.ok) {
          toast.success("Rol administrador asignado");
          if (useFirebaseBackend()) {
            const { getFirebaseAuth } = await import("@/integrations/firebase/client");
            await getFirebaseAuth().currentUser?.getIdToken(true);
          }
        } else toast.message("Código incorrecto", { description: "La cuenta quedó como usuario estándar" });
      } catch (e: any) {
        toast.error(e?.message ?? "No se pudo validar el código");
      }
      const again = await getCurrentSession();
      if (again.isAdmin) navigate({ to: "/admin" });
      else navigate({ to: "/" });
      return;
    }
    if (isAdmin) navigate({ to: "/admin" });
    else {
      toast.message("Sesión iniciada", { description: "Esta cuenta no tiene acceso al panel administrativo." });
      navigate({ to: "/" });
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "reset") {
        await resetPassword(email);
        toast.success("Revisa tu correo para restablecer la contraseña");
        setMode("login");
        return;
      }
      if (mode === "signup") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
        await signUp(name, email, password);
        toast.success("Cuenta creada");
      } else {
        await signIn(email, password);
      }
      await afterAuth(mode === "signup");
    } catch (err: unknown) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-foreground p-10 text-background md:flex">
        <div>
          <p className="text-lg font-extrabold uppercase tracking-tighter">{SITE.name}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-background/60">Panel de administración</p>
        </div>
        <p className="max-w-sm text-3xl font-extrabold tracking-tighter">Inventario y catálogo en un solo lugar.</p>
        <Link to="/" className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-background/60 hover:text-background">
          <ArrowLeft className="size-3.5" /> Volver al sitio
        </Link>
      </aside>
      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          {getDataBackend() !== "firebase" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
              <strong>Supabase pausado:</strong> {backendSetupMessage()} Guía completa:{" "}
              <code className="text-[10px]">docs/FIREBASE-SETUP.md</code>
            </div>
          )}
          {useFirebaseEmulators() && (
            <p className="rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed">
              Firebase local activo. La primera cuenta que inicie sesión queda como administradora y los productos se guardan en ese Firebase.
            </p>
          )}
          <h1 className="text-3xl font-extrabold tracking-tighter">
            {mode === "login" ? "Ingresar" : mode === "signup" ? "Crear cuenta" : "Recuperar contraseña"}
          </h1>
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Nombre</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <User className="size-4 text-muted-foreground" />
                <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
              </div>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
              <Mail className="size-4 text-muted-foreground" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
            </div>
          </label>
          {mode !== "reset" && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Contraseña</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Lock className="size-4 text-muted-foreground" />
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
              </div>
            </label>
          )}
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Código admin (opcional)</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <KeyRound className="size-4 text-muted-foreground" />
                <input type="password" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
              </div>
            </label>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background disabled:opacity-50">
            {loading ? "Procesando…" : mode === "reset" ? "Enviar enlace" : mode === "login" ? "Ingresar" : "Registrarme"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" && (
              <>
                <button type="button" className="underline" onClick={() => setMode("reset")}>Olvidé mi contraseña</button>
                {" · "}
                <button type="button" className="underline" onClick={() => setMode("signup")}>Crear cuenta</button>
              </>
            )}
            {mode === "signup" && <button type="button" className="underline" onClick={() => setMode("login")}>Ya tengo cuenta</button>}
            {mode === "reset" && <button type="button" className="underline" onClick={() => setMode("login")}>Volver</button>}
          </p>
        </form>
      </main>
    </div>
  );
}
