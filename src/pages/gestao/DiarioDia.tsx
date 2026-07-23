/**
 * /gestao/diario/:projectId/:date — RDO de um dia específico (staff-only).
 *
 * Formulário mobile-first para 2 minutos: clima, efetivo (workers) por
 * função, serviços do dia, ocorrências (notas livres). Reutiliza
 * useProjectDailyLog + useSaveProjectDailyLog. Fotos e export PDF ficam
 * para Onda C2.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CloudRain,
  CloudSun,
  HardHat,
  Plus,
  Save,
  Sun,
  Trash2,
  XOctagon,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import {
  DailyLogService,
  DailyLogServiceStatus,
  DailyLogWorker,
  useProjectDailyLog,
  useSaveProjectDailyLog,
  WeatherCondition,
} from "@/hooks/useProjectDailyLog";
import { cn } from "@/lib/utils";

const WEATHER_OPTIONS: {
  value: NonNullable<WeatherCondition>;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: "Ensolarado", label: "Ensolarado", Icon: Sun },
  { value: "Nublado", label: "Nublado", Icon: CloudSun },
  { value: "Chuva", label: "Chuva", Icon: CloudRain },
  { value: "Impraticável", label: "Impraticável", Icon: XOctagon },
];

const SERVICE_STATUS_OPTIONS: {
  value: NonNullable<DailyLogServiceStatus>;
  label: string;
}[] = [
  { value: "Em andamento", label: "Em andamento" },
  { value: "Concluído", label: "Concluído" },
  { value: "Parado", label: "Parado" },
];

function fmtLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface WeatherChipsProps {
  label: string;
  value: WeatherCondition;
  onChange: (value: WeatherCondition) => void;
}

function WeatherChips({ label, value, onChange }: WeatherChipsProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <div className="flex flex-wrap gap-2">
        {WEATHER_OPTIONS.map((opt) => {
          const active = value === opt.value;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? null : opt.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 h-11 rounded-md border text-sm transition-colors min-w-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary/10 border-primary text-primary font-medium"
                  : "bg-background border-input hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DiarioDia() {
  const { projectId = "", date = "" } = useParams();
  const navigate = useNavigate();

  const projectsQ = useProjectsQuery();
  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId),
    [projectsQ.data, projectId],
  );

  const logQ = useProjectDailyLog(projectId || null, date);
  const saveMutation = useSaveProjectDailyLog();

  // form state (rehidrata quando a query resolve)
  const [notes, setNotes] = useState<string>("");
  const [weatherMorning, setWeatherMorning] =
    useState<WeatherCondition>(null);
  const [weatherAfternoon, setWeatherAfternoon] =
    useState<WeatherCondition>(null);
  const [temperature, setTemperature] = useState<string>("");
  const [workers, setWorkers] = useState<DailyLogWorker[]>([]);
  const [services, setServices] = useState<DailyLogService[]>([]);

  useEffect(() => {
    const d = logQ.data;
    if (!d) return;
    setNotes(d.notes ?? "");
    setWeatherMorning(d.weather_morning);
    setWeatherAfternoon(d.weather_afternoon);
    setTemperature(
      d.temperature_c === null || d.temperature_c === undefined
        ? ""
        : String(d.temperature_c),
    );
    setWorkers(d.workers);
    setServices(d.services);
  }, [logQ.data]);

  const addWorker = () =>
    setWorkers((prev) => [
      ...prev,
      {
        name: "",
        role: "",
        period_start: null,
        period_end: null,
        shift_start: null,
        shift_end: null,
        notes: null,
        position: prev.length,
      },
    ]);

  const updateWorker = (
    idx: number,
    patch: Partial<DailyLogWorker>,
  ) =>
    setWorkers((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w)),
    );

  const removeWorker = (idx: number) =>
    setWorkers((prev) => prev.filter((_, i) => i !== idx));

  const addService = () =>
    setServices((prev) => [
      ...prev,
      {
        description: "",
        status: "Em andamento",
        observations: null,
        start_date: null,
        end_date: null,
        position: prev.length,
      },
    ]);

  const updateService = (
    idx: number,
    patch: Partial<DailyLogService>,
  ) =>
    setServices((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  const removeService = (idx: number) =>
    setServices((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!projectId || !date) return;
    // validações mínimas
    const cleanWorkers = workers.filter((w) => (w.name ?? "").trim());
    const cleanServices = services.filter(
      (s) => (s.description ?? "").trim(),
    );
    const parsedTemp = temperature.trim() ? Number(temperature) : null;
    if (temperature.trim() && Number.isNaN(parsedTemp)) {
      toast.error("Temperatura inválida");
      return;
    }

    await saveMutation.mutateAsync({
      project_id: projectId,
      log_date: date,
      notes: notes.trim() || null,
      weather_morning: weatherMorning,
      weather_afternoon: weatherAfternoon,
      temperature_c: parsedTemp,
      workers: cleanWorkers.map((w, i) => ({ ...w, position: i })),
      services: cleanServices.map((s, i) => ({ ...s, position: i })),
    });
  };

  const totalWorkers = workers.filter((w) => (w.name ?? "").trim()).length;

  return (
    <PageContainer>
      <div className="mb-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-9 -ml-2 text-muted-foreground"
        >
          <Link to="/gestao/diario">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar ao diário
          </Link>
        </Button>
      </div>

      <PageHeader
        title={project?.name ?? "Diário do dia"}
        description={date ? fmtLongDate(date) : ""}
      />

      {logQ.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-4 pb-24">
          {/* Clima */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Clima do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <WeatherChips
                label="Manhã"
                value={weatherMorning}
                onChange={setWeatherMorning}
              />
              <WeatherChips
                label="Tarde"
                value={weatherAfternoon}
                onChange={setWeatherAfternoon}
              />
              <div className="max-w-[180px]">
                <Label
                  htmlFor="temperature"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Temperatura (°C)
                </Label>
                <Input
                  id="temperature"
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="Ex.: 27"
                  className="h-11 mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Efetivo */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                Efetivo
                {totalWorkers > 0 && (
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    ({totalWorkers} {totalWorkers === 1 ? "pessoa" : "pessoas"})
                  </span>
                )}
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={addWorker}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {workers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ninguém no efetivo do dia. Toque em Adicionar para incluir.
                </p>
              ) : (
                workers.map((w, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-start"
                  >
                    <Input
                      value={w.name}
                      onChange={(e) =>
                        updateWorker(idx, { name: e.target.value })
                      }
                      placeholder="Nome ou empreiteira"
                      className="h-11"
                    />
                    <Input
                      value={w.role ?? ""}
                      onChange={(e) =>
                        updateWorker(idx, { role: e.target.value || null })
                      }
                      placeholder="Função (ex.: Pedreiro, Eletricista)"
                      className="h-11"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-destructive"
                      onClick={() => removeWorker(idx)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Serviços */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Serviços executados</CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9"
                onClick={addService}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum serviço registrado hoje.
                </p>
              ) : (
                services.map((s, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 border rounded-md p-3 bg-background"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 items-start">
                      <Input
                        value={s.description}
                        onChange={(e) =>
                          updateService(idx, { description: e.target.value })
                        }
                        placeholder="Descrição do serviço"
                        className="h-11"
                      />
                      <Select
                        value={s.status ?? "Em andamento"}
                        onValueChange={(v) =>
                          updateService(idx, {
                            status: v as DailyLogServiceStatus,
                          })
                        }
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {SERVICE_STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-muted-foreground hover:text-destructive"
                        onClick={() => removeService(idx)}
                        aria-label="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={s.observations ?? ""}
                      onChange={(e) =>
                        updateService(idx, {
                          observations: e.target.value || null,
                        })
                      }
                      placeholder="Observações (opcional)"
                      className="min-h-[64px]"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Ocorrências / notas livres */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Ocorrências e impedimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Registre paradas, atrasos, visitas, incidentes de segurança ou observações do dia."
                className="min-h-[120px]"
              />
            </CardContent>
          </Card>

          {/* Barra de ações fixa no rodapé em mobile */}
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-30 px-4 py-3 border-t bg-background/95 backdrop-blur",
              "flex items-center justify-between gap-2",
              "pb-[calc(env(safe-area-inset-bottom)+var(--bottom-nav-offset,0px)+12px)]",
            )}
          >
            <div className="text-xs text-muted-foreground">
              {logQ.data?.updated_at
                ? `Atualizado em ${new Date(logQ.data.updated_at).toLocaleString("pt-BR")}`
                : "Novo registro"}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/gestao/diario")}
                className="h-11"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="h-11"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {saveMutation.isPending ? "Salvando…" : "Salvar RDO"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
