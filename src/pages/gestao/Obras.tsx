/**
 * Obras — Fase 5 da reformulação do processo core.
 *
 * "Como estão as obras" em 10 segundos: uma linha por obra, ordenada por
 * risco, com responsável, entrega (prazo do contrato em dias úteis), folga,
 * o que acontece na semana e o alerta mais importante. Tocar na obra abre a
 * Semana dela. Topo: obras ativas · no vermelho · multa projetada.
 *
 * Substitui o PainelObras para quem está no menu simples quando a flag
 * `novoPainelObras` está ligada. O painel antigo continua em
 * /gestao/painel-obras ("Painel completo").
 *
 * Interna (StaffRoute + RLS). O cliente não vê folga nem multa.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, LayoutGrid } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useObrasPainel } from "@/hooks/useObrasPainel";
import { mondayOf, planningMonday, weekLabel, weekRange } from "@/lib/semanaPlan";
import { shiftISODate, todayISO } from "@/lib/hojeDia";
import { formatBRL, summarize, type ObraRow } from "@/lib/obrasPainel";
import { ObrasCards, ObrasTable } from "@/components/gestao/obras/ObrasList";

const SCOPE_KEY = "bwild.obras.escopo";
type Scope = "minhas" | "todas";

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-[40px] rounded-md px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Obras() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();

  // Semana: "esta" (padrão; no fim de semana já é a que vai começar) ou "próxima".
  const thisMonday = mondayOf(todayISO());
  const baseMonday = planningMonday();
  const weekChoice = params.get("semana") === "proxima" ? "proxima" : "esta";
  const monday = weekChoice === "proxima" ? shiftISODate(baseMonday, 7) : baseMonday;
  const week = useMemo(() => weekRange(monday), [monday]);

  const { rows, isLoading, error, refetch } = useObrasPainel(week);

  // Escopo: minhas obras (responsável) ou todas. Lembra a escolha.
  const mineCount = useMemo(() => rows.filter((r) => user?.id && r.responsibleId === user.id).length, [rows, user?.id]);
  const [scope, setScope] = useState<Scope | null>(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(SCOPE_KEY) : null;
    return v === "minhas" || v === "todas" ? v : null;
  });
  const effectiveScope: Scope = scope ?? (mineCount > 0 ? "minhas" : "todas");
  useEffect(() => {
    if (scope) window.localStorage.setItem(SCOPE_KEY, scope);
  }, [scope]);

  const visible = useMemo<ObraRow[]>(
    () => (effectiveScope === "minhas" ? rows.filter((r) => r.responsibleId === user?.id) : rows),
    [rows, effectiveScope, user?.id],
  );
  const sum = summarize(visible);
  const hrefFor = (r: ObraRow) => `/gestao/semana?obra=${r.id}&semana=${monday}`;

  const setWeek = (v: "esta" | "proxima") => {
    const next = new URLSearchParams(params);
    if (v === "proxima") next.set("semana", "proxima");
    else next.delete("semana");
    setParams(next, { replace: true });
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Obras"
        title="Como estão as obras"
        description="Da mais arriscada para a mais tranquila. Toque numa obra para ver e planejar a semana dela."
        actions={
          <Button asChild variant="ghost" className="min-h-[44px] text-muted-foreground">
            <Link to="/gestao/painel-obras">
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              Painel completo
            </Link>
          </Button>
        }
      />

      {/* Topo: só três números. */}
      <dl className="mt-5 grid grid-cols-3 gap-2" aria-label="Resumo das obras">
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs font-medium text-muted-foreground">Obras ativas</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-2xl">{isLoading ? "–" : sum.active}</dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs font-medium text-muted-foreground">No vermelho</dt>
          <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums sm:text-2xl", sum.red > 0 ? "text-destructive" : "text-foreground")}>
            {isLoading ? "–" : sum.red}
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs font-medium text-muted-foreground">Multa projetada</dt>
          <dd
            className={cn(
              "mt-0.5 break-words text-lg font-semibold leading-tight tabular-nums sm:text-2xl",
              sum.penaltyTotal > 0 ? "text-destructive" : "text-foreground",
            )}
          >
            {isLoading ? "–" : formatBRL(sum.penaltyTotal)}
          </dd>
          {!isLoading && sum.penaltyUnknown > 0 && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              +{sum.penaltyUnknown} {sum.penaltyUnknown === 1 ? "obra atrasada" : "obras atrasadas"} sem multa no contrato
            </dd>
          )}
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Segmented<Scope>
          label="Quais obras"
          value={effectiveScope}
          onChange={setScope}
          options={[
            { value: "minhas", label: `Minhas obras${mineCount ? ` (${mineCount})` : ""}`, disabled: mineCount === 0 },
            { value: "todas", label: `Todas (${rows.length})` },
          ]}
        />
        <Segmented<"esta" | "proxima">
          label="Semana"
          value={weekChoice}
          onChange={setWeek}
          options={[
            { value: "esta", label: baseMonday === thisMonday ? "Esta semana" : "Próxima semana" },
            { value: "proxima", label: baseMonday === thisMonday ? "Próxima semana" : "A seguinte" },
          ]}
        />
        <span className="text-sm text-muted-foreground">
          {weekLabel(monday)}
          {!isLoading && sum.unplanned > 0 && (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {sum.unplanned} {sum.unplanned === 1 ? "obra sem semana planejada" : "obras sem semana planejada"}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando obras">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Building2}
            title="Não deu para carregar as obras"
            description={error}
            action={{ label: "Tentar de novo", onClick: refetch }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma obra em execução"
            description="Quando uma obra começa, ela aparece aqui com prazo, folga e o que acontece na semana."
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Você não é responsável por nenhuma obra ativa"
            action={{ label: "Ver todas", onClick: () => setScope("todas") }}
          />
        ) : isMobile ? (
          <ObrasCards rows={visible} hrefFor={hrefFor} />
        ) : (
          <ObrasTable rows={visible} hrefFor={hrefFor} />
        )}
      </div>

      {!isLoading && visible.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Folga = dias úteis entre o término projetado (fim do cronograma + atraso da etapa mais atrasada) e a entrega do
          contrato. O ponto mostra a situação da obra: vermelho = atrasando ou crítica não feita · amarelo = folga curta,
          material faltando ou prazo correndo mais rápido que o avanço · verde = tranquila. "Não planejada" = nada marcado
          na semana.
        </p>
      )}
    </PageContainer>
  );
}
