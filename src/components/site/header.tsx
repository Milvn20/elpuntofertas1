import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShieldUser, LogOut } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { SITE } from "@/lib/site";
import logo from "@/assets/elpuntofertas.jpg";
import { getCurrentSession, signOut } from "@/lib/auth/client";
import { useFirebaseBackend } from "@/lib/data/backend";

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let unsub = () => {};
    const refresh = () => getCurrentSession().then(({ user, isAdmin: admin }) => {
      setSignedIn(!!user);
      setIsAdmin(admin);
    });
    refresh();
    if (useFirebaseBackend()) {
      import("@/integrations/firebase/client").then(({ getFirebaseAuth }) =>
        import("firebase/auth").then(({ onAuthStateChanged }) => {
          unsub = onAuthStateChanged(getFirebaseAuth(), () => refresh());
        }),
      );
    } else {
      import("@/integrations/supabase/client").then(({ supabase }) => {
        const { data } = supabase.auth.onAuthStateChange(() => refresh());
        unsub = () => data.subscription.unsubscribe();
      });
    }
    return () => unsub();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/catalogo", search: { q: q || undefined } as any });
  }

  async function logout() {
    await signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Elpuntofertas" className="size-9 rounded-full object-cover ring-1 ring-border" />
            <span className="text-lg font-extrabold lowercase tracking-tighter">elpuntofertas</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link to="/catalogo" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">Catálogo</Link>
            <Link to="/" hash="categorias" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">Categorías</Link>
            <Link to="/catalogo" search={{ sort: "price_asc" } as any} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">Ofertas</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="relative hidden items-center sm:flex">
            <Search className="absolute left-3 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" className="w-48 rounded-full bg-muted py-1.5 pl-9 pr-4 text-sm outline-none focus:w-64 focus:ring-1 focus:ring-accent" />
          </form>
          <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer" aria-label="Instagram" className="hidden rounded-full border border-border p-2 sm:inline-flex">
            <FaInstagram className="size-3.5" />
          </a>
          {signedIn ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase">
                  <ShieldUser className="size-3.5" /> Admin
                </Link>
              )}
              <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase">
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase">Cuenta</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border py-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div>
          <p className="font-extrabold uppercase tracking-tighter">{SITE.name}</p>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">© {new Date().getFullYear()} · {SITE.city}</p>
        </div>
        <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link to="/catalogo" className="hover:text-accent">Catálogo</Link>
          <a href={`https://wa.me/${SITE.whatsapp}`} target="_blank" rel="noreferrer" className="hover:text-accent">WhatsApp</a>
        </div>
      </div>
    </footer>
  );
}
