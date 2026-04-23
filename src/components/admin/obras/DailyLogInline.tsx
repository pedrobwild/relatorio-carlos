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
    <div className="bg-muted/30 p-4 space-y-4">
      {/* Cabeçalho: data + última atualização */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-[hsl(var(--primary))]" />
          <Label htmlFor={`daily-log-date-${projectId}`} className="text-xs font-medium">
            Semana de
          </Label>
          <Input
            id={`daily-log-date-${projectId}`}
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="h-8 w-auto text-sm"
            disabled={isSaving}
          />
        </div>
        {data?.updated_at && (
          <span className="text-xs text-muted-foreground">
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
            icon={<ClipboardList className="h-4 w-4 text-[hsl(var(--primary))]" />}
            title="Serviços em execução"
            count={services.length}
            defaultOpen
          >
            <div className="flex flex-col gap-3">
              {services.length === 0 && (
                <EmptyLine text="Nenhum serviço adicionado." />
              )}
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-card p-3 flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                      <Input
                        value={svc.description}
                        placeholder="Ex.: Instalação elétrica – quarto 2"
                        onChange={(e) =>
                          updateService(i, { description: e.target.value })
                        }
                        className="h-8 text-sm"
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
                        <SelectTrigger className="h-8 text-sm">
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
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeService(i)}
                      disabled={isSaving}
                      title="Remover serviço"
                      aria-label="Remover serviço"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
                    className="min-h-[56px] text-sm"
                    disabled={isSaving}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addService}
                className="self-start h-8 text-xs"
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar serviço
              </Button>
            </div>
          </SectionCard>

          {/* Prestadores no local */}
          <SectionCard
            icon={<HardHat className="h-4 w-4 text-[hsl(var(--primary))]" />}
            title="Prestadores no local"
            count={workers.length}
            defaultOpen
          >
            <div className="flex flex-col gap-3">
              {workers.length === 0 && (
                <EmptyLine text="Nenhum prestador adicionado." />
              )}
              {workers.map((wk, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-card p-3 flex flex-col gap-2 shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={wk.name}
                        placeholder="Nome do prestador"
                        onChange={(e) =>
                          updateWorker(i, { name: e.target.value })
                        }
                        className="h-8 text-sm"
                        disabled={isSaving}
                      />
                      <Input
                        value={wk.role ?? ''}
                        placeholder="Função / empresa"
                        onChange={(e) =>
                          updateWorker(i, { role: e.target.value || null })
                        }
                        className="h-8 text-sm"
                        disabled={isSaving}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeWorker(i)}
                      disabled={isSaving}
                      title="Remover prestador"
                      aria-label="Remover prestador"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                    className="min-h-[44px] text-sm"
                    disabled={isSaving}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWorker}
                className="self-start h-8 text-xs"
                disabled={isSaving}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar prestador
              </Button>
            </div>
          </SectionCard>

          {/* Planejamento da semana */}
          <SectionCard
            icon={<CalendarRange className="h-4 w-4 text-[hsl(var(--primary))]" />}
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
            icon={<MessageSquareText className="h-4 w-4 text-[hsl(var(--primary))]" />}
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

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !hasContent}
          size="sm"
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
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-label={open ? `Recolher ${title}` : `Expandir ${title}`}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-left',
              'hover:bg-accent/40 transition-colors',
            )}
          >
            {icon}
            <span className="text-sm font-medium">{title}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums ml-1">
                ({count})
              </span>
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
          <div className="px-3 pb-3 pt-1 border-t border-border">{children}</div>
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
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
        disabled={disabled}
      />
    </div>
  );
}
