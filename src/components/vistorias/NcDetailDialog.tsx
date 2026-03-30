import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, XCircle, History, Pencil, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EvidenceUpload } from './EvidenceUpload';
import { NcPurchaseLink } from './NcPurchaseLink';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useUpdateNcStatus,
  useUpdateNonConformity,
  useNcHistory,
  type NonConformity,
  type NcStatus,
  type NcSeverity,
} from '@/hooks/useNonConformities';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { NC_CATEGORIES, ROOT_CAUSES } from './ncConstants';

const severityOptions: { value: NcSeverity; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'critical', label: 'Crítica' },
];

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
  const updateNc = useUpdateNonConformity();
  const { data: history = [] } = useNcHistory(nc.id);
  const { can } = useCan();
  const canApproveNc = can('ncs:approve');
  const canEdit = can('ncs:treat');

  const isEditable = canEdit && (nc.status === 'open' || nc.status === 'reopened');

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(nc.title);
  const [editDescription, setEditDescription] = useState(nc.description || '');
  const [editSeverity, setEditSeverity] = useState<NcSeverity>(nc.severity);
  const [editCategory, setEditCategory] = useState<string>((nc as any).category || '');
  const [editDeadline, setEditDeadline] = useState<Date | undefined>(nc.deadline ? parseISO(nc.deadline) : undefined);

  const [actionNotes, setActionNotes] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState(nc.corrective_action || '');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>(nc.evidence_photo_paths ?? []);
  const [rootCause, setRootCause] = useState<string>((nc as any).root_cause || '');

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    updateNc.mutate({
      id: nc.id,
      project_id: nc.project_id,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      severity: editSeverity,
      category: editCategory || undefined,
      deadline: editDeadline ? format(editDeadline, 'yyyy-MM-dd') : null,
    }, {
      onSuccess: () => setEditing(false),
    });
  };

  const handleTransition = (newStatus: NcStatus) => {
    // For closing, save root_cause first
    if (newStatus === 'closed' && rootCause) {
      updateNc.mutate({
        id: nc.id,
        project_id: nc.project_id,
        root_cause: rootCause,
      });
    }

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
        setRootCause('');
        onOpenChange(false);
      },
    });
  };

  const sev = severityConfig[nc.severity];
  const ncCategory = (nc as any).category as string | undefined;
  const ncRootCause = (nc as any).root_cause as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base sm:text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <span className="break-words flex-1">{nc.title}</span>
            {isEditable && !editing && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Edit mode */}
        {editing && (
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Título</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Categoria</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                    {NC_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Severidade</Label>
                <Select value={editSeverity} onValueChange={(v) => setEditSeverity(v as NcSeverity)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                    {severityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn('w-full h-10 justify-start text-left font-normal text-xs', !editDeadline && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {editDeadline ? format(editDeadline, "dd/MM/yyyy", { locale: ptBR }) : 'Sem prazo'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar mode="single" selected={editDeadline} onSelect={setEditDeadline} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="h-9">Cancelar</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={!editTitle.trim() || updateNc.isPending} className="h-9">
                {updateNc.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        )}

        {/* Meta */}
        {!editing && (
          <>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-semibold px-2 py-1 rounded ${sev.className}`}>
                {sev.label}
              </span>
              {ncCategory && (
                <Badge variant="outline" className="text-xs">
                  {ncCategory}
                </Badge>
              )}
              <Badge variant={nc.status === 'closed' ? 'secondary' : 'destructive'}>
                {statusLabels[nc.status]}
              </Badge>
              {nc.reopen_count > 0 && (
                <Badge
                  variant={nc.reopen_count >= 3 ? 'destructive' : 'outline'}
                  className="gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reaberta {nc.reopen_count}x
                </Badge>
              )}
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
          </>
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

        {ncRootCause && nc.status === 'closed' && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Causa raiz</Label>
            <p className="text-sm bg-muted/50 rounded-lg p-3">{ncRootCause}</p>
          </div>
        )}

        {/* Evidence photos */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase text-muted-foreground">Fotos de evidência</Label>
          <EvidenceUpload
            projectId={nc.project_id}
            entityId={nc.id}
            value={evidencePhotos}
            onChange={setEvidencePhotos}
            disabled={nc.status === 'closed'}
          />
        </div>

        {/* Purchase link for critical/high NCs */}
        <NcPurchaseLink nc={nc} />

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
                {canApproveNc ? (
                  <>
                    <Textarea
                      placeholder="Notas finais (opcional)..."
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      rows={3}
                      className="min-h-[44px]"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">
                        Causa Raiz <span className="text-destructive">*</span>
                      </Label>
                      <Select value={rootCause} onValueChange={setRootCause}>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecionar causa raiz..." />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[9999]" sideOffset={4}>
                          {ROOT_CAUSES.map((cause) => (
                            <SelectItem key={cause} value={cause} className="min-h-[44px]">
                              {cause}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        className="gap-2 h-11 sm:h-10 w-full sm:w-auto"
                        onClick={() => handleTransition('closed')}
                        disabled={!rootCause || updateStatus.isPending}
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
