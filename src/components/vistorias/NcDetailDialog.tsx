import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, XCircle, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EvidenceUpload } from './EvidenceUpload';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useUpdateNcStatus,
  useNcHistory,
  type NonConformity,
  type NcStatus,
} from '@/hooks/useInspections';
import { useUserRole } from '@/hooks/useUserRole';

const severityConfig: Record<string, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  critical: { label: 'Crítica', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const statusLabels: Record<NcStatus, string> = {
  open: 'Aberta',
  in_treatment: 'Em tratamento',
  pending_verification: 'Verificação',
  pending_approval: 'Aprovação',
  closed: 'Encerrada',
  reopened: 'Reaberta',
};

interface Props {
  nc: NonConformity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NcDetailDialog({ nc, open, onOpenChange }: Props) {
  const updateStatus = useUpdateNcStatus();
  const { data: history = [] } = useNcHistory(nc.id);
  const { hasRole } = useUserRole();
  const isAdminOrManager = hasRole('admin') || hasRole('manager');

  const [actionNotes, setActionNotes] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState(nc.corrective_action || '');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>(nc.evidence_photo_paths ?? []);

  const handleTransition = (newStatus: NcStatus) => {
    updateStatus.mutate({
      nc,
      new_status: newStatus,
      notes: actionNotes || undefined,
      corrective_action: newStatus === 'in_treatment' ? correctiveAction : undefined,
      resolution_notes: newStatus === 'pending_verification' ? actionNotes : undefined,
      evidence_photo_paths: evidencePhotos.length > 0 ? evidencePhotos : undefined,
    }, {
      onSuccess: () => {
        setActionNotes('');
        setCorrectiveAction('');
        onOpenChange(false);
      },
    });
  };

  const sev = severityConfig[nc.severity];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base sm:text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <span className="break-words">{nc.title}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Meta */}
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${sev.className}`}>
            {sev.label}
          </span>
          <Badge variant={nc.status === 'closed' ? 'secondary' : 'destructive'}>
            {statusLabels[nc.status]}
          </Badge>
          {nc.deadline && (
            <span className="text-xs text-muted-foreground flex items-center">
              Prazo: {format(parseISO(nc.deadline), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>

        {nc.description && (
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm break-words">{nc.description}</p>
          </div>
        )}

        {nc.corrective_action && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Ação corretiva</Label>
            <p className="text-sm bg-muted/50 rounded-lg p-3 break-words">{nc.corrective_action}</p>
          </div>
        )}

        {nc.resolution_notes && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Notas de resolução</Label>
            <p className="text-sm bg-muted/50 rounded-lg p-3 break-words">{nc.resolution_notes}</p>
          </div>
        )}

        {nc.rejection_reason && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase text-destructive">Motivo da rejeição</Label>
            <p className="text-sm bg-destructive/5 rounded-lg p-3 border border-destructive/20 break-words">{nc.rejection_reason}</p>
          </div>
        )}

        <Separator />

        {/* Actions based on current status */}
        {nc.status !== 'closed' && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Ações</Label>

            {/* open → in_treatment */}
            {(nc.status === 'open' || nc.status === 'reopened') && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Descreva a ação corretiva a ser tomada..."
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  rows={3}
                  className="min-h-[44px]"
                />
                <Button
                  className="gap-2 w-full sm:w-auto h-11 sm:h-10"
                  onClick={() => handleTransition('in_treatment')}
                  disabled={!correctiveAction.trim() || updateStatus.isPending}
                >
                  <ArrowRight className="h-4 w-4" />
                  Iniciar Tratamento
                </Button>
              </div>
            )}

            {/* in_treatment → pending_verification */}
            {nc.status === 'in_treatment' && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Descreva o que foi feito para resolver..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="min-h-[44px]"
                />
                <Button
                  className="gap-2 w-full sm:w-auto h-11 sm:h-10"
                  onClick={() => handleTransition('pending_verification')}
                  disabled={!actionNotes.trim() || updateStatus.isPending}
                >
                  <ArrowRight className="h-4 w-4" />
                  Enviar para Verificação
                </Button>
              </div>
            )}

            {/* pending_verification → pending_approval (any staff) */}
            {nc.status === 'pending_verification' && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Notas da verificação..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="min-h-[44px]"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    className="gap-2 h-11 sm:h-10 w-full sm:w-auto"
                    onClick={() => handleTransition('pending_approval')}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Verificação OK
                  </Button>
                  <Button
                    variant="destructive"
                    className="gap-2 h-11 sm:h-10 w-full sm:w-auto"
                    onClick={() => {
                      updateStatus.mutate({
                        nc,
                        new_status: 'reopened',
                        notes: actionNotes || undefined,
                        rejection_reason: actionNotes,
                      }, {
                        onSuccess: () => {
                          setActionNotes('');
                          onOpenChange(false);
                        },
                      });
                    }}
                    disabled={!actionNotes.trim() || updateStatus.isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reabrir
                  </Button>
                </div>
              </div>
            )}

            {/* pending_approval → closed (admin/manager only) */}
            {nc.status === 'pending_approval' && (
              <div className="space-y-3">
                {isAdminOrManager ? (
                  <>
                    <Textarea
                      placeholder="Notas finais (opcional)..."
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={3}
                      className="min-h-[44px]"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="gap-2 h-11 sm:h-10 w-full sm:w-auto"
                        onClick={() => handleTransition('closed')}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprovar e Encerrar
                      </Button>
                      <Button
                        variant="destructive"
                        className="gap-2 h-11 sm:h-10 w-full sm:w-auto"
                        onClick={() => {
                          if (!actionNotes.trim()) return;
                          updateStatus.mutate({
                            nc,
                            new_status: 'reopened',
                            notes: actionNotes,
                            rejection_reason: actionNotes,
                          }, {
                            onSuccess: () => {
                              setActionNotes('');
                              onOpenChange(false);
                            },
                          });
                        }}
                        disabled={!actionNotes.trim() || updateStatus.isPending}
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Aguardando aprovação de um administrador ou gerente.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <History className="h-4 w-4" />
                Histórico
              </Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {history.map((entry) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">
                      {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                    <div>
                      <span className="font-medium">{entry.action}</span>
                      {entry.notes && (
                        <p className="text-muted-foreground mt-0.5 break-words">{entry.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
