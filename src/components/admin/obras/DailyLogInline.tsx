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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  ChevronDown,
  ClipboardList,
  HardHat,
  Info,
  Loader2,
  type LucideIcon,
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

  // ----- refs para foco pós-inserção -----
  // Quando o usuário aciona "Adicionar" (header ou rodapé), guardamos o
  // índice do novo item em pendingFocusRef.{services|workers}; um efeito
  // após o re-render localiza a linha via [data-row-index] dentro do
  // container correspondente e dá scrollIntoView + focus no primeiro
  // campo marcado com [data-autofocus].
  const servicesListRef = useRef<HTMLDivElement | null>(null);
  const workersListRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<{ services?: number; workers?: number }>({});

  // ----- ações serviços -----
  const addService = useCallback(() => {
    setServices((curr) => {
      pendingFocusRef.current.services = curr.length;
      return [
        ...curr,
        {
          description: '',
          status: 'Em andamento',
          observations: null,
          start_date: null,
          end_date: null,
          position: curr.length,
        },
      ];
    });
  }, []);
  const updateService = (index: number, patch: Partial<DailyLogService>) =>
    setServices((curr) =>
      curr.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  const removeService = (index: number) =>
    setServices((curr) => curr.filter((_, i) => i !== index));

  // ----- ações prestadores -----
  const addWorker = useCallback(() => {
    setWorkers((curr) => {
      pendingFocusRef.current.workers = curr.length;
      return [
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
      ];
    });
  }, []);
  const updateWorker = (index: number, patch: Partial<DailyLogWorker>) =>
    setWorkers((curr) =>
      curr.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    );
  const removeWorker = (index: number) =>
    setWorkers((curr) => curr.filter((_, i) => i !== index));

  // Foca o último item adicionado depois do re-render. Usa um pequeno
  // requestAnimationFrame para garantir que o DOM da nova linha já está
  // pintado antes do scroll/focus.
  useEffect(() => {
    const idx = pendingFocusRef.current.services;
    if (idx === undefined || !servicesListRef.current) return;
    pendingFocusRef.current.services = undefined;
    requestAnimationFrame(() => {
      const row = servicesListRef.current?.querySelector<HTMLElement>(
        `[data-row-index="${idx}"]`,
      );
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      row.querySelector<HTMLElement>('[data-autofocus="true"]')?.focus();
    });
  }, [services.length]);

  useEffect(() => {
    const idx = pendingFocusRef.current.workers;
    if (idx === undefined || !workersListRef.current) return;
    pendingFocusRef.current.workers = undefined;
    requestAnimationFrame(() => {
      const row = workersListRef.current?.querySelector<HTMLElement>(
        `[data-row-index="${idx}"]`,
      );
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      row.querySelector<HTMLElement>('[data-autofocus="true"]')?.focus();
    });
  }, [workers.length]);

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
    <div className="bg-muted/20 border-l-2 border-l-primary px-2 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Cabeçalho: data + última atualização */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 sm:pb-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <CalendarRange className="h-3.5 w-3.5 text-primary" />
          </div>
          <Label
            htmlFor={`daily-log-date-${projectId}`}
            className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0"
          >
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
          <span className="text-[11px] sm:text-xs text-muted-foreground tabular-nums truncate">
            Atualizado em{' '}
            {format(parseISO(data.updated_at), "dd/MM/yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 items-start animate-fade-in motion-reduce:animate-none">
          {/* Serviços e prestadores — UNIFICADO num único colapsável.
              Mantém duas subseções (Serviços / Prestadores) lado a lado em
              telas largas e empilhadas no mobile. Modelo de dados continua
              separado (services + workers); a unificação é puramente de
              UI/UX para reduzir cliques e dar uma visão única de "quem está
              fazendo o quê" no dia. */}
          <SectionCard
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
            title="Serviços e prestadores"
            count={isLoading ? undefined : services.length + workers.length}
            defaultOpen={!isLoading && (services.length > 0 || workers.length > 0)}
            isLoading={isLoading}
            loadingSkeleton={
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                <ServicesSkeleton />
                <WorkersSkeleton />
              </div>
            }
            previewWhenClosed={(() => {
              if (isLoading) return 'Carregando…';
              if (services.length === 0 && workers.length === 0) {
                return 'Nenhum serviço ou prestador — toque para adicionar';
              }
              const parts: string[] = [];
              if (services.length > 0) {
                parts.push(`${services.length} ${services.length === 1 ? 'serviço' : 'serviços'}`);
              }
              if (workers.length > 0) {
                parts.push(`${workers.length} ${workers.length === 1 ? 'prestador' : 'prestadores'}`);
              }
              return parts.join(' • ');
            })()}
            // Esta seção ocupa as duas colunas do grid externo, já que
            // internamente ela própria divide em duas colunas.
            className="lg:col-span-2"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
              {/* ============== SUBSEÇÃO: Serviços em execução ============== */}
              <section
                aria-labelledby={`subsec-services-${projectId}`}
                className="flex flex-col gap-2 sm:gap-3 min-w-0"
              >
                <SubsectionHeader
                  id={`subsec-services-${projectId}`}
                  icon={ClipboardList}
                  title="Serviços em execução"
                  count={services.length}
                />
                {services.length === 0 && (
                  <EmptyLine text="Nenhum serviço adicionado — toque em Adicionar serviço abaixo." />
                )}
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-2.5 sm:p-3 flex flex-col gap-2 sm:gap-3 shadow-sm min-w-0"
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
                      className="h-8 w-8 -mr-1 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeService(i)}
                      disabled={isSaving}
                      title="Remover serviço"
                      aria-label="Remover serviço"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Descrição + status: empilha no mobile, lado a lado no sm+ */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 min-w-0">
                    <Input
                      value={svc.description}
                      placeholder="Ex.: Instalação elétrica"
                      onChange={(e) =>
                        updateService(i, { description: e.target.value })
                      }
                      className="h-9 text-sm w-full min-w-0"
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
                      <SelectTrigger className="h-9 text-sm w-full min-w-0">
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

                  <div className="grid grid-cols-2 gap-2 min-w-0">
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
                    className="min-h-[56px] text-sm w-full"
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
                className="w-full sm:w-auto sm:self-start h-9 text-sm"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar serviço
              </Button>
              </section>

              {/* ============== SUBSEÇÃO: Prestadores no local ============== */}
              <section
                aria-labelledby={`subsec-workers-${projectId}`}
                className="flex flex-col gap-2 sm:gap-3 min-w-0"
              >
                <SubsectionHeader
                  id={`subsec-workers-${projectId}`}
                  icon={HardHat}
                  title="Prestadores no local"
                  count={workers.length}
                />
                {workers.length === 0 && (
                  <EmptyLine text="Nenhum prestador adicionado — toque em Adicionar prestador abaixo." />
                )}
              {workers.map((wk, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-card p-2.5 sm:p-3 flex flex-col gap-2 sm:gap-3 shadow-sm min-w-0"
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
                      className="h-8 w-8 -mr-1 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => removeWorker(i)}
                      disabled={isSaving}
                      title="Remover prestador"
                      aria-label="Remover prestador"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Nome + função: empilha no mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                    <Input
                      value={wk.name}
                      placeholder="Nome do prestador"
                      onChange={(e) =>
                        updateWorker(i, { name: e.target.value })
                      }
                      className="h-9 text-sm w-full min-w-0"
                      disabled={isSaving}
                    />
                    <Input
                      value={wk.role ?? ''}
                      placeholder="Função / empresa"
                      onChange={(e) =>
                        updateWorker(i, { role: e.target.value || null })
                      }
                      className="h-9 text-sm w-full min-w-0"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Período (datas) — sempre 2 colunas */}
                  <div className="grid grid-cols-2 gap-2 min-w-0">
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
                  <div className="grid grid-cols-2 gap-2 min-w-0">
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
                    className="min-h-[56px] text-sm w-full"
                    disabled={isSaving}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWorker}
                className="w-full sm:w-auto sm:self-start h-9 text-sm"
                disabled={isSaving}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Adicionar prestador
              </Button>
              </section>
            </div>
          </SectionCard>

          {/* Planejamento da semana */}
          <SectionCard
            icon={<CalendarRange className="h-4 w-4 text-primary" />}
            title="Planejamento da semana"
            defaultOpen={!isLoading && !!planning}
            isLoading={isLoading}
            loadingSkeleton={<TextareaSkeleton />}
            previewWhenClosed={
              isLoading
                ? 'Carregando planejamento…'
                : planning.trim()
                ? truncate(planning, 80)
                : 'Sem planejamento — toque para preencher'
            }
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
            defaultOpen={!isLoading && !!notes}
            isLoading={isLoading}
            loadingSkeleton={<TextareaSkeleton />}
            previewWhenClosed={
              isLoading
                ? 'Carregando observações…'
                : notes.trim()
                ? truncate(notes, 80)
                : 'Sem observações — toque para adicionar'
            }
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
  /** Texto resumido exibido no header quando a seção está fechada. */
  previewWhenClosed?: string;
  /** Quando true, renderiza `loadingSkeleton` no lugar de `children`. */
  isLoading?: boolean;
  /** Skeleton específico desta seção (renderizado dentro do conteúdo aberto). */
  loadingSkeleton?: React.ReactNode;
  /** Classes extras aplicadas ao wrapper externo (útil p/ col-span no grid). */
  className?: string;
  children: React.ReactNode;
}

function SectionCard({
  icon,
  title,
  count,
  defaultOpen = true,
  previewWhenClosed,
  isLoading = false,
  loadingSkeleton,
  className,
  children,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const hasCount = typeof count === 'number';
  // Enquanto está carregando, força a seção aberta para que o skeleton
  // ocupe a mesma altura aproximada do conteúdo final — evitando layout
  // shift quando os dados chegam e a seção "abre" sozinha. Após o load,
  // o estado controlado pelo usuário volta a valer.
  const effectiveOpen = isLoading ? true : open;
  return (
    <Collapsible open={effectiveOpen} onOpenChange={setOpen} className={className}>
      <div
        className={cn(
          'rounded-lg border border-border bg-card overflow-hidden shadow-sm transition-all min-w-0',
          effectiveOpen ? 'shadow-md' : 'hover:shadow-md',
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={effectiveOpen}
            aria-busy={isLoading || undefined}
            aria-label={effectiveOpen ? `Recolher ${title}` : `Expandir ${title}`}
            disabled={isLoading}
            className={cn(
              'w-full flex items-start gap-2 px-3 py-3 sm:py-2.5 text-left min-h-[44px]',
              'hover:bg-accent/30 active:bg-accent/40 transition-colors',
              isLoading && 'cursor-default',
            )}
          >
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">
                  {title}
                </span>
                {isLoading ? (
                  <span
                    className={cn(SHIMMER_CLASS, 'h-4 w-6 rounded-full shrink-0')}
                    aria-hidden
                  />
                ) : (
                  hasCount && (
                    <Badge
                      variant={count! > 0 ? 'secondary' : 'outline'}
                      className="h-5 min-w-[20px] justify-center px-1.5 text-[10px] tabular-nums shrink-0"
                    >
                      {count}
                    </Badge>
                  )
                )}
              </span>
              {!effectiveOpen && previewWhenClosed && (
                <span className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {previewWhenClosed}
                </span>
              )}
            </div>
            <ChevronDown
              aria-hidden
              className={cn(
                'h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform',
                effectiveOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-2 sm:px-3 pb-2.5 sm:pb-3 pt-2 border-t border-border/60 bg-muted/10 min-w-0">
            {isLoading && loadingSkeleton ? loadingSkeleton : children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
      role="status"
    >
      <Info className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span className="leading-snug">{text}</span>
    </div>
  );
}

interface SubsectionHeaderProps {
  id: string;
  icon: LucideIcon;
  title: string;
  /** Quando undefined, renderiza um placeholder shimmer (estado de carregamento). */
  count?: number;
  /** Slot opcional para uma ação rápida (ex.: "Adicionar"). */
  action?: React.ReactNode;
}

/**
 * Cabeçalho padronizado das subseções (Serviços / Prestadores) dentro
 * do card unificado. Mantém ícone, título, contador e ação rápida
 * alinhados na mesma baseline tanto no estado real quanto no de
 * carregamento — assim não há "salto" visual quando os dados chegam.
 */
function SubsectionHeader({
  id,
  icon: Icon,
  title,
  count,
  action,
}: SubsectionHeaderProps) {
  const isLoading = count === undefined;
  return (
    <div className="flex min-h-9 items-center gap-2 pb-1.5 border-b border-border/60">
      <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
      <h4
        id={id}
        className="text-xs font-semibold uppercase tracking-wide text-foreground/80 truncate"
      >
        {title}
      </h4>
      {isLoading ? (
        <span
          className={cn(SHIMMER_CLASS, 'ml-auto h-5 w-7 rounded-full shrink-0')}
          aria-hidden
        />
      ) : (
        <Badge
          variant={count > 0 ? 'secondary' : 'outline'}
          className={cn(
            'h-5 min-w-[22px] justify-center px-1.5 text-[11px] font-semibold tabular-nums shrink-0',
            action ? 'ml-auto' : 'ml-auto',
          )}
          aria-label={`${count} ${count === 1 ? 'item' : 'itens'}`}
        >
          {count}
        </Badge>
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
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
      <Label className="text-[11px] text-muted-foreground truncate">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // min-w-0 + w-full evitam que o picker nativo (iOS/Android)
        // imponha largura mínima e estoure o card no mobile.
        className="h-9 px-2 text-sm w-full min-w-0"
        disabled={disabled}
      />
    </div>
  );
}

// ============================================================
// Skeletons por seção
// ============================================================
//
// Cada seção do registro semanal renderiza seu próprio skeleton dentro
// do CollapsibleContent — assim o usuário já vê os 4 cabeçalhos reais
// (com ícone, título e badge shimmer) e cada bloco interno aparece
// independentemente quando seus dados terminam de carregar. Isso reduz
// a percepção de espera quando comparado a um skeleton único.
//
// Otimizações:
// - Markup pré-renderizado em constantes de módulo: o React reaproveita
//   o mesmo elemento em cada mount, sem recriar children.
// - `React.memo` em cada wrapper — sem props, nunca re-renderizam.
// - Classes shimmer congeladas em string única (sem `cn(...)` repetido).
// - `contain: paint` + `will-change: background-position` isolam a
//   pintura do gradiente em camada própria.
// - Renderização reduzida no mobile (1 linha por seção vs. 2 no desktop).

const SHIMMER_CLASS =
  'rounded-md bg-muted/70 overflow-hidden ' +
  'bg-[linear-gradient(90deg,hsl(var(--muted))_0%,hsl(var(--muted-foreground)/0.12)_50%,hsl(var(--muted))_100%)] ' +
  'bg-[length:200%_100%] animate-shimmer ' +
  'motion-reduce:animate-none motion-reduce:bg-muted ' +
  '[contain:paint] [will-change:background-position]';

const SKELETON_WRAPPER_CLASS =
  'flex flex-col gap-2 sm:gap-3 animate-fade-in motion-reduce:animate-none [contain:layout_paint]';

// ---- Linha (item) com header + dois inputs + textarea (Serviço/Prestador) ----
const LIST_ROW_SKELETON = (
  <div className="rounded-lg border border-border bg-card p-2.5 sm:p-3 flex flex-col gap-2 shadow-sm min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className={cn(SHIMMER_CLASS, 'h-3 w-20')} />
      <span className={cn(SHIMMER_CLASS, 'h-7 w-7 rounded-md')} />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2 min-w-0">
      <span className={cn(SHIMMER_CLASS, 'h-9')} />
      <span className={cn(SHIMMER_CLASS, 'h-9')} />
    </div>
    <div className="grid grid-cols-2 gap-2 min-w-0">
      <span className={cn(SHIMMER_CLASS, 'h-9')} />
      <span className={cn(SHIMMER_CLASS, 'h-9')} />
    </div>
    <span className={cn(SHIMMER_CLASS, 'h-14 w-full')} />
  </div>
);

// Alturas mínimas pré-calculadas para cada bloco — reservam o espaço
// vertical exato (aprox.) do conteúdo final, evitando layout shift quando
// os dados chegam e a seção troca o skeleton pelo formulário real.
const ServicesSkeleton = memo(function ServicesSkeleton() {
  return (
    <div
      className={cn(SKELETON_WRAPPER_CLASS, 'min-h-[300px]')}
      role="status"
      aria-busy="true"
      aria-label="Carregando serviços em execução"
    >
      <SubsectionHeader
        id="subsec-services-skeleton"
        icon={ClipboardList}
        title="Serviços em execução"
      />
      {LIST_ROW_SKELETON}
      <span className={cn(SHIMMER_CLASS, 'h-9 w-full sm:w-40')} />
    </div>
  );
});

const WorkersSkeleton = memo(function WorkersSkeleton() {
  return (
    <div
      className={cn(SKELETON_WRAPPER_CLASS, 'min-h-[300px]')}
      role="status"
      aria-busy="true"
      aria-label="Carregando prestadores no local"
    >
      <SubsectionHeader
        id="subsec-workers-skeleton"
        icon={HardHat}
        title="Prestadores no local"
      />
      {LIST_ROW_SKELETON}
      <span className={cn(SHIMMER_CLASS, 'h-9 w-full sm:w-40')} />
    </div>
  );
});

const TextareaSkeleton = memo(function TextareaSkeleton() {
  return (
    <div
      className={cn(SKELETON_WRAPPER_CLASS, 'min-h-[88px]')}
      role="status"
      aria-busy="true"
      aria-label="Carregando conteúdo"
    >
      <span className={cn(SHIMMER_CLASS, 'h-[88px] w-full')} />
    </div>
  );
});
