/**
 * CsTicketDialog — formulário de criação/edição de Ticket de CS.
 *
 * Utilizado tanto para "Novo ticket" quanto para "Editar ticket existente".
 * Quando `ticket` é informado, o diálogo entra em modo edição e mantém
 * `project_id` imutável (não faz sentido mover ticket entre obras).
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  CS_SEVERITY_OPTIONS,
  CS_STATUS_OPTIONS,
  type CsTicket,
  type CsTicketInput,
  type CsTicketSeverity,
  type CsTicketStatus,
  useCreateCsTicket,
  useUpdateCsTicket,
} from '@/hooks/useCsTickets';
import { useStaffUsers } from '@/hooks/useStaffUsers';
import { useProjectsQuery } from '@/hooks/useProjectsQuery';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileFullscreenSheet } from '@/components/mobile';

interface CsTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando informado, modo edição. */
  ticket?: CsTicket | null;
  /** Pré-seleciona uma obra (útil quando criado a partir de uma obra). */
  defaultProjectId?: string;
}

const NONE = '__none__';

export function CsTicketDialog({
  open,
  onOpenChange,
  ticket,
  defaultProjectId,
}: CsTicketDialogProps) {
  const isEdit = !!ticket;
  const isMobile = useIsMobile();
  const create = useCreateCsTicket();
  const update = useUpdateCsTicket();
  const { data: staff = [] } = useStaffUsers();
  const { data: projects = [], isLoading: loadingProjects } = useProjectsQuery();

  const [projectId, setProjectId] = useState<string>('');
  const [situation, setSituation] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<CsTicketSeverity>('media');
  const [status, setStatus] = useState<CsTicketStatus>('aberto');
  const [actionPlan, setActionPlan] = useState('');
  const [responsible, setResponsible] = useState<string>(NONE);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  // Modo de busca: 'tokens' (todas as palavras, em qualquer ordem) ou 'substring' (qualquer parte contígua)
  const [projectSearchMode, setProjectSearchMode] = useState<'tokens' | 'substring'>('tokens');

  const selectedProject = useMemo(
    () => (projects as any[]).find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  const projectLabel = (p: any) =>
    `${p?.name ?? ''}${p?.customer_name ? ` — ${p.customer_name}` : ''}`.trim();

  // Reset / hidrata estado ao abrir
  useEffect(() => {
    if (!open) return;
    if (ticket) {
      setProjectId(ticket.project_id);
      setSituation(ticket.situation);
      setDescription(ticket.description ?? '');
      setSeverity(ticket.severity);
      setStatus(ticket.status);
      setActionPlan(ticket.action_plan ?? '');
      setResponsible(ticket.responsible_user_id ?? NONE);
    } else {
      setProjectId(defaultProjectId ?? '');
      setSituation('');
      setDescription('');
      setSeverity('media');
      setStatus('aberto');
      setActionPlan('');
      setResponsible(NONE);
    }
  }, [open, ticket, defaultProjectId]);

  const isSaving = create.isPending || update.isPending;
  const canSubmit = projectId.trim().length > 0 && situation.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const responsibleId = responsible === NONE ? null : responsible;

    if (isEdit && ticket) {
      await update.mutateAsync({
        id: ticket.id,
        patch: {
          situation: situation.trim(),
          description: description.trim() || null,
          severity,
          status,
          action_plan: actionPlan.trim() || null,
          responsible_user_id: responsibleId,
        },
      });
    } else {
      const payload: CsTicketInput = {
        project_id: projectId,
        situation: situation.trim(),
        description: description.trim() || null,
        severity,
        status,
        action_plan: actionPlan.trim() || null,
        responsible_user_id: responsibleId,
      };
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const headerTitle = isEdit ? 'Editar ticket' : 'Novo ticket de CS';
  const headerDescription =
    'Registre a situação relatada, severidade e plano de ação. O cliente não tem visibilidade destes tickets.';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Criar ticket';

  // Campos compartilhados entre Dialog (desktop) e MobileFullscreenSheet
  // (mobile). No mobile a grid colapsa para 1 coluna naturalmente
  // (sem `md:` ativo) e o spacing/padding aumentam para tap-target.
  const fields = (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-4',
        isMobile ? 'px-4 py-4' : 'px-4 sm:px-6 py-2',
      )}
    >
      {/* Obra */}
      <div className="md:col-span-2 space-y-1.5">
        <Label htmlFor="cs-project">Obra / Cliente *</Label>
            <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  id="cs-project"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectPickerOpen}
                  disabled={isEdit || loadingProjects}
                  className={cn(
                    'w-full justify-between font-normal',
                    !selectedProject && 'text-muted-foreground',
                  )}
                >
                  <span className="truncate text-left">
                    {loadingProjects
                      ? 'Carregando obras…'
                      : selectedProject
                        ? projectLabel(selectedProject)
                        : 'Selecione uma obra'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)]"
                align="start"
              >
                <Command
                  // Recria o filtro quando o modo muda para reavaliar a lista
                  key={projectSearchMode}
                  filter={(value, search) => {
                    const normalize = (s: string) =>
                      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const haystack = normalize(value);
                    const needle = normalize(search.toLowerCase()).trim();
                    if (!needle) return 1;

                    if (projectSearchMode === 'substring') {
                      // Qualquer parte contígua do texto digitado
                      return haystack.includes(needle) ? 1 : 0;
                    }
                    // tokens: todas as palavras precisam aparecer (qualquer ordem)
                    const tokens = needle.split(/\s+/).filter(Boolean);
                    return tokens.every((t) => haystack.includes(t)) ? 1 : 0;
                  }}
                >
                  <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">
                        {projectSearchMode === 'tokens'
                          ? 'Todas as palavras'
                          : 'Qualquer parte do texto'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {projectSearchMode === 'tokens'
                          ? 'Ex.: "ricardo macedo" casa em qualquer ordem'
                          : 'Ex.: "ardo mac" casa por substring'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Substring</span>
                      <Switch
                        checked={projectSearchMode === 'tokens'}
                        onCheckedChange={(checked) =>
                          setProjectSearchMode(checked ? 'tokens' : 'substring')
                        }
                        aria-label="Alternar entre busca por palavras e por substring"
                      />
                    </div>
                  </div>
                  <CommandInput placeholder="Buscar obra ou cliente…" />
                  <CommandList>
                    <CommandEmpty>Nenhuma obra encontrada.</CommandEmpty>
                    <CommandGroup>
                      {(projects as any[]).map((p) => {
                        const label = projectLabel(p);
                        return (
                          <CommandItem
                            key={p.id}
                            value={label}
                            onSelect={() => {
                              setProjectId(p.id);
                              setProjectPickerOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                projectId === p.id ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Situação */}
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="cs-situation">Situação *</Label>
            <Input
              id="cs-situation"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="Ex.: Cliente reclamou de atraso na entrega da bancada"
              maxLength={200}
            />
          </div>

          {/* Severidade */}
          <div className="space-y-1.5">
            <Label htmlFor="cs-severity">Severidade *</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as CsTicketSeverity)}>
              <SelectTrigger id="cs-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {CS_SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="cs-status">Status *</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CsTicketStatus)}>
              <SelectTrigger id="cs-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {CS_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="cs-responsible">Responsável</Label>
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger id="cs-responsible">
                <SelectValue placeholder="Sem responsável" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[280px]">
                <SelectItem value={NONE}>— Sem responsável —</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="cs-description">Descrição</Label>
            <Textarea
              id="cs-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhe a ocorrência, contexto e impacto percebido."
              rows={4}
              maxLength={2000}
            />
          </div>

      {/* Plano de ação */}
      <div className="md:col-span-2 space-y-1.5">
        <Label htmlFor="cs-action">Plano de ação</Label>
        <Textarea
          id="cs-action"
          value={actionPlan}
          onChange={(e) => setActionPlan(e.target.value)}
          placeholder="Quais passos serão tomados, prazos e próximos contatos."
          rows={4}
          maxLength={2000}
        />
      </div>
    </div>
  );

  // ── Mobile: full-screen sheet com header sticky e ações primárias
  //    no rodapé sticky (pb-safe). Sem modal centralizado, sem
  //    truncamento de título.
  if (isMobile) {
    return (
      <MobileFullscreenSheet
        open={open}
        onOpenChange={onOpenChange}
        title={headerTitle}
        description={headerDescription}
        closeAriaLabel="Cancelar e voltar"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="h-11 flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isSaving}
              className="h-11 flex-[2]"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {submitLabel}
            </Button>
          </div>
        }
      >
        {fields}
      </MobileFullscreenSheet>
    );
  }

  // ── Desktop: dialog centralizado (preserva o comportamento original).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col gap-0 p-0 max-h-[calc(100dvh-4rem)] overflow-hidden">
        <DialogHeader className="shrink-0 p-4 sm:p-6 pb-2">
          <DialogTitle>{headerTitle}</DialogTitle>
          <DialogDescription>{headerDescription}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">
          {fields}
        </div>

        <DialogFooter className="shrink-0 p-4 sm:p-6 pt-2 border-t border-border bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
