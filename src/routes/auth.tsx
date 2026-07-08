import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Mail, ArrowLeft, KeyRound } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SITE } from "@/lib/site";
import { useServerFn } from "@tanstack/react-start";
import { redeemAdminCode } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso · El Garaje" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [loading, setLoading] = useState(false);
  const redeem = useServerFn(redeemAdminCode);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Ensure a session before calling the protected server fn.
        if (adminCode.trim()) {
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session) {
            await supabase.auth.signInWithPassword({ email, password });
          }
          try {
            const res = await redeem({ data: { code: adminCode.trim() } });
            if (res.ok) toast.success("Cuenta creada con rol administrador");
            else toast.message("Cuenta creada como usuario", { description: "Código de administrador incorrecto" });
          } catch (err: any) {
            toast.error(err?.message ?? "No se pudo validar el código admin");
          }
        } else {
          toast.success("Cuenta creada. Iniciando sesión…");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo completar la acción");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-foreground p-10 text-background md:flex">
        <div>
          <p className="text-lg font-extrabold uppercase tracking-tighter">{SITE.name}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-background/60">
            Panel de administración
          </p>
        </div>
        <div>
          <p className="max-w-sm text-balance text-3xl font-extrabold tracking-tighter md:text-4xl">
            Inventario, catálogo y consultas — todo desde un mismo lugar.
          </p>
          <p className="mt-3 text-sm text-background/60">
            Acceso restringido a personal autorizado.
          </p>
        </div>
        <Link to="/" className="inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-background/60 hover:text-background">
          <ArrowLeft className="size-3.5" /> Volver al sitio
        </Link>
      </aside>

      <main className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {mode === "login" ? "/ Acceso" : "/ Registro"}
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tighter">
              {mode === "login" ? "Ingresar al panel" : "Crear cuenta"}
            </h1>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Contraseña</span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <Lock className="size-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </label>
          </div>

          {mode === "signup" && (
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Código de administrador (opcional)
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
                <KeyRound className="size-4 text-muted-foreground" />
                <input
                  type="password"
                  autoComplete="off"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="Déjalo vacío para cuenta normal"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
              </div>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Solo si te dieron un código
              </p>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-foreground py-3 text-sm font-semibold text-background transition-opacity disabled:opacity-50"
          >
            {loading ? "Procesando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === "login" ? (
              <>¿No tienes cuenta?{" "}
                <button type="button" onClick={() => setMode("signup")} className="font-semibold text-foreground underline">Crear una</button>
              </>
            ) : (
              <>¿Ya tienes cuenta?{" "}
                <button type="button" onClick={() => setMode("login")} className="font-semibold text-foreground underline">Ingresar</button>
              </>
            )}
          </p>
        </form>
      </main>
    </div>
  );
}