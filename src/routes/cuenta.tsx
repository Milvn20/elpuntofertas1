import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { getCurrentSession } from "@/lib/auth/client";
import { useFirebaseBackend } from "@/lib/data/backend";
import { getFirebaseDb } from "@/integrations/firebase/client";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/cuenta")({
  head: () => ({ meta: [{ title: `Mi cuenta · ${SITE.name}` }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    getCurrentSession().then(async ({ user }) => {
      if (!user) {
        navigate({ to: "/auth" });
        return;
      }
      setUid(user.id);
      setEmail(user.email);
      setName(user.name ?? "");
      if (useFirebaseBackend()) {
        const snap = await getDoc(doc(getFirebaseDb(), "users", user.id));
        if (snap.exists()) {
          const data = snap.data();
          setName(String(data.name ?? user.name ?? ""));
          setPhone(String(data.phone ?? ""));
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [navigate]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !useFirebaseBackend()) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast.error("Escribe tu nombre.");
    setSaving(true);
    try {
      await updateDoc(doc(getFirebaseDb(), "users", uid), {
        name: trimmed,
        phone: phone.trim() || null,
        lastLoginAt: serverTimestamp(),
      });
      toast.success("Perfil actualizado");
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo guardar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-3xl font-extrabold tracking-tighter">Mi cuenta</h1>
        {loading ? <p className="mt-6 text-sm text-muted-foreground">Cargando…</p> : (
          <form onSubmit={save} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{email}</p>
            <label className="block text-sm">Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="block text-sm">Teléfono
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2" />
            </label>
            <button disabled={saving || !useFirebaseBackend()} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
            {!useFirebaseBackend() && <p className="text-sm text-muted-foreground">El perfil editable requiere Firebase.</p>}
            <Link to="/carrito" className="block text-sm font-semibold text-accent">Ir al carrito</Link>
          </form>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
