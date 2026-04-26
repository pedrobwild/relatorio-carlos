/**
 * DailyLogInline — bloco expandido abaixo da row da obra no Painel.
 *
 * Renderiza na própria tabela (dentro de um <TableRow>/<TableCell colSpan>)
 * com o mesmo vocabulário visual do site (tokens --primary, --accent,
 * --warning etc.). Permite preencher o registro semanal e o planejamento:
 *
 *   • Serviços em execução
 *   • Prestadores no local
 *   • Planejamento da semana
 *   • Observações gerais
 *
 * Persistência: usa o mesmo hook useProjectDailyLog (tabela
 * project_daily_logs + filhos). A data default é a segunda-feira da
 * semana corrente ("registro da semana") — pode ser ajustada.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  HardHat,
  Loader2,
  MessageSquareText,
  Plus,
  Trash2,
} from 'lucide-react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import {
  useProjectDailyLog,
  useSaveProjectDailyLog,
  type DailyLogService,
  type DailyLogServiceStatus,
  type DailyLogWorker,
} from '@/hooks/useProjectDailyLog';
import { ServiceTasksList } from './ServiceTasksList';

// ----- props -----

export interface DailyLogInlineProps {
  projectId: string;
  /** Data inicial ISO (YYYY-MM-DD). Default = segunda-feira da semana atual. */
  initialDate?: string;
}

const SERVICE_STATUS_OPTIONS: Exclude<DailyLogServiceStatus, null>[] = [
  'Em andamento',
  'Concluído',
  'Parado',
];

const mondayIso = () =>
  format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

// ----- componente -----

