/**
 * Diálogo de preferências dos alertas de cronograma.
 *
 * Mantém a interface focada no que de fato funciona hoje: controlar o
 * indicador (badge) global na sidebar. Notificações por e-mail/push vivem
 * fora deste módulo (sistema central de notificações).
 */
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useScheduleAlertPrefs } from "@/hooks/useScheduleAlertPrefs";

interface Props {
  trigger: React.ReactNode;
}

export function ScheduleAlertPrefsDialog({ trigger }: Props) {
  const { prefs, setShowBadge } = useScheduleAlertPrefs();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {prefs.showBadge ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            Indicador de alertas
          </DialogTitle>
          <DialogDescription>
            Controle como o portal sinaliza atividades com início ou término
            não registrados dentro do prazo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="min-w-0 pr-3">
            <Label
              htmlFor="alerts-show-badge"
              className="text-sm font-medium cursor-pointer"
            >
              Mostrar badge na barra lateral
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exibe um contador discreto ao lado do menu “Alertas de
              Cronograma”. Desative para ocultar sem perder o módulo.
            </p>
          </div>
          <Switch
            id="alerts-show-badge"
            checked={prefs.showBadge}
            onCheckedChange={setShowBadge}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
