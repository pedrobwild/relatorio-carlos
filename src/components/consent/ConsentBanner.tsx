import { useEffect, useRef, useState } from "react";
import { Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/hooks/useConsent";
import { acceptAll, rejectAll } from "@/lib/consent";
import { ConsentSettingsDialog } from "./ConsentSettingsDialog";

/**
 * Banner de consentimento de telemetria.
 * Renderiza apenas se o usuário ainda não decidiu (`decidedAt === null`).
 *
 * Padrão LGPD-friendly: opção "Recusar" tem o mesmo peso visual de "Aceitar".
 */
export function ConsentBanner() {
  const consent = useConsent();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const visible = !consent.decidedAt;

  // Enquanto o aviso está na tela, publica a altura dele em
  // `--consent-banner-offset`. As páginas marcadas com `consent-safe`
  // reservam esse espaço no fim, para o aviso não cobrir campos nem botões.
  useEffect(() => {
    const el = regionRef.current;
    if (!visible || !el) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(
        "--consent-banner-offset",
        `${Math.ceil(el.getBoundingClientRect().height)}px`,
      );
      root.dataset.consentBanner = "true";
    };
    publish();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(publish)
        : null;
    observer?.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--consent-banner-offset");
      delete root.dataset.consentBanner;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        ref={regionRef}
        role="region"
        aria-label="Consentimento de privacidade"
        className="consent-banner fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pt-2 sm:px-6 sm:pb-6 pointer-events-none"
      >
        {/* Celular: altura máxima com rolagem só no texto explicativo (a
            pergunta e os botões ficam sempre visíveis). Desktop: cartão no
            canto direito, para não ficar sobre o conteúdo central. */}
        <div className="relative mx-auto flex max-h-[min(40dvh,18rem)] max-w-3xl pointer-events-auto rounded-lg border bg-background shadow-lg [@media(max-height:760px)]:max-h-[11rem] sm:mr-0 sm:max-h-none sm:max-w-xl [@media(max-height:760px)]:sm:max-h-none">
          <div className="flex min-h-0 w-full flex-col gap-3 p-4 sm:p-5">
            <div className="flex min-h-0 flex-1 gap-4">
              <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Shield className="h-4 w-4" aria-hidden />
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <p className="shrink-0 pr-8 text-sm font-medium sm:pr-0">
                  Podemos usar dados de uso para melhorar o produto?
                </p>
                <p
                  className="min-h-0 overflow-y-auto text-sm text-muted-foreground"
                  // Rolável em tela baixa: precisa receber foco pelo teclado.
                  tabIndex={0}
                >
                  Coletamos eventos anônimos de navegação e, opcionalmente,
                  gravações de sessão para entender pontos de fricção. Você pode
                  aceitar, recusar ou personalizar, e mudar de ideia depois.
                </p>
              </div>
            </div>
            {/* Celular: os três botões numa linha só, para o aviso ocupar menos
                da tela (ele cobria o formulário de login). */}
            <div className="grid shrink-0 grid-cols-3 gap-2 sm:flex sm:flex-row sm:items-center sm:justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="px-1"
                onClick={() => setSettingsOpen(true)}
              >
                Personalizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => rejectAll()}>
                Recusar
              </Button>
              <Button size="sm" onClick={() => acceptAll()}>
                Aceitar
              </Button>
            </div>
            <button
              type="button"
              aria-label="Fechar e recusar"
              onClick={() => rejectAll()}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ConsentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}

export default ConsentBanner;
