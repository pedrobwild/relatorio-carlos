/**
 * DailyLogDialog \u2014 modal para registrar o "di\u00e1rio do dia" de uma obra.
 *
 * Estrutura:
 *   - Cabe\u00e7alho: nome da obra/cliente + seletor de data
 *   - Se\u00e7\u00f5es colaps\u00e1veis (Collapsible):
 *       \u2022 Servi\u00e7os em execu\u00e7\u00e3o
 *       \u2022 Prestadores no local
 *       \u2022 Observa\u00e7\u00f5es gerais
 *   - Rodap\u00e9: Cancelar / Salvar
 *
 * Padr\u00f5es de UX:
 *   - Cada item de lista tem seu pr\u00f3prio cart\u00e3o com bot\u00e3o "Remover".
 *   - "Adicionar" cria um item em branco e j\u00e1 foca no primeiro campo.
 *   - Estado local (n\u00e3o autosave): o usu\u00e1rio revisa e clica em Salvar.
 *     Isso evita inconsist\u00eancia se ele fechar no meio do preenchimento.
 *   - Todas as se\u00e7\u00f5es abrem por padr\u00e3o, para visibilidade imediata.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  HardHat,
  Loader2,
  MessageSquareText,
  Plus,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export interface DailyLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;      // "Cliente \u2013 Nome da obra"
  /** Data inicial no formato ISO (YYYY-MM-DD). Default = hoje. */
  initialDate?: string;
}

const SERVICE_STATUS_OPTIONS: Exclude<DailyLogServiceStatus, null>[] = [
  'Em andamento',
  'Conclu\u00eddo',
  'Parado',
];

const todayIso = () => format(new Date(), 'yyyy-MM-dd');

// ----- componente -----

