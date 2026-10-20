import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site/header";
import { formatCLP, SITE, whatsappGeneral } from "@/lib/site";
import { useCommerceSettings } from "@/lib/commerce/context";

export const Route = createFileRoute("/contacto")({
  head: () => ({
    meta: [
      { title: `Contacto · ${SITE.name}` },
      { name: "description", content: `Contacta a ${SITE.name} por WhatsApp. ${SITE.city}. ${SITE.hours}.` },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const commerce = useCommerceSettings();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tighter">Contacto</h1>
        <p className="mt-3 text-muted-foreground">Puedes pagar con Mercado Pago desde el carrito o escribirnos por WhatsApp para coordinar la compra.</p>
        <dl className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Ciudad</dt>
            <dd className="text-lg font-semibold">{SITE.city}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Horario publicado</dt>
            <dd className="text-lg font-semibold">{SITE.hours}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">WhatsApp</dt>
            <dd><a className="font-semibold text-whatsapp" href={whatsappGeneral()} target="_blank" rel="noreferrer">+{SITE.whatsapp}</a></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Instagram</dt>
            <dd><a className="font-semibold" href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer">@{SITE.instagram}</a></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-muted-foreground">Despacho</dt>
            <dd>Despacho gratis en compras sobre {formatCLP(commerce.freeShippingMinClp)}. Bajo ese monto el despacho cuesta {formatCLP(commerce.baseShippingClp)}.</dd>
          </div>
        </dl>
      </main>
      <SiteFooter />
    </div>
  );
}