export function DailyLogInline({ projectId, initialDate }: DailyLogInlineProps) {
  const [logDate, setLogDate] = useState(initialDate ?? mondayIso());

  const { data, isLoading } = useProjectDailyLog(projectId, logDate);
  const saveMutation = useSaveProjectDailyLog();

  // ----- estado local editável -----
  const [notes, setNotes] = useState<string>('');
  const [planning, setPlanning] = useState<string>('');
  const [services, setServices] = useState<DailyLogService[]>([]);
  const [workers, setWorkers] = useState<DailyLogWorker[]>([]);

  // sincroniza com o dado carregado
  useEffect(() => {
    if (data) {
      // Convenção: as observações gerais e o planejamento da semana são
      // separadas por um marcador dentro do campo `notes` do banco para
      // não precisar criar nova coluna. Formato:
      //   <observações livres>\n---PLAN---\n<planejamento da semana>
      const raw = data.notes ?? '';
      const sep = '\n---PLAN---\n';
      if (raw.includes(sep)) {
        const [obs, plan] = raw.split(sep);
        setNotes(obs);
        setPlanning(plan);
      } else {
        setNotes(raw);
        setPlanning('');
      }
      setServices(data.services);
      setWorkers(data.workers);
    }
  }, [data]);

  const isSaving = saveMutation.isPending;

  const hasContent = useMemo(
    () =>
      services.length > 0 ||
      workers.length > 0 ||
      notes.trim().length > 0 ||
      planning.trim().length > 0,
    [services, workers, notes, planning],
  );

  // ----- ações serviços -----
  const addService = () =>
    setServices((curr) => [
      ...curr,
      {
        description: '',
        status: 'Em andamento',
        observations: null,
        start_date: null,
        end_date: null,
        position: curr.length,
      },
    ]);
  const updateService = (index: number, patch: Partial<DailyLogService>) =>
    setServices((curr) =>
      curr.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  const removeService = (index: number) =>
    setServices((curr) => curr.filter((_, i) => i !== index));

  // ----- ações prestadores -----
  const addWorker = () =>
    setWorkers((curr) => [
      ...curr,
      {
        name: '',
        role: null,
        period_start: null,
        period_end: null,
        shift_start: null,
        shift_end: null,
        notes: null,
        position: curr.length,
      },
    ]);
  const updateWorker = (index: number, patch: Partial<DailyLogWorker>) =>
    setWorkers((curr) =>
      curr.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    );
  const removeWorker = (index: number) =>
    setWorkers((curr) => curr.filter((_, i) => i !== index));

  // ----- salvar -----
  const handleSave = async () => {
    const cleanedServices = services
      .map((s, idx) => ({ ...s, position: idx }))
      .filter((s) => s.description.trim().length > 0);
    const cleanedWorkers = workers
      .map((w, idx) => ({ ...w, position: idx }))
      .filter((w) => w.name.trim().length > 0);

    // Junta observações + planejamento no campo notes com marcador
    const obs = notes.trim();
    const plan = planning.trim();
    const combinedNotes =
      obs || plan ? `${obs}${plan ? `\n---PLAN---\n${plan}` : ''}` : null;

    await saveMutation.mutateAsync({
      project_id: projectId,
      log_date: logDate,
      notes: combinedNotes,
      services: cleanedServices,
      workers: cleanedWorkers,
    });
  };

  return (
    <div className="bg-muted/20 border-l-2 border-l-primary px-3 sm:px-5 py-4 space-y-4">
      {/* Cabeçalho: data + última atualização */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <CalendarRange className="h-3.5 w-3.5 text-primary" />
          </div>
          <Label htmlFor={`daily-log-date-${projectId}`} className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
            Semana de
          </Label>
          <Input
            id={`daily-log-date-${projectId}`}
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="h-9 flex-1 min-w-0 max-w-[180px] text-sm bg-card"
            disabled={isSaving}
          />
        </div>
        {data?.updated_at && (
          <span className="text-[11px] sm:text-xs text-muted-foreground tabular-nums w-full sm:w-auto">
            Atualizado em{' '}
            {format(parseISO(data.updated_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Serviços em execução */}
          <SectionCard
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
            title="Serviços em execução"
            count={services.length}
            defaultOpen={services.length > 0}
            previewWhenClosed={
              services.length === 0
                ? 'Nenhum serviço — toque para adicionar'
                : `${services.length} ${services.length === 1 ? 'serviço' : 'serviços'} registrado${services.length === 1 ? '' : 's'}`
            }
          >
            <div className="flex flex-col gap-3">
              {services.length === 0 && (
                <EmptyLine text="Nenhum serviço adicionado." />
              )}
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3 sm:p-3 flex flex-col gap-3 shadow-sm"
                >
                  {/* Header da linha: índice + remover (mobile-friendly) */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Serviço #{i + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 -mr-1 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeService(i)}
                      disabled={isSaving}
                      title="Remover serviço"
                      aria-label="Remover serviço"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Descrição + status: empilha no mobile, lado a lado no sm+ */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                    <Input
                      value={svc.description}
                      placeholder="Ex.: Instalação elétrica – quarto 2"
                      onChange={(e) =>
                        updateService(i, { description: e.target.value })
                      }
                      className="h-10 sm:h-9 text-sm"
                      disabled={isSaving}
                    />
                    <Select
                      value={svc.status ?? ''}
                      onValueChange={(v) =>
                        updateService(i, {
                          status: (v || null) as DailyLogServiceStatus,
                        })
                      }
                    >
                      <SelectTrigger className="h-10 sm:h-9 text-sm">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <MiniField
                      label="Início"
                      type="date"
                      value={svc.start_date ?? ''}
                      onChange={(v) => updateService(i, { start_date: v || null })}
                      disabled={isSaving}
                    />
                    <MiniField
                      label="Fim"
                      type="date"
                      value={svc.end_date ?? ''}
                      onChange={(v) => updateService(i, { end_date: v || null })}
                      disabled={isSaving}
                    />
                  </div>
                  <Textarea
                    value={svc.observations ?? ''}
                    placeholder="Observações (opcional)"
                    onChange={(e) =>
                      updateService(i, {
                        observations: e.target.value || null,
                      })
                    }
                    className="min-h-[64px] text-sm"
                    disabled={isSaving}
                  />
                  <ServiceTasksList serviceId={svc.id} serviceSaved={!!svc.id} />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addService}
                className="w-full sm:w-auto sm:self-start h-10 sm:h-9 text-sm"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar serviço
              </Button>
            </div>
          </SectionCard>

          {/* Prestadores no local */}
          <SectionCard
            icon={<HardHat className="h-4 w-4 text-primary" />}
            title="Prestadores no local"
            count={workers.length}
            defaultOpen={workers.length > 0}
            previewWhenClosed={
              workers.length === 0
                ? 'Nenhum prestador — toque para adicionar'
                : `${workers.length} ${workers.length === 1 ? 'prestador' : 'prestadores'} registrado${workers.length === 1 ? '' : 's'}`
            }
          >
            <div className="flex flex-col gap-3">
              {workers.length === 0 && (
                <EmptyLine text="Nenhum prestador adicionado." />
              )}
              {workers.map((wk, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-3 flex flex-col gap-3 shadow-sm"
                >
                  {/* Header da linha: índice + remover */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      Prestador #{i + 1}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 -mr-1 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeWorker(i)}
                      disabled={isSaving}
                      title="Remover prestador"
                      aria-label="Remover prestador"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Nome + função: empilha no mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      value={wk.name}
                      placeholder="Nome do prestador"
                      onChange={(e) =>
                        updateWorker(i, { name: e.target.value })
                      }
                      className="h-10 sm:h-9 text-sm"
                      disabled={isSaving}
                    />
                    <Input
                      value={wk.role ?? ''}
                      placeholder="Função / empresa"
                      onChange={(e) =>
                        updateWorker(i, { role: e.target.value || null })
                      }
                      className="h-10 sm:h-9 text-sm"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Período (datas) — sempre 2 colunas */}
                  <div className="grid grid-cols-2 gap-2">
                    <MiniField
                      label="Período de"
                      type="date"
                      value={wk.period_start ?? ''}
                      onChange={(v) =>
                        updateWorker(i, { period_start: v || null })
                      }
                      disabled={isSaving}
                    />
                    <MiniField
                      label="até"
                      type="date"
                      value={wk.period_end ?? ''}
                      onChange={(v) => updateWorker(i, { period_end: v || null })}
                      disabled={isSaving}
                    />
                  </div>

                  {/* Horário — 2 colunas no mobile (ao invés de 4 esmagadas) */}
                  <div className="grid grid-cols-2 gap-2">
                    <MiniField
                      label="Entrada"
                      type="time"
                      value={wk.shift_start ?? ''}
                      onChange={(v) =>
                        updateWorker(i, { shift_start: v || null })
                      }
                      disabled={isSaving}
                    />
                    <MiniField
                      label="Saída"
                      type="time"
                      value={wk.shift_end ?? ''}
                      onChange={(v) => updateWorker(i, { shift_end: v || null })}
                      disabled={isSaving}
                    />
                  </div>
                  <Textarea
                    value={wk.notes ?? ''}
                    placeholder="Observações do prestador (opcional)"
                    onChange={(e) =>
                      updateWorker(i, { notes: e.target.value || null })
                    }
                    className="min-h-[56px] text-sm"
                    disabled={isSaving}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWorker}
                className="w-full sm:w-auto sm:self-start h-10 sm:h-9 text-sm"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar prestador
              </Button>
            </div>
          </SectionCard>

          {/* Planejamento da semana */}
          <SectionCard
            icon={<CalendarRange className="h-4 w-4 text-primary" />}
            title="Planejamento da semana"
            defaultOpen={!!planning}
          >
            <Textarea
              value={planning}
              onChange={(e) => setPlanning(e.target.value)}
              placeholder="Metas, etapas e marcos previstos para esta semana"
              className="min-h-[88px] text-sm"
              disabled={isSaving}
            />
          </SectionCard>

          {/* Observações */}
          <SectionCard
            icon={<MessageSquareText className="h-4 w-4 text-primary" />}
            title="Observações gerais"
            defaultOpen={!!notes}
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Relato livre — incidentes, decisões, contexto do dia"
              className="min-h-[88px] text-sm"
              disabled={isSaving}
            />
          </SectionCard>
        </div>
      )}

      <div className="flex justify-stretch sm:justify-end pt-2 border-t border-border/60">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasContent}
          className="w-full sm:w-auto h-11 sm:h-9"
        >
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar registro da semana
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Helpers internos
// ============================================================

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SectionCard({
  icon,
  title,
  count,
  defaultOpen = true,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasCount = typeof count === 'number';
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'rounded-lg border border-border bg-card overflow-hidden shadow-sm transition-all',
          open ? 'shadow-md' : 'hover:shadow-md',
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Recolher ${title}` : `Expandir ${title}`}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-3 sm:py-2.5 text-left min-h-[44px]',
              'hover:bg-accent/30 active:bg-accent/40 transition-colors',
            )}
          >
            {icon}
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {hasCount && (
              <Badge
                variant={count! > 0 ? 'secondary' : 'outline'}
                className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] tabular-nums"
              >
                {count}
              </Badge>
            )}
            <ChevronDown
              aria-hidden
              className={cn(
                'h-4 w-4 text-muted-foreground ml-auto shrink-0 transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-2 border-t border-border/60 bg-muted/10">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground italic py-1">{text}</div>
  );
}

interface MiniFieldProps {
  label: string;
  type: 'date' | 'time';
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function MiniField({ label, type, value, onChange, disabled }: MiniFieldProps) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 sm:h-9 text-sm w-full"
        disabled={disabled}
      />
    </div>
  );
}
