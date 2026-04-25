import { useState } from "react";
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

  if (consent.decidedAt) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Consentimento de privacidade"
        className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6 pointer-events-none"
      >
        <div className="mx-auto max-w-3xl pointer-events-auto rounded-lg border bg-background shadow-lg">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
            <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Shield className="h-4 w-4" aria-hidden />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">
                Podemos usar dados de uso para melhorar o produto?
              </p>
              <p className="text-sm text-muted-foreground">
                Coletamos eventos anônimos de navegação e, opcionalmente,
                gravações de sessão para entender pontos de fricção. Você pode
                aceitar, recusar ou personalizar — e mudar de ideia depois.
              </p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-2 sm:shrink-0">
              <Button
                variant="ghost"
                size="sm"
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
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"
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
