/**
 * Lookahead — cockpit staff das próximas 2-3 semanas.
 *
 * Mostra todas as atividades de cronograma cujo `planned_start` cai entre
 * hoje e +14/21 dias, em todas as obras acessíveis (RLS aplica escopo).
 * Agrupamento por semana ISO, ações rápidas por linha.
 */
import { useMemo, useState } from "react";
import {
  CalendarRange,
  ListChecks,
  RefreshCw,
  UserX,
} from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useLookahead } from "@/hooks/useLookahead";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import { LookaheadRow } from "@/components/gestao/lookahead/LookaheadRow";

function formatWeekLabel(weekStart: Date): string {
  const d = String(weekStart.getDate()).padStart(2, "0");
  const m = String(weekStart.getMonth() + 1).padStart(2, "0");
  return `Semana de ${d}/${m}`;
}

interface MultiFilterProps {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

function MultiFilter({
  label,
  options,
  selected,
  onChange,
  disabled,
}: MultiFilterProps) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };
  const hint =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.name ?? "1")
        : `${selected.length} selecionados`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-11 gap-1.5 text-xs",
            selected.length > 0 &&
              "border-primary/40 bg-primary/5 text-primary",
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-semibold truncate max-w-[160px]">{hint}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="max-h-72 overflow-y-auto p-1">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">
              Nenhuma opção
            </div>
          ) : (
            options.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-2 rounded px-2 py-2 text-sm hover:bg-accent/50 cursor-pointer min-h-[44px]"
              >
                <Checkbox
                  checked={selected.includes(o.id)}
                  onCheckedChange={() => toggle(o.id)}
                />
                <span className="truncate">{o.name}</span>
              </label>
            ))
          )}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function Lookahead() {
  const [windowDays, setWindowDays] = useState<14 | 21>(14);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
  const [onlyWithoutResponsible, setOnlyWithoutResponsible] = useState(false);

  const { data: staff = [] } = useStaffUsers();
  const staffOptions = useMemo(
    () => staff.map((u) => ({ id: u.id, name: u.nome })),
    [staff],
  );

  const {
    weeks,
    totalCount,
    projectOptions,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useLookahead(windowDays, {
    projectIds,
    responsibleIds,
    onlyWithoutResponsible,
  });

  const hasFilters =
    projectIds.length > 0 ||
    responsibleIds.length > 0 ||
    onlyWithoutResponsible;

  return (
    <PageContainer maxWidth="xl" as="main">
      <PageHeader
        eyebrow="Meu trabalho"
        title="Lookahead"
        description="Atividades planejadas para os próximos dias em todas as obras."
        meta={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            <span className="tabular-nums">
              {totalCount} {totalCount === 1 ? "atividade" : "atividades"}
            </span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Janela do lookahead"
              className="inline-flex items-center rounded-md border border-border-subtle p-0.5"
            >
              {([14, 21] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWindowDays(d)}
                  className={cn(
                    "h-9 min-w-[56px] px-3 text-xs font-medium rounded-sm transition-colors",
                    windowDays === d
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d} dias
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Recarregar"
              className="h-11 w-11 p-0"
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  isFetching && "animate-spin",
                )}
                aria-hidden
              />
            </Button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <MultiFilter
          label="Obra:"
          options={projectOptions}
          selected={projectIds}
          onChange={setProjectIds}
        />
        <MultiFilter
          label="Responsável:"
          options={staffOptions}
          selected={responsibleIds}
          onChange={setResponsibleIds}
          disabled={onlyWithoutResponsible}
        />
        <button
          type="button"
          onClick={() => setOnlyWithoutResponsible((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 h-11 px-3 rounded-md border text-xs font-medium transition-colors",
            onlyWithoutResponsible
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-border-subtle text-muted-foreground hover:text-foreground hover:bg-accent/40",
          )}
          aria-pressed={onlyWithoutResponsible}
        >
          <UserX className="h-3.5 w-3.5" aria-hidden />
          Sem responsável
        </button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 text-xs"
            onClick={() => {
              setProjectIds([]);
              setResponsibleIds([]);
              setOnlyWithoutResponsible(false);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={CalendarRange}
            title="Não foi possível carregar o lookahead"
            description="Tente recarregar. Se persistir, avise o time técnico."
            action={{
              label: "Recarregar",
              icon: RefreshCw,
              onClick: () => refetch(),
            }}
          />
        ) : weeks.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Sem atividades nesta janela"
            description={
              hasFilters
                ? "Ajuste os filtros para ver mais resultados."
                : `Nada previsto para começar nos próximos ${windowDays} dias.`
            }
            {...(hasFilters
              ? {
                  action: {
                    label: "Limpar filtros",
                    onClick: () => {
                      setProjectIds([]);
                      setResponsibleIds([]);
                      setOnlyWithoutResponsible(false);
                    },
                  },
                }
              : {})}
          />
        ) : (
          <div className="space-y-6">
            {weeks.map((week) => (
              <section key={week.weekKey} aria-labelledby={`week-${week.weekKey}`}>
                <div className="flex items-center gap-2 mb-3">
                  <h2
                    id={`week-${week.weekKey}`}
                    className="text-sm font-semibold text-foreground"
                  >
                    {formatWeekLabel(week.weekStart)}
                  </h2>
                  <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full border border-border bg-muted text-muted-foreground text-[11px] font-semibold tabular-nums">
                    {week.activities.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {week.activities.map((a) => (
                    <LookaheadRow
                      key={a.id}
                      activity={a}
                      windowDays={windowDays}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
