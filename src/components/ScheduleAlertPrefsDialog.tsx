/**
 * Diálogo de preferências de notificação dos Schedule Alerts.
 *
 * Permite ao usuário:
 *  - Ativar/desativar todas as notificações de alertas de cronograma
 *  - Escolher por canal: in-app (no portal), e-mail e push (navegador)
 *
 * Persistido em localStorage via useScheduleAlertPrefs.
 */
import { Bell, BellOff, Mail, Smartphone, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  useScheduleAlertPrefs,
  type ScheduleAlertChannel,
} from '@/hooks/useScheduleAlertPrefs';

interface ChannelRowProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
  badge?: string;
}

function ChannelRow({
  id,
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  badge,
}: ChannelRowProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-lg border border-border bg-card/40 p-3',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {title}
            {badge && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                {badge}
              </span>
            )}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

interface Props {
  trigger: React.ReactNode;
}

export function ScheduleAlertPrefsDialog({ trigger }: Props) {
  const { prefs, setEnabled, setChannel } = useScheduleAlertPrefs();

  const handleChannel = (channel: ScheduleAlertChannel) => (v: boolean) =>
    setChannel(channel, v);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {prefs.enabled ? (
              <Bell className="h-4 w-4 text-primary" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
            Notificações de cronograma
          </DialogTitle>
          <DialogDescription>
            Escolha como deseja ser avisado quando atividades estiverem com
            início ou término não sinalizados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="min-w-0">
              <Label htmlFor="alerts-enabled" className="text-sm font-medium cursor-pointer">
                Receber alertas de cronograma
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Desative para silenciar todos os canais.
              </p>
            </div>
            <Switch
              id="alerts-enabled"
              checked={prefs.enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <ChannelRow
              id="ch-inapp"
              icon={<Inbox className="h-4 w-4" />}
              title="No portal (in-app)"
              description="Badge na barra de ferramentas e painel de alertas."
              checked={prefs.channels.inApp}
              disabled={!prefs.enabled}
              onCheckedChange={handleChannel('inApp')}
            />
            <ChannelRow
              id="ch-email"
              icon={<Mail className="h-4 w-4" />}
              title="E-mail"
              description="Resumo diário enviado para o e-mail da sua conta."
              checked={prefs.channels.email}
              disabled={!prefs.enabled}
              onCheckedChange={handleChannel('email')}
              badge="Em breve"
            />
            <ChannelRow
              id="ch-push"
              icon={<Smartphone className="h-4 w-4" />}
              title="Push do navegador"
              description="Notificações nativas quando o portal estiver aberto."
              checked={prefs.channels.push}
              disabled={!prefs.enabled}
              onCheckedChange={handleChannel('push')}
              badge="Em breve"
            />
          </div>
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
