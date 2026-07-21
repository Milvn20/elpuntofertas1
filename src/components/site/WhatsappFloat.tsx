import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { whatsappGeneral } from "@/lib/site";

export function WhatsappFloat() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const url = whatsappGeneral();
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) window.location.href = url;
  };

  return (
    <div
      className={`fixed bottom-4 right-4 z-[60] transition-all duration-500 md:bottom-6 md:right-6 ${
        mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-60 animate-ping" aria-hidden />
      <a
        href={whatsappGeneral()}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label="Abrir chat de WhatsApp"
        className="relative inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg shadow-black/20 ring-1 ring-black/5 transition-transform hover:scale-110 hover:shadow-xl"
      >
        <MessageCircle className="size-5" />
        <span className="hidden text-sm font-semibold sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}