import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon, Check, X, Clock, CheckCircle2, Plus, History,
  AlertTriangle, Calendar as CalendarIconSolid, Sparkles, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
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
  type StageDateEvent,
} from '@/hooks/useStageDates';

// ─── Types ───

interface StageDates {
  proposed_start: string | null;
  proposed_end: string | null;
  confirmed_start: string | null;
  confirmed_end: string | null;
}

// ─── Time Picker Helper ───

function TimePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-[120px] text-sm font-mono"
      aria-label="Horário"
      disabled={disabled}
    />
  );
}

// ─── Date + Time Picker Combo ───

function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  label,
  disabled,
  disablePastDates,
}: {
  date: Date | undefined;
  time: string;
  onDateChange: (d: Date | undefined) => void;
  onTimeChange: (t: string) => void;
  label: string;
  disabled?: boolean;
  disablePastDates?: boolean;
}) {
  return (
    <fieldset className="flex items-center gap-2 flex-wrap" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(
            "h-11 text-xs flex-1 min-w-[140px] justify-start",
            !date && "text-muted-foreground"
          )} disabled={disabled} aria-label="Selecionar data">
            <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            {date ? format(date, "dd/MM/yyyy") : label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            disabled={disablePastDates ? (d) => d < new Date(new Date().setHours(0, 0, 0, 0)) : undefined}
            className="p-3 pointer-events-auto"
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
      <TimePicker value={time} onChange={onTimeChange} disabled={disabled} />
    </fieldset>
  );
}

// ─── Status helpers ───

type DateStatus = 'confirmed' | 'proposed' | 'empty';

function getDateStatus(sd: StageDate): DateStatus {
  if (sd.bwild_confirmed_at) return 'confirmed';
  if (sd.customer_proposed_at) return 'proposed';
  return 'empty';
}

const statusConfig: Record<DateStatus, { label: string; badgeClass: string; icon: React.ElementType }> = {
  confirmed: {
    label: 'Confirmada pela Bwild',
    badgeClass: 'bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]',
    icon: CheckCircle2,
  },
  proposed: {
    label: 'Proposta pelo cliente',
    badgeClass: 'bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]',
    icon: Clock,
  },
  empty: {
    label: 'Sem data',
    badgeClass: 'bg-muted text-muted-foreground border-border/50',
    icon: CalendarIcon,
  },
};

const typeLabels: Record<string, { emoji: string; label: string }> = {
  meeting: { emoji: '📅', label: 'Reunião' },
  deadline: { emoji: '⏰', label: 'Prazo' },
  start_planned: { emoji: '🟢', label: 'Início planejado' },
  end_planned: { emoji: '🔴', label: 'Término planejado' },
  milestone: { emoji: '🏁', label: 'Marco' },
};

function buildISO(date: Date, time: string): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

// ─── Divergence Warning ───

function DivergenceWarning({ proposed, confirmed }: { proposed: string; confirmed: string }) {
  const pDate = parseISO(proposed);
  const cDate = parseISO(confirmed);
  const diffMs = Math.abs(cDate.getTime() - pDate.getTime());
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-[hsl(var(--warning-light))] border border-[hsl(var(--warning)/0.15)]" role="alert">
      <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0 mt-0.5" aria-hidden />
      <p className="text-xs text-[hsl(var(--warning))]">
        A data confirmada difere da proposta em <span className="font-semibold">{diffDays} dia{diffDays > 1 ? 's' : ''}</span>.
        Em caso de dúvida, entre em contato com sua CSM.
      </p>
    </div>
  );
}

// ─── History Drawer ───

const actionLabels: Record<string, string> = {
  proposed: 'Sugeriu data',
  confirmed: 'Confirmou data',
  adjusted: 'Ajustou data',
  created: 'Criou registro',
};

const roleLabels: Record<string, string> = {
  customer: 'Cliente',
  staff: 'Bwild',
  admin: 'Bwild',
};

