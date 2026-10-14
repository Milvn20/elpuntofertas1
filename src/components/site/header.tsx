import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShieldUser, LogOut, Menu, X, ShoppingBag } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { SITE, whatsappGeneral } from "@/lib/site";
import logo from "@/assets/elpuntofertas logo fondo.svg";
import { getCurrentSession, signOut } from "@/lib/auth/client";
import { useFirebaseBackend } from "@/lib/data/backend";
import { useCart } from "@/lib/cart/cart-context";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/ofertas", label: "Ofertas" },
  { to: "/contacto", label: "Contacto" },
] as const;

export function SiteHeader() {
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const cart = useCart();

  useEffect(() => {
    let unsub = () => {};
    const refresh = () => getCurrentSession().then(({ user, isAdmin: admin }) => {
      setSignedIn(!!user);
      setIsAdmin(admin);
    }).catch(() => {
      setSignedIn(false);
      setIsAdmin(false);
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
    setOpen(false);
    navigate({ to: "/catalogo", search: { q: q || undefined } as any });
  }

  async function logout() {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={logo} alt="Elpuntofertas" className="size-9 rounded-full object-cover ring-1 ring-border" />
            <span className="text-lg font-extrabold tracking-tighter">elpuntofertas</span>
          </Link>
          <nav className="hidden items-center gap-5 lg:flex" aria-label="Principal">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <Link to="/" hash="categorias" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground">Categorías</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="relative hidden items-center md:flex" role="search">
            <Search className="absolute left-3 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" className="w-44 rounded-full bg-muted py-1.5 pl-9 pr-4 text-sm outline-none focus:w-64 focus:ring-1 focus:ring-accent" />
          </form>
          <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer" aria-label="Instagram" className="hidden rounded-full border border-border p-2 sm:inline-flex">
            <FaInstagram className="size-3.5" />
          </a>
          <Link to="/carrito" aria-label={`Carrito, ${cart.count} productos`} className="relative inline-flex rounded-full border border-border p-2">
            <ShoppingBag className="size-4" />
            {cart.count > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cart.count}</span>}
          </Link>
          {signedIn ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase sm:inline-flex">
                  <ShieldUser className="size-3.5" /> Admin
                </Link>
              )}
              <Link to="/cuenta" className="hidden rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase sm:inline-flex">Cuenta</Link>
              <button onClick={logout} aria-label="Cerrar sesión" className="hidden items-center rounded-full border border-border p-2 sm:inline-flex">
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className="hidden rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold uppercase sm:inline-flex">Cuenta</Link>
          )}
          <button type="button" className="rounded-full border border-border p-2 lg:hidden" aria-expanded={open} aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-4 lg:hidden">
          <form onSubmit={submit} className="mb-4 flex items-center gap-2 rounded-full border border-border px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" className="flex-1 bg-transparent text-sm outline-none" />
          </form>
          <nav className="grid gap-2" aria-label="Móvil">
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">{item.label}</Link>
            ))}
            <Link to="/cuenta" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">Cuenta</Link>
            {isAdmin && <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2 text-sm font-semibold hover:bg-muted">Administración</Link>}
            {signedIn && <button type="button" onClick={logout} className="rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-muted">Cerrar sesión</button>}
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border py-12">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-3 md:px-6">
        <div>
          <p className="font-extrabold tracking-tighter">{SITE.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{SITE.city}</p>
          <p className="text-sm text-muted-foreground">{SITE.hours}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <Link to="/catalogo" className="hover:text-accent">Catálogo</Link>
          <Link to="/ofertas" className="hover:text-accent">Ofertas</Link>
          <Link to="/contacto" className="hover:text-accent">Contacto</Link>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{SITE.shippingBanner.replace("🚚 ", "")}</p>
          <a href={whatsappGeneral()} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-whatsapp">WhatsApp</a>
          <p className="mt-4 text-xs">© {new Date().getFullYear()} {SITE.name}</p>
        </div>
      </div>
    </footer>
  );
}
