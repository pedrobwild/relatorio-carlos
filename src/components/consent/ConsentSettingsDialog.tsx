import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useConsent } from "@/hooks/useConsent";
import { setConsent } from "@/lib/consent";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog de preferências de privacidade.
 * Permite consent granular por categoria. Pode ser aberto pelo banner
 * ("Personalizar") ou por uma página de configurações de conta.
 */
export function ConsentSettingsDialog({ open, onOpenChange }: Props) {
  const current = useConsent();
  const [analytics, setAnalytics] = useState(current.analytics);
  const [sessionReplay, setSessionReplay] = useState(current.sessionReplay);

  // Sincroniza ao reabrir.
  useEffect(() => {
    if (open) {
      setAnalytics(current.analytics);
      setSessionReplay(current.sessionReplay);
    }
  }, [open, current.analytics, current.sessionReplay]);

  // Session replay depende de analytics.
  useEffect(() => {
    if (!analytics && sessionReplay) setSessionReplay(false);
  }, [analytics, sessionReplay]);

  const handleSave = () => {
    setConsent({ analytics, sessionReplay });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Preferências de privacidade</DialogTitle>
          <DialogDescription>
            Escolha quais dados de uso podemos coletar. Sua decisão fica salva
            neste navegador e pode ser alterada a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="consent-analytics"
                className="text-sm font-medium"
              >
                Analytics de uso
              </Label>
              <p className="text-xs text-muted-foreground">
                Eventos anônimos de navegação (cliques, páginas visitadas) para
                priorizar melhorias.
              </p>
            </div>
            <Switch
              id="consent-analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="consent-replay"
                className="text-sm font-medium data-[disabled=true]:text-muted-foreground"
                data-disabled={!analytics}
              >
                Gravação de sessão
              </Label>
              <p className="text-xs text-muted-foreground">
                Reproduz interações na tela (sem dados sensíveis) para entender
                fluxos com problemas. Requer Analytics ativo.
              </p>
            </div>
            <Switch
              id="consent-replay"
              checked={sessionReplay}
              disabled={!analytics}
              onCheckedChange={setSessionReplay}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar preferências</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConsentSettingsDialog;