export function DailyLogDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  initialDate,
}: DailyLogDialogProps) {
  const [logDate, setLogDate] = useState(initialDate ?? todayIso());

  // Reseta a data quando o modal abre (com base no prop)
  useEffect(() => {
    if (open) setLogDate(initialDate ?? todayIso());
  }, [open, initialDate]);

  const { data, isLoading } = useProjectDailyLog(open ? projectId : null, logDate);
  const saveMutation = useSaveProjectDailyLog();

  // ----- estado local edit\u00e1vel -----
  const [notes, setNotes] = useState<string>('');
  const [services, setServices] = useState<DailyLogService[]>([]);
  const [workers, setWorkers] = useState<DailyLogWorker[]>([]);

  // sincroniza local com data carregada
  useEffect(() => {
    if (data) {
      setNotes(data.notes ?? '');
      setServices(data.services);
      setWorkers(data.workers);
    }
  }, [data]);

  const isSaving = saveMutation.isPending;
  const isBusy = isLoading || isSaving;

  const hasContent = useMemo(
    () => services.length > 0 || workers.length > 0 || notes.trim().length > 0,
    [services, workers, notes],
  );

  // ----- a\u00e7\u00f5es servi\u00e7os -----
  const addService = () =>
    setServices((curr) => [
      ...curr,
      {
        description: '',
        status: 'Em andamento',
        observations: null,
        position: curr.length,
      },
    ]);
  const updateService = (index: number, patch: Partial<DailyLogService>) =>
    setServices((curr) =>
      curr.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  const removeService = (index: number) =>
    setServices((curr) => curr.filter((_, i) => i !== index));

  // ----- a\u00e7\u00f5es prestadores -----
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
    // sanea entradas vazias
    const cleanedServices = services
      .map((s, idx) => ({ ...s, position: idx }))
      .filter((s) => s.description.trim().length > 0);

    const cleanedWorkers = workers
      .map((w, idx) => ({ ...w, position: idx }))
      .filter((w) => w.name.trim().length > 0);

    await saveMutation.mutateAsync({
      project_id: projectId,
      log_date: logDate,
      notes: notes.trim() ? notes.trim() : null,
      services: cleanedServices,
      workers: cleanedWorkers,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Registro do dia</DialogTitle>
          <DialogDescription className="text-xs">
            {projectTitle}
          </DialogDescription>
        </DialogHeader>

        {/* Data do registro */}
        <div className="flex items-center gap-3 py-2">
          <Label htmlFor="daily-log-date" className="text-xs font-medium">
            Data
          </Label>
          <Input
            id="daily-log-date"
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="h-8 w-auto text-sm"
            disabled={isSaving}
          />
          {data?.updated_at && (
            <span className="text-xs text-muted-foreground ml-auto">
              Atualizado em{' '}
              {format(parseISO(data.updated_at), "dd/MM/yyyy '\u00e0s' HH:mm", {
                locale: ptBR,
              })}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3 py-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Servi\u00e7os em execu\u00e7\u00e3o */}
            <SectionCard
              icon={<ClipboardList className="h-4 w-4 text-primary" />}
              title="Servi\u00e7os em execu\u00e7\u00e3o"
              count={services.length}
              defaultOpen
            >
              <div className="flex flex-col gap-3">
                {services.length === 0 && (
                  <EmptyLine text="Nenhum servi\u00e7o adicionado." />
                )}
                {services.map((svc, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-muted/20 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                        <Input
                          value={svc.description}
                          placeholder="Ex.: Instala\u00e7\u00e3o el\u00e9trica \u2013 quarto 2"
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
                        title="Remover servi\u00e7o"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      value={svc.observations ?? ''}
                      placeholder="Observa\u00e7\u00f5es (opcional)"
                      onChange={(e) =>
                        updateService(i, {
                          observations: e.target.value || null,
                        })
                      }
                      className="min-h-[60px] text-sm"
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
                  Adicionar servi\u00e7o
                </Button>
              </div>
            </SectionCard>

            {/* Prestadores no local */}
            <SectionCard
              icon={<HardHat className="h-4 w-4 text-primary" />}
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
                    className="rounded-md border border-border bg-muted/20 p-3 flex flex-col gap-2"
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
                          placeholder="Fun\u00e7\u00e3o / empresa"
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
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Per\u00edodo de
                        </Label>
                        <Input
                          type="date"
                          value={wk.period_start ?? ''}
                          onChange={(e) =>
                            updateWorker(i, {
                              period_start: e.target.value || null,
                            })
                          }
                          className="h-8 text-xs"
                          disabled={isSaving}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          at\u00e9
                        </Label>
                        <Input
                          type="date"
                          value={wk.period_end ?? ''}
                          onChange={(e) =>
                            updateWorker(i, {
                              period_end: e.target.value || null,
                            })
                          }
                          className="h-8 text-xs"
                          disabled={isSaving}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Entrada
                        </Label>
                        <Input
                          type="time"
                          value={wk.shift_start ?? ''}
                          onChange={(e) =>
                            updateWorker(i, {
                              shift_start: e.target.value || null,
                            })
                          }
                          className="h-8 text-xs"
                          disabled={isSaving}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label className="text-[11px] text-muted-foreground">
                          Sa\u00edda
                        </Label>
                        <Input
                          type="time"
                          value={wk.shift_end ?? ''}
                          onChange={(e) =>
                            updateWorker(i, {
                              shift_end: e.target.value || null,
                            })
                          }
                          className="h-8 text-xs"
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                    <Textarea
                      value={wk.notes ?? ''}
                      placeholder="Observa\u00e7\u00f5es do prestador (opcional)"
                      onChange={(e) =>
                        updateWorker(i, { notes: e.target.value || null })
                      }
                      className="min-h-[48px] text-sm"
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

            {/* Observa\u00e7\u00f5es */}
            <SectionCard
              icon={<MessageSquareText className="h-4 w-4 text-primary" />}
              title="Observa\u00e7\u00f5es gerais"
              defaultOpen={!!notes}
            >
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Relato livre do dia \u2014 incidentes, decis\u00f5es, fotos etc."
                className="min-h-[100px] text-sm"
                disabled={isSaving}
              />
            </SectionCard>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isBusy || !hasContent}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <div className="rounded-md border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/40 transition-colors rounded-t-md"
          >
            {icon}
            <span className="text-sm font-medium">{title}</span>
            {typeof count === 'number' && count > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums ml-1">
                ({count})
              </span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground ml-auto transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">{children}</div>
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