function DateHistoryDrawer({
  open,
  onOpenChange,
  title,
  events,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  events: StageDateEvent[] | undefined;
  isLoading: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden />
            Histórico de alterações
          </DrawerTitle>
          <DrawerDescription className="text-xs">{title}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 py-4" aria-busy="true" aria-label="Carregando histórico">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : events && events.length > 0 ? (
            <ol className="relative pl-5 space-y-0 list-none" aria-label="Histórico de alterações">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />

              {events.map((ev, idx) => {
                const isFirst = idx === 0;
                const roleLabel = roleLabels[ev.actor_role] || ev.actor_role;
                const actionLabel = actionLabels[ev.action] || ev.action;

                return (
                  <li key={ev.id} className="relative flex gap-3 py-3">
                    {/* Dot */}
                    <div className={cn(
                      "absolute -left-5 top-[18px] h-3.5 w-3.5 rounded-full border-2 border-background shrink-0",
                      isFirst ? "bg-primary" : "bg-muted-foreground/30"
                    )} aria-hidden />

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-5 px-2 font-medium",
                            ev.actor_role === 'customer'
                              ? "bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)]"
                              : "bg-[hsl(var(--success-light))] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)]"
                          )}
                        >
                          {roleLabel}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">{actionLabel}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                        {format(parseISO(ev.created_at), "dd 'de' MMM, yyyy · HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="text-center py-8 space-y-2">
              <History className="h-8 w-8 text-muted-foreground/30 mx-auto" aria-hidden />
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada</p>
              <p className="text-xs text-muted-foreground/60">O histórico aparecerá aqui conforme as datas forem atualizadas.</p>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Stage Date Row (Granular) ───

function StageDateRow({
  sd,
  isStaff,
  projectId,
}: {
  sd: StageDate;
  isStaff: boolean;
  projectId: string;
}) {
  const [mode, setMode] = useState<'idle' | 'propose' | 'confirm'>('idle');
  const [pickerDate, setPickerDate] = useState<Date | undefined>();
  const [pickerTime, setPickerTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const propose = useProposeStageDate(projectId);
  const confirm = useConfirmStageDate(projectId);
  const { data: events, isLoading: eventsLoading } = useStageDateEvents(showHistory ? sd.id : null);

  const status = getDateStatus(sd);
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;
  const tl = typeLabels[sd.date_type] || { emoji: '📌', label: sd.date_type };

  const hasDivergence =
    sd.customer_proposed_at &&
    sd.bwild_confirmed_at &&
    sd.customer_proposed_at !== sd.bwild_confirmed_at;

  const handleSubmit = () => {
    if (!pickerDate) return;
    const iso = buildISO(pickerDate, pickerTime);

    if (mode === 'propose') {
      propose.mutate(
        { stage_date_id: sd.id, datetime: iso, notes: notes || undefined },
        {
          onSuccess: () => setMode('idle'),
          onError: (err: Error) => {
            toast.error('Não foi possível salvar a sugestão. Tente novamente.', {
              action: { label: 'Tentar novamente', onClick: handleSubmit },
            });
          },
        },
      );
    } else if (mode === 'confirm') {
      confirm.mutate(
        { stage_date_id: sd.id, datetime: iso, notes: notes || undefined },
        {
          onSuccess: () => setMode('idle'),
          onError: (err: Error) => {
            toast.error('Não foi possível confirmar a data. Tente novamente.', {
              action: { label: 'Tentar novamente', onClick: handleSubmit },
            });
          },
        },
      );
    }
  };

  const isPending = propose.isPending || confirm.isPending;

  return (
    <article
      className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-sm)] overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]"
      aria-label={`${tl.label}: ${sd.title}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-base" aria-hidden>{tl.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{sd.title}</p>
          <p className="text-[11px] text-muted-foreground">{tl.label}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] gap-1 border", cfg.badgeClass)}>
          <StatusIcon className="h-3 w-3" aria-hidden />
          {cfg.label}
        </Badge>
      </div>

      {/* Date display — stacks vertically on mobile */}
      <div className="px-4 pb-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
        {/* Proposed */}
        <div className="flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-lg bg-muted/40">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Proposta do cliente</p>
            {sd.customer_proposed_at ? (
              <p className="text-sm font-medium text-foreground">
                {format(parseISO(sd.customer_proposed_at), "dd 'de' MMM, yyyy · HH:mm", { locale: ptBR })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">Ainda não proposta</p>
            )}
          </div>
        </div>

        {/* Confirmed */}
        <div className={cn(
          "flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-lg",
          sd.bwild_confirmed_at ? "bg-[hsl(var(--success-light))]" : "bg-muted/40"
        )}>
          <CheckCircle2 className={cn("h-4 w-4 shrink-0", sd.bwild_confirmed_at ? "text-[hsl(var(--success))]" : "text-muted-foreground")} aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Confirmada pela Bwild</p>
            {sd.bwild_confirmed_at ? (
              <p className="text-sm font-semibold text-[hsl(var(--success))]">
                {format(parseISO(sd.bwild_confirmed_at), "dd 'de' MMM, yyyy · HH:mm", { locale: ptBR })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">Aguardando confirmação</p>
            )}
          </div>
        </div>
      </div>

      {/* Divergence warning */}
      {hasDivergence && (
        <div className="px-4 pb-3">
          <DivergenceWarning proposed={sd.customer_proposed_at!} confirmed={sd.bwild_confirmed_at!} />
        </div>
      )}

      {/* Notes */}
      {sd.notes && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground italic bg-muted/30 rounded-md px-3 py-2">
            💬 {sd.notes}
          </p>
        </div>
      )}

      {/* Actions bar */}
      {mode === 'idle' && (
        <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
          {!isStaff && (
            <Button
              variant="outline"
              size="sm"
              className="h-11 text-xs gap-1.5 min-w-[44px]"
              onClick={() => {
                setPickerDate(sd.customer_proposed_at ? parseISO(sd.customer_proposed_at) : undefined);
                setPickerTime(sd.customer_proposed_at ? format(parseISO(sd.customer_proposed_at), 'HH:mm') : '09:00');
                setNotes('');
                setMode('propose');
              }}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {sd.customer_proposed_at ? 'Alterar sugestão' : 'Sugerir data'}
            </Button>
          )}
          {isStaff && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-11 text-xs gap-1.5 min-w-[44px]"
                onClick={() => {
                  setPickerDate(sd.customer_proposed_at ? parseISO(sd.customer_proposed_at) : undefined);
                  setPickerTime(sd.customer_proposed_at ? format(parseISO(sd.customer_proposed_at), 'HH:mm') : '09:00');
                  setNotes('');
                  setMode('propose');
                }}
              >
                Ajustar proposta
              </Button>
              <Button
                size="sm"
                className="h-11 text-xs gap-1.5 min-w-[44px]"
                onClick={() => {
                  const ref = sd.customer_proposed_at || sd.bwild_confirmed_at;
                  setPickerDate(ref ? parseISO(ref) : undefined);
                  setPickerTime(ref ? format(parseISO(ref), 'HH:mm') : '09:00');
                  setNotes('');
                  setMode('confirm');
                }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Confirmar data
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-11 text-xs gap-1 ml-auto text-muted-foreground hover:text-foreground min-w-[44px]"
            onClick={() => setShowHistory(true)}
            aria-label={`Ver histórico de ${sd.title}`}
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            Ver histórico
          </Button>
        </div>
      )}

      {/* History Drawer */}
      <DateHistoryDrawer
        open={showHistory}
        onOpenChange={setShowHistory}
        title={sd.title}
        events={events}
        isLoading={eventsLoading}
      />

      {/* Propose/Confirm form */}
      {mode !== 'idle' && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <p className="text-xs font-medium text-foreground">
            {mode === 'propose' ? '📅 Sugerir data e horário' : '✅ Confirmar data e horário'}
          </p>

          <DateTimePicker
            date={pickerDate}
            time={pickerTime}
            onDateChange={setPickerDate}
            onTimeChange={setPickerTime}
            label="Escolher data"
            disabled={isPending}
            disablePastDates={sd.date_type === 'meeting'}
          />

          <Input
            placeholder="Observação (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-11 text-sm"
            disabled={isPending}
            aria-label="Observação"
          />

          {/* Customer microcopy */}
          {mode === 'propose' && !isStaff && sd.bwild_confirmed_at && (
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
              ✨ Sua sugestão será analisada pela equipe Bwild. Entraremos em contato para confirmar a melhor data.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-11 gap-1.5 min-w-[44px]"
              disabled={!pickerDate || isPending}
              onClick={handleSubmit}
            >
              {isPending ? (
                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-label="Salvando" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              {mode === 'propose' ? 'Enviar sugestão' : 'Confirmar'}
            </Button>
            <Button variant="ghost" size="sm" className="h-11 min-w-[44px]" onClick={() => setMode('idle')} disabled={isPending}>
              <X className="h-3.5 w-3.5 mr-1" aria-hidden /> Cancelar
            </Button>
          </div>
        </div>
      )}

    </article>
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
    <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-accent/30 space-y-3" role="form" aria-label="Nova data importante">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Plus className="h-3.5 w-3.5 text-primary" aria-hidden />
        Nova data importante
      </p>
      <Input
        placeholder="Título (ex: Reunião de briefing)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-11 text-sm"
        aria-label="Título da data"
      />
      <select
        className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        value={dateType}
        onChange={(e) => setDateType(e.target.value as StageDate['date_type'])}
        aria-label="Tipo de data"
      >
        <option value="meeting">📅 Reunião</option>
        <option value="deadline">⏰ Prazo</option>
        <option value="start_planned">🟢 Início planejado</option>
        <option value="end_planned">🔴 Término planejado</option>
        <option value="milestone">🏁 Marco</option>
      </select>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-11 gap-1.5 min-w-[44px]"
          disabled={!title.trim() || create.isPending}
          onClick={() => {
            create.mutate(
              { stage_key: stageKey, date_type: dateType, title: title.trim() },
              {
                onSuccess: () => onClose(),
                onError: () => toast.error('Erro ao criar data. Tente novamente.'),
              },
            );
          }}
        >
          {create.isPending ? (
            <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          Criar
        </Button>
        <Button variant="ghost" size="sm" className="h-11 min-w-[44px]" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Empty State ───

function EmptyDatesState({ isStaff }: { isStaff: boolean }) {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="mx-auto w-10 h-10 rounded-full bg-accent flex items-center justify-center">
        <CalendarIconSolid className="h-5 w-5 text-primary" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">Sem datas ainda</p>
      <p className="text-xs text-muted-foreground max-w-[240px] mx-auto">
        {isStaff
          ? 'Adicione datas importantes para esta etapa, como reuniões, prazos e marcos.'
          : 'As datas desta etapa ainda serão definidas. Você será notificado quando houver novidades.'}
      </p>
    </div>
  );
}

// ─── Loading Skeleton ───

function DatesSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando datas">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border/60 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 ml-auto rounded-full" />
          </div>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inline Date Field (legacy journey_stages columns) ───

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
      <div className="flex items-center gap-2 min-h-[44px]">
        <Icon className={cn("h-4 w-4 shrink-0", isConfirmed ? "text-[hsl(var(--success))]" : "text-muted-foreground")} aria-hidden />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-sm font-medium", isConfirmed ? "text-[hsl(var(--success))]" : "text-foreground")}>
            {parsedDate ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Em definição'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 min-h-[44px] w-full rounded-lg px-3 py-2 text-left transition-colors",
            "hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-2 focus-visible:outline-primary",
            "border border-transparent hover:border-border"
          )}
          aria-label={`${label}: ${parsedDate ? format(parsedDate, "dd/MM/yyyy") : 'Selecionar data'}`}
        >
          <Icon className={cn("h-4 w-4 shrink-0", isConfirmed ? "text-[hsl(var(--success))]" : "text-muted-foreground")} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("text-sm font-medium", isConfirmed ? "text-[hsl(var(--success))]" : parsedDate ? "text-foreground" : "text-muted-foreground")}>
              {parsedDate ? format(parsedDate, "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Selecionar data'}
            </p>
          </div>
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
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
            <Button variant="ghost" size="sm" className="w-full text-destructive hover:text-destructive min-h-[44px]"
              onClick={() => { onSelect(undefined); setOpen(false); }}>
              <X className="h-4 w-4 mr-1" aria-hidden /> Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
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

  const stageKey = stageName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const { data: granularDates, isLoading } = useStageDates(projectId, stageKey);

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
      toast.error('Erro ao atualizar data. Tente novamente.');
    }
  };

  const hasAnyDate = dates.proposed_start || dates.proposed_end || dates.confirmed_start || dates.confirmed_end;
  const hasGranularDates = (granularDates?.length ?? 0) > 0;
  const canEditProposed = true;
  const canEditConfirmed = isAdmin;

  if (!isAdmin && !hasAnyDate && !hasGranularDates && !isLoading) return null;

  return (
    <section
      className="space-y-4 p-4 md:p-5 bg-card rounded-xl border border-border/50 shadow-[var(--shadow-sm)]"
      aria-label="Datas importantes da etapa"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-accent">
            <CalendarIcon className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <h4 className="text-sm font-bold text-foreground tracking-tight">Datas importantes</h4>
        </div>
        {!showCreate && (
          <Button variant="outline" size="sm" className="h-11 text-xs gap-1.5 min-w-[44px]" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> Nova data
          </Button>
        )}
      </div>

      {/* Inline dates (legacy journey_stages columns) */}
      {(hasAnyDate || isAdmin) && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Proposta do cliente
            </p>
            <InlineDateField label="Início proposto" value={dates.proposed_start} icon={Clock}
              onSelect={(d) => handleDateChange('proposed_start', d)} canEdit={canEditProposed} />
            <InlineDateField label="Término proposto" value={dates.proposed_end} icon={Clock}
              onSelect={(d) => handleDateChange('proposed_end', d)} canEdit={canEditProposed} />
          </div>
          <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
      )}

      {/* Granular dates */}
      {isLoading ? (
        <DatesSkeleton />
      ) : hasGranularDates ? (
        <div className="space-y-3">
          {granularDates!.map((sd) => (
            <StageDateRow key={sd.id} sd={sd} isStaff={isAdmin} projectId={projectId} />
          ))}
        </div>
      ) : !hasAnyDate ? (
        <EmptyDatesState isStaff={isAdmin} />
      ) : null}

      {/* Create form */}
      {showCreate && (
        <CreateStageDateForm projectId={projectId} stageKey={stageKey} onClose={() => setShowCreate(false)} />
      )}
    </section>
  );
}
