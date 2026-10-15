import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShieldUser, LogOut, Menu, X, ShoppingBag } from "lucide-react";
import { FaInstagram } from "react-icons/fa";
import { SITE, whatsappGeneral } from "@/lib/site";
import logo from "@/assets/elpuntofertas-logo.png";
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

  const pill = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition hover:border-foreground/40";

  return (
    <div className="sticky top-0 z-50">
      <div className="bg-foreground text-background">
        <p className="px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.18em]">
          {SITE.shippingBanner.replace("🚚 ", "")}
        </p>
      </div>
      <header className="border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={logo} alt="" className="size-10 rounded-full bg-black object-cover ring-1 ring-border" />
            <span className="text-lg font-extrabold tracking-tighter">elpuntofertas</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Principal">
            <Link to="/catalogo" className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">Catálogo</Link>
            <Link to="/" hash="categorias" className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground">Categorías</Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <form onSubmit={submit} className="relative hidden items-center md:flex" role="search">
            <Search className="absolute left-3 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" aria-label="Buscar producto" className="w-44 rounded-full bg-muted py-2 pl-9 pr-4 text-sm outline-none transition-all focus:w-64 focus:ring-1 focus:ring-accent" />
          </form>
          <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer" aria-label="Instagram" className="hidden rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground sm:inline-flex">
            <FaInstagram className="size-3.5" />
          </a>
          <Link to="/carrito" aria-label={`Carrito, ${cart.count} productos`} className={`${pill} relative`}>
            <ShoppingBag className="size-3.5" />
            <span className="hidden sm:inline">Carrito</span>
            {cart.count > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{cart.count}</span>}
          </Link>
          {signedIn ? (
            <>
              {isAdmin && (
                <Link to="/admin" className={`${pill} hidden sm:inline-flex`}>
                  <ShieldUser className="size-3.5" /> Admin
                </Link>
              )}
              {!isAdmin && <Link to="/cuenta" className={`${pill} hidden sm:inline-flex`}>Cuenta</Link>}
              <button onClick={logout} aria-label="Cerrar sesión" className={`${pill} hidden sm:inline-flex`}>
                <LogOut className="size-3.5" />
              </button>
            </>
          ) : (
            <Link to="/auth" className={`${pill} hidden sm:inline-flex`}>Cuenta</Link>
          )}
          <button type="button" className="rounded-full border border-border p-2 md:hidden" aria-expanded={open} aria-label={open ? "Cerrar menú" : "Abrir menú"} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
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
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-foreground text-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="size-10 rounded-full bg-black object-cover ring-1 ring-background/20" />
            <p className="text-lg font-extrabold tracking-tighter">elpuntofertas</p>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-background/75">
            Tienda de productos seleccionados con stock real: bicicletas, zapatillas, ropa, camas, tecnología y perfumes. Atención directa por WhatsApp.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-background/60">{SITE.city}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-background/60">{SITE.hours}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/50">Navegación</p>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link to="/catalogo" className="hover:text-accent">Catálogo</Link>
            <Link to="/" hash="categorias" className="hover:text-accent">Categorías</Link>
            <Link to="/carrito" className="hover:text-accent">Carrito</Link>
            <Link to="/contacto" className="hover:text-accent">Contacto</Link>
            <Link to="/ofertas" className="hover:text-accent">Ofertas</Link>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-background/50">Síguenos</p>
          <div className="mt-4 flex flex-col items-start gap-2">
            <a href={whatsappGeneral()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-2 text-sm font-semibold text-whatsapp-foreground">
              WhatsApp
            </a>
            <a href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-background/30 px-4 py-2 text-sm font-semibold">
              <FaInstagram className="size-3.5" /> Instagram
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-background/10 px-4 py-4 text-center font-mono text-[10px] uppercase tracking-widest text-background/50">
        © {new Date().getFullYear()} {SITE.name}
      </div>
    </footer>
  );
}
