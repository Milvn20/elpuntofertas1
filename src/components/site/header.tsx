import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShieldUser, LogOut } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "@/lib/site";
import logo from "@/assets/elpuntofertas.jpg";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/catalogo", search: { q: q || undefined } as any });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img
                 src={logo} 
                 alt="Elpuntofertas" 
                 className="size-9 rounded-full object-cover ring-1 ring-border" 
                 />
            <span className="text-lg font-extrabold lowercase tracking-tighter">elpuntofertas</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link to="/catalogo" className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">
              Catálogo
            </Link>
            <Link to="/" hash="categorias" className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">
              Categorías
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="relative hidden items-center sm:flex">
            <Search className="absolute left-3 size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar producto…"
              className="w-48 rounded-full bg-muted py-1.5 pl-9 pr-4 text-sm outline-none transition-all focus:w-64 focus:ring-1 focus:ring-accent"
            />
          </form>
          <a
            href= {`https://instagram.com/${SITE.instagram}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
            className="hidden items-center rounded-full border border-border p-2 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-foreground/40 hover:text-foreground sm:inline-flex"
          > 
            <FaInstagram className="size-3.5" />
           </a>
          {signedIn ? (
            <>
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest hover:bg-foreground hover:text-background"
              >
                <ShieldUser className="size-3.5" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest hover:bg-foreground hover:text-background"
                title="Cerrar sesión"
              >
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest hover:bg-foreground hover:text-background"
            >
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 md:flex-row md:items-center md:px-6">
        <div className="space-y-1">
          <p className="font-extrabold uppercase tracking-tighter">{SITE.name}</p>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            © {new Date().getFullYear()} — Inventario privado · {SITE.city}
          </p>
        </div>
        <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link to="/catalogo" className="hover:text-accent">Catálogo</Link>
          <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-accent">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}