import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

/**
 * VitrineCta — CTA comercial flutuante, exibido SOMENTE quando a sessão foi
 * aberta pela vitrine da placa de obra (rota /vitrine/:projectId, que seta a
 * flag `bw_vitrine_cta`). No fluxo normal do demo/orçamento a flag nunca é
 * setada, então este componente não renderiza nada e não interfere no demo.
 * Fica montado no ProjectPage, acompanhando a navegação pelo portal.
 */
const SALES_WHATSAPP = "5511911906183";
const SALES_MESSAGE =
  "Olá! Vi o portal de acompanhamento da Bewild e quero um orçamento pro meu studio.";

function isActive() {
  try {
    return (
      sessionStorage.getItem("bw_vitrine_cta") === "1" &&
      sessionStorage.getItem("bw_vitrine_cta_dismissed") !== "1"
    );
  } catch {
    return false;
  }
}

export function VitrineCta() {
  const [visible, setVisible] = useState(isActive);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem("bw_vitrine_cta_dismissed", "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const openWhats = () => {
    const url = `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(SALES_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    // `bottom-cta`: no celular fica acima da barra inferior (antes ficava por
    // cima dela). O espaçador reserva o fim da página para o cartão.
    <>
      <div className="h-24" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-cta z-50 flex justify-center px-3 pb-3 md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] pointer-events-none">
        <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground leading-tight">
              Gostou do que viu?
            </p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">
              Fale com a Bewild e faça o seu.
            </p>
          </div>
          <button
            type="button"
            onClick={openWhats}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity shrink-0"
          >
            <MessageCircle className="h-4 w-4" />
            Falar no WhatsApp
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="flex h-11 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
