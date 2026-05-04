/**
 * NonWorkingDaysDialog — gerencia dias não úteis (feriados específicos / folgas)
 * usados pelo Calendário interno para bloquear a criação de micro-etapas que
 * cubram dias improdutivos.
 *
 * Escopo de cada entrada:
 *  - Global: aplica-se a todas as obras (project_id = NULL)
 *  - Obra específica: aplica-se apenas àquela obra
 *
 * Permissão: Admin/Engineer (a UI já é gated antes de abrir; a RLS reforça).
 */

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarOff,
  CalendarIcon,
  Plus,
  Trash2,
  Globe2,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useNonWorkingDays,
  type NonWorkingDay,
} from "@/hooks/useNonWorkingDays";

interface ProjectOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
}

export function NonWorkingDaysDialog({ open, onOpenChange, projects }: Props) {
  const { all, isLoading, create, isCreating, remove, isRemoving } =
    useNonWorkingDays();
  const [day, setDay] = useState<Date | undefined>(new Date());
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<string>("__global__");

  const handleAdd = async () => {
    if (!day) return;
    await create({
      project_id: scope === "__global__" ? null : scope,
      day: format(day, "yyyy-MM-dd"),
      reason: reason.trim() || null,
    });
    setReason("");
  };

  const projectName = (id: string | null) => {
    if (!id) return null;
    return projects.find((p) => p.id === id)?.name ?? "Obra desconhecida";
  };

  // Ordena: futuros primeiro (asc), depois passados (desc).
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const future: NonWorkingDay[] = [];
  const past: NonWorkingDay[] = [];
  for (const d of all) (d.day >= todayKey ? future : past).push(d);
  past.reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-primary" />
            <DialogTitle>Dias não úteis</DialogTitle>
          </div>
          <DialogDescription>
            Registre feriados específicos ou folgas para bloquear a criação de
            micro-etapas em dias improdutivos. Entradas globais valem para todas
            as obras; entradas por obra são aplicadas apenas àquele projeto.
          </DialogDescription>
        </DialogHeader>

        {/* Form para adicionar nova entrada */}
        <div className="rounded-lg border bg-card p-3 space-y-3">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-4">
              <Label className="text-[11px] text-muted-foreground">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left font-normal mt-1"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                    {day ? format(day, "dd/MM/yyyy") : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={day}
                    onSelect={setDay}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="col-span-12 sm:col-span-4">
              <Label className="text-[11px] text-muted-foreground">
                Escopo
              </Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value="__global__">
                    <span className="inline-flex items-center gap-2">
                      <Globe2 className="h-3.5 w-3.5" />
                      Todas as obras (global)
                    </span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="inline-flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-12 sm:col-span-4">
              <Label className="text-[11px] text-muted-foreground">
                Motivo (opcional)
              </Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex.: Folga emenda, manutenção"
                className="mt-1 h-9"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleAdd} disabled={!day || isCreating} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Adicionar dia não útil
            </Button>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Carregando…
            </p>
          ) : all.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum dia não útil cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-4 pb-2">
              {future.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Próximos
                  </h3>
                  <ul className="space-y-1.5">
                    {future.map((d) => (
                      <DayRow
                        key={d.id}
                        d={d}
                        projectName={projectName(d.project_id)}
                        onRemove={() => remove(d.id)}
                        disabled={isRemoving}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Passados
                  </h3>
                  <ul className="space-y-1.5 opacity-70">
                    {past.map((d) => (
                      <DayRow
                        key={d.id}
                        d={d}
                        projectName={projectName(d.project_id)}
                        onRemove={() => remove(d.id)}
                        disabled={isRemoving}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DayRow({
  d,
  projectName,
  onRemove,
  disabled,
}: {
  d: NonWorkingDay;
  projectName: string | null;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <CalendarOff className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">
          {format(parseISO(d.day), "EEEE, dd 'de' MMM 'de' yyyy", {
            locale: ptBR,
          })}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {d.project_id === null ? (
            <Badge variant="outline" className="text-[10px]">
              <Globe2 className="h-3 w-3 mr-1" />
              Global
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="text-[10px] max-w-[200px] truncate"
            >
              <Building2 className="h-3 w-3 mr-1 shrink-0" />
              <span className="truncate">{projectName}</span>
            </Badge>
          )}
          {d.reason && (
            <span className="text-[11px] text-muted-foreground">
              {d.reason}
            </span>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="text-muted-foreground hover:text-destructive shrink-0"
        title="Remover"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
