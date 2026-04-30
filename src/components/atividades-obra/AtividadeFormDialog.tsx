import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ObraTaskInput, ObraTask, ObraTaskPriority } from '@/hooks/useObraTasks';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useDialogDraft } from '@/hooks/useDialogDraft';
import { AutosaveIndicator } from '@/components/ui/AutosaveIndicator';
import { toast } from 'sonner';
import { trackAmplitude } from '@/lib/amplitude';
import { formatCurrencyBRL, parseCurrencyBRL } from '@/lib/currencyMask';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ObraTaskInput) => void;
  initialData?: ObraTask | null;
  /**
   * Optional scope to differentiate drafts across pages/projects (e.g. projectId).
   * Falls back to "global" when not provided.
   */
  draftScope?: string;
}

const TITLE_MAX = 120;

const priorities: {
  value: ObraTaskPriority;
  label: string;
  dot: string;
}[] = [
  { value: 'baixa', label: 'Baixa', dot: 'bg-muted-foreground/60' },
  { value: 'media', label: 'Média', dot: 'bg-info' },
  { value: 'alta', label: 'Alta', dot: 'bg-warning' },
  { value: 'critica', label: 'Crítica', dot: 'bg-destructive' },
];

interface AtividadeDraft {
  title: string;
  description: string;
  responsibleUserId: string;
  dueDate: string;
  startDate: string;
  cost: string;
  priority: ObraTaskPriority;
}

