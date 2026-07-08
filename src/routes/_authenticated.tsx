import { Outlet, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, FolderTree, Home, LogOut, Package, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/_authenticated")({
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/auth" });
        return;
      }
      if (!mounted) return;
      setEmail(session.user.email ?? null);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      if (!isAdmin) {
        // Not an admin → send to home immediately.
        navigate({ to: "/" });
        setState("denied");
        return;
      }
      setState("ok");
    })();
    return () => { mounted = false; };
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Verificando acceso…
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Redirigiendo…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-card md:flex md:flex-col">
        <div className="border-b border-border p-5">
          <Link to="/" className="text-base font-extrabold uppercase tracking-tighter">
            {SITE.name}<span className="ml-1 align-top text-[8px] text-accent">®</span>
          </Link>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            Panel admin
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavItem to="/admin" icon={<Boxes className="size-4" />} label="Inicio" />
          <NavItem to="/admin/productos" icon={<Package className="size-4" />} label="Productos" />
          <NavItem to="/admin/productos/nuevo" icon={<Plus className="size-4" />} label="Nuevo producto" />
          <NavItem to="/admin/categorias" icon={<FolderTree className="size-4" />} label="Categorías" />
          <NavItem to="/admin/usuarios" icon={<Users className="size-4" />} label="Usuarios" />
          <NavItem to="/" icon={<Home className="size-4" />} label="Ver sitio" />
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{email}</p>
          <button onClick={logout} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-foreground hover:text-background">
            <LogOut className="size-3.5" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <Link to="/admin" className="font-extrabold uppercase tracking-tighter">{SITE.name}</Link>
        <button onClick={logout} className="text-xs font-semibold underline">Salir</button>
      </header>

      <main className="min-w-0">
        <div className="md:hidden border-b border-border bg-background">
          <nav className="flex gap-1 overflow-x-auto p-2 text-xs">
            <MobileNav to="/admin" label="Inicio" />
            <MobileNav to="/admin/productos" label="Productos" />
            <MobileNav to="/admin/productos/nuevo" label="Nuevo" />
            <MobileNav to="/admin/categorias" label="Categorías" />
            <MobileNav to="/admin/usuarios" label="Usuarios" />
          </nav>
        </div>
        <div className="p-5 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-foreground data-[status=active]:text-background"
    >
      {icon}
      {label}
    </Link>
  );
}

function MobileNav({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/admin" }}
      className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground data-[status=active]:border-foreground data-[status=active]:bg-foreground data-[status=active]:text-background"
    >
      {label}
    </Link>
  );
}