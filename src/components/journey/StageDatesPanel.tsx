import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, X, Clock, CheckCircle2, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useStageDates,
  useCreateStageDate,
  useProposeStageDate,
  useConfirmStageDate,
  useStageDateEvents,
  type StageDate,
} from '@/hooks/useStageDates';

// ─── Inline Date Field (existing journey_stages columns) ───

interface StageDates {
  proposed_start: string | null;
  proposed_end: string | null;
  confirmed_start: string | null;
  confirmed_end: string | null;
}

function InlineDateField({
  label,
  value,
  icon: Icon,
  isConfirmed,
  onSelect,
  canEdit,
}: {
  label: string;
  value: string | null;
  icon: React.ElementType;
  isConfirmed?: boolean;
  onSelect: (date: Date | undefined) => void;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsedDate = value ? parseISO(value) : undefined;

  if (!canEdit) {
    return (
      <div className="flex items-center gap-2 min-h-[40px]">
        <Icon className={cn("h-4 w-4 shrink-0", isConfirmed ? "text-green-600" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-sm font-medium", isConfirmed ? "text-green-700" : "text-foreground")}>
            {parsedDate ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Em definição'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn(
          "flex items-center gap-2 min-h-[44px] w-full rounded-lg px-3 py-2 text-left transition-colors",
          "hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary",
          "border border-transparent hover:border-border"
        )}>
          <Icon className={cn("h-4 w-4 shrink-0", isConfirmed ? "text-green-600" : "text-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-sm font-medium", isConfirmed ? "text-green-700" : parsedDate ? "text-foreground" : "text-muted-foreground")}>
              {parsedDate ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
            </p>
          </div>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parsedDate}
          onSelect={(date) => { onSelect(date); setOpen(false); }}
          className="p-3 pointer-events-auto"
          locale={ptBR}
        />
        {parsedDate && (
          <div className="p-2 border-t">
            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive"
              onClick={() => { onSelect(undefined); setOpen(false); }}>
              <X className="h-4 w-4 mr-1" /> Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Granular Stage Date Row ───

function StageDateRow({
  sd,
  isAdmin,
  projectId,
}: {
  sd: StageDate;
  isAdmin: boolean;
  projectId: string;
}) {
  const [showPropose, setShowPropose] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [proposeDate, setProposeDate] = useState<Date | undefined>();
  const [confirmDate, setConfirmDate] = useState<Date | undefined>();
  const [showEvents, setShowEvents] = useState(false);

  const propose = useProposeStageDate(projectId);
  const confirm = useConfirmStageDate(projectId);
  const { data: events } = useStageDateEvents(showEvents ? sd.id : null);

  const typeLabels: Record<string, string> = {
    meeting: '📅 Reunião',
    deadline: '⏰ Prazo',
    start_planned: '🟢 Início',
    end_planned: '🔴 Término',
    milestone: '🏁 Marco',
  };

  return (
    <div className="p-3 rounded-lg border border-border/50 bg-background space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{sd.title}</p>
          <p className="text-xs text-muted-foreground">{typeLabels[sd.date_type] || sd.date_type}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
          onClick={() => setShowEvents(!showEvents)}>
          <History className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-1 sm:grid-cols-2">
        {/* Proposed */}
        <div className="flex items-center gap-2 min-h-[36px]">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Proposta</p>
            {sd.customer_proposed_at ? (
              <p className="text-sm font-medium">
                {format(parseISO(sd.customer_proposed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
          {!showPropose && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowPropose(true)}>
              Propor
            </Button>
          )}
        </div>

        {/* Confirmed */}
        <div className="flex items-center gap-2 min-h-[36px]">
          <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", sd.bwild_confirmed_at ? "text-green-600" : "text-muted-foreground")} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">Confirmada</p>
            {sd.bwild_confirmed_at ? (
              <p className="text-sm font-medium text-green-700">
                {format(parseISO(sd.bwild_confirmed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
          {isAdmin && !showConfirm && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowConfirm(true)}>
              Confirmar
            </Button>
          )}
        </div>
      </div>

      {/* Propose form */}
      {showPropose && (
        <div className="flex items-center gap-2 pt-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {proposeDate ? format(proposeDate, "dd/MM/yyyy") : "Escolher data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={proposeDate} onSelect={setProposeDate}
                className="p-3 pointer-events-auto" locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-8" disabled={!proposeDate || propose.isPending}
            onClick={() => {
              if (!proposeDate) return;
              propose.mutate({ stage_date_id: sd.id, datetime: proposeDate.toISOString() });
              setShowPropose(false);
            }}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowPropose(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Confirm form (admin) */}
      {showConfirm && isAdmin && (
        <div className="flex items-center gap-2 pt-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs flex-1">
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {confirmDate ? format(confirmDate, "dd/MM/yyyy") : "Escolher data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={confirmDate} onSelect={setConfirmDate}
                className="p-3 pointer-events-auto" locale={ptBR} />
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-8" disabled={!confirmDate || confirm.isPending}
            onClick={() => {
              if (!confirmDate) return;
              confirm.mutate({ stage_date_id: sd.id, datetime: confirmDate.toISOString() });
              setShowConfirm(false);
            }}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowConfirm(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Notes */}
      {sd.notes && <p className="text-xs text-muted-foreground italic px-1">{sd.notes}</p>}

      {/* Event log */}
      {showEvents && events && events.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Histórico</p>
          {events.map((ev) => (
            <div key={ev.id} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{format(parseISO(ev.created_at), "dd/MM HH:mm")}</span>
              <span className="font-medium">{ev.action}</span>
              <span>por {ev.actor_role}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create New Stage Date Form ───

function CreateStageDateForm({
  projectId,
  stageKey,
  onClose,
}: {
  projectId: string;
  stageKey: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [dateType, setDateType] = useState<StageDate['date_type']>('meeting');
  const create = useCreateStageDate(projectId);

  return (
    <div className="p-3 rounded-lg border border-dashed border-border bg-muted/20 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Nova data</p>
      <Input placeholder="Título (ex: Reunião de briefing)" value={title}
        onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
      <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={dateType} onChange={(e) => setDateType(e.target.value as StageDate['date_type'])}>
        <option value="meeting">Reunião</option>
        <option value="deadline">Prazo</option>
        <option value="start_planned">Início planejado</option>
        <option value="end_planned">Término planejado</option>
        <option value="milestone">Marco</option>
      </select>
      <div className="flex gap-2">
        <Button size="sm" className="h-8" disabled={!title.trim() || create.isPending}
          onClick={() => { create.mutate({ stage_key: stageKey, date_type: dateType, title: title.trim() }); onClose(); }}>
          Criar
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Main Panel ───

interface StageDatesPanelProps {
  stageId: string;
  projectId: string;
  dates: StageDates;
  isAdmin: boolean;
  stageName: string;
}

export function StageDatesPanel({ stageId, projectId, dates, isAdmin, stageName }: StageDatesPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Derive a stable stage_key from stageName
  const stageKey = stageName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  const { data: granularDates = [] } = useStageDates(projectId, stageKey);

  // Inline date handler (existing journey_stages columns)
  const handleDateChange = async (fieldName: keyof StageDates, newDate: Date | undefined) => {
    const oldValue = dates[fieldName];
    const newValue = newDate ? format(newDate, 'yyyy-MM-dd') : null;
    if (oldValue === newValue) return;

    try {
      const { error: updateError } = await supabase
        .from('journey_stages')
        .update({ [fieldName]: newValue })
        .eq('id', stageId);
      if (updateError) throw updateError;

      await supabase.from('journey_stage_date_log').insert({
        stage_id: stageId,
        project_id: projectId,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        changed_by: user?.id || null,
      });

      queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
      toast.success('Data atualizada');
    } catch {
      toast.error('Erro ao atualizar data');
    }
  };

  const hasAnyDate = dates.proposed_start || dates.proposed_end || dates.confirmed_start || dates.confirmed_end;
  const canEditProposed = true;
  const canEditConfirmed = isAdmin;

  if (!isAdmin && !hasAnyDate && granularDates.length === 0) return null;

  return (
    <div className="space-y-3 p-3 md:p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Datas da Etapa</h4>
        </div>
        {!showCreate && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova data
          </Button>
        )}
      </div>

      {/* Inline dates (legacy columns) */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            Proposta do cliente
          </p>
          <InlineDateField label="Início proposto" value={dates.proposed_start} icon={Clock}
            onSelect={(d) => handleDateChange('proposed_start', d)} canEdit={canEditProposed} />
          <InlineDateField label="Término proposto" value={dates.proposed_end} icon={Clock}
            onSelect={(d) => handleDateChange('proposed_end', d)} canEdit={canEditProposed} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            Confirmada pela Bwild
          </p>
          <InlineDateField label="Início confirmado" value={dates.confirmed_start} icon={CheckCircle2}
            isConfirmed={!!dates.confirmed_start}
            onSelect={(d) => handleDateChange('confirmed_start', d)} canEdit={canEditConfirmed} />
          <InlineDateField label="Término confirmado" value={dates.confirmed_end} icon={CheckCircle2}
            isConfirmed={!!dates.confirmed_end}
            onSelect={(d) => handleDateChange('confirmed_end', d)} canEdit={canEditConfirmed} />
        </div>
      </div>

      {/* Granular dates from stage_dates table */}
      {granularDates.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
            Datas detalhadas
          </p>
          {granularDates.map((sd) => (
            <StageDateRow key={sd.id} sd={sd} isAdmin={isAdmin} projectId={projectId} />
          ))}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <CreateStageDateForm projectId={projectId} stageKey={stageKey} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