export function AtividadeFormDialog({ open, onOpenChange, onSubmit, initialData, draftScope }: Props) {
  const { data: staffUsers = [] } = useStaffUsers();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [responsibleUserId, setResponsibleUserId] = useState(initialData?.responsible_user_id || 'none');
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [startDate, setStartDate] = useState(initialData?.start_date || '');
  const [cost, setCost] = useState(
    initialData?.cost != null ? formatCurrencyBRL(String(Math.round(initialData.cost * 100))) : ''
  );
  const [priority, setPriority] = useState<ObraTaskPriority>(initialData?.priority || 'media');

  // Autosave draft (per scope + new/editing target)
  const draftKey = `atividade-${draftScope || 'global'}-${initialData?.id || 'new'}`;
  const { restored, clearDraft, lastSavedAt } = useDialogDraft<AtividadeDraft>({
    key: draftKey,
    enabled: open,
    values: { title, description, responsibleUserId, dueDate, startDate, cost, priority },
    isDirty: (v) =>
      !!(v.title.trim() || v.description.trim() || (v.responsibleUserId && v.responsibleUserId !== 'none') || v.dueDate || v.startDate || v.cost),
    onRestore: (draft) => {
      if (draft.title !== undefined) setTitle(draft.title);
      if (draft.description !== undefined) setDescription(draft.description);
      if (draft.responsibleUserId !== undefined) setResponsibleUserId(draft.responsibleUserId || 'none');
      if (draft.dueDate !== undefined) setDueDate(draft.dueDate);
      if (draft.startDate !== undefined) setStartDate(draft.startDate);
      if (draft.cost !== undefined) setCost(draft.cost);
      if (draft.priority !== undefined) setPriority(draft.priority);
    },
  });

  // Notify the user once when a draft is restored
  useEffect(() => {
    if (restored) {
      toast.info('Rascunho restaurado', {
        description: 'Recuperamos as informações que você havia preenchido.',
        duration: 4000,
      });
    }
  }, [restored]);

  const trimmedTitle = title.trim();
  const titleTooLong = trimmedTitle.length > TITLE_MAX;
  const dateRangeInvalid = !!(startDate && dueDate && dueDate < startDate);
  const isValid = !!trimmedTitle && !titleTooLong && !dateRangeInvalid;

  const disabledReason = useMemo(() => {
    if (!trimmedTitle) return 'Informe o título da atividade.';
    if (titleTooLong) return `Título excede ${TITLE_MAX} caracteres.`;
    if (dateRangeInvalid) return 'O prazo não pode ser anterior à data de início.';
    return '';
  }, [trimmedTitle, titleTooLong, dateRangeInvalid]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    const isEdit = !!initialData?.id;
    const numericCost = cost ? parseFloat(parseCurrencyBRL(cost)) : NaN;
    onSubmit({
      title: trimmedTitle,
      description: description.trim() || null,
      responsible_user_id: responsibleUserId && responsibleUserId !== 'none' ? responsibleUserId : null,
      due_date: dueDate || null,
      start_date: startDate || null,
      cost: Number.isFinite(numericCost) ? numericCost : null,
      priority,
    });
    trackAmplitude('Activity Saved', {
      mode: isEdit ? 'update' : 'create',
      activity_id: initialData?.id ?? null,
      project_scope: draftScope ?? null,
      priority,
      has_responsible: !!(responsibleUserId && responsibleUserId !== 'none'),
      has_due_date: !!dueDate,
    });
    clearDraft();
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setResponsibleUserId('none');
    setDueDate('');
    setStartDate('');
    setCost('');
    setPriority('media');
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setResponsibleUserId(initialData.responsible_user_id || 'none');
      setDueDate(initialData.due_date || '');
      setStartDate(initialData.start_date || '');
      setCost(
        initialData.cost != null
          ? formatCurrencyBRL(String(Math.round(initialData.cost * 100)))
          : ''
      );
      setPriority(initialData.priority || 'media');
    } else if (!isOpen) {
      // Keep the draft on close (so accidental close doesn't lose data).
      // Only reset the local UI state.
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const titleCount = title.length;
  const titleCounterClass = cn(
    'text-[11px] tabular-nums',
    titleTooLong ? 'text-destructive' : titleCount > TITLE_MAX * 0.85 ? 'text-warning' : 'text-muted-foreground',
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[92dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border-subtle">
          <DialogTitle className="text-base">
            {initialData ? 'Editar atividade' : 'Nova atividade'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {initialData
              ? 'Atualize as informações da atividade.'
              : 'Cadastre uma tarefa interna da equipe para esta obra.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Título */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="title" className="text-xs font-medium">
                  Título <span className="text-destructive">*</span>
                </Label>
                <span className={titleCounterClass}>
                  {titleCount}/{TITLE_MAX}
                </span>
              </div>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX + 20))}
                placeholder="Ex.: Comprar material elétrico"
                required
                maxLength={TITLE_MAX + 20}
                aria-invalid={titleTooLong || undefined}
                autoFocus
              />
              {titleTooLong && (
                <p className="text-[11px] text-destructive">
                  Reduza para até {TITLE_MAX} caracteres.
                </p>
              )}
            </div>

            {/* Responsável + Prioridade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="responsible" className="text-xs font-medium">
                  Responsável
                </Label>
                <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                  <SelectTrigger id="responsible">
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Sem responsável</span>
                    </SelectItem>
                    {staffUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="truncate">
                          {u.nome}
                          <span className="text-muted-foreground text-xs ml-1">
                            · {u.perfil}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority" className="text-xs font-medium">
                  Prioridade
                </Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as ObraTaskPriority)}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {priorities.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={cn('inline-block h-2 w-2 rounded-full', p.dot)}
                          />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Datas */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date" className="text-xs font-medium">
                    Data de início
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    max={dueDate || undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due_date" className="text-xs font-medium">
                    Prazo
                  </Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={startDate || undefined}
                    aria-invalid={dateRangeInvalid || undefined}
                  />
                </div>
              </div>
              {dateRangeInvalid && (
                <p className="text-[11px] text-destructive">
                  O prazo não pode ser anterior à data de início.
                </p>
              )}
            </div>

            {/* Custo */}
            <div className="space-y-1.5">
              <Label htmlFor="cost" className="text-xs font-medium">
                Custo estimado
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  R$
                </span>
                <Input
                  id="cost"
                  type="text"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(formatCurrencyBRL(e.target.value))}
                  placeholder="0,00"
                  className="pl-9 tabular-nums"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-xs font-medium">
                Descrição
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes, contexto ou instruções para quem for executar."
                rows={3}
                className="resize-y"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border-subtle bg-muted/30 px-5 py-3 gap-2 sm:justify-between">
            <AutosaveIndicator
              lastSavedAt={lastSavedAt}
              className="self-center text-[11px]"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* span wrapper so disabled button still triggers tooltip */}
                    <span tabIndex={isValid ? -1 : 0}>
                      <Button type="submit" disabled={!isValid}>
                        {initialData ? 'Salvar alterações' : 'Criar atividade'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {!isValid && disabledReason && (
                    <TooltipContent side="top">{disabledReason}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
