/**
 * Painel de Obras (reformulado).
 *
 * "Como estão as obras" em 10 segundos: três números no topo e uma linha por
 * obra, ordenada por risco, com responsável, entrega do contrato, folga, o
 * que acontece na semana e o aviso mais importante. A situação (cor) é uma
 * só e é sempre calculada — nada de status digitado que contradiz o prazo.
 *
 * Quem usa:
 * - Gestor de obra (menu simples): só a lista em execução; tocar na obra
 *   abre a Semana dela.
 * - Escritório: busca, as listas Projetos e Concluídas, as visões Board e
 *   Kanban, e a gaveta da obra, onde fica tudo o que é digitado (responsável,
 *   etapa, relacionamento, obra paralisada, entrega real e demais datas).
 *
 * Abre em /gestao/painel-obras (e em /gestao/obras). O painel antigo continua
 * em /gestao/painel-obras?painel=antigo.
 *
 * Interna (StaffRoute + RLS). O cliente não vê folga nem multa.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader, EmptyState } from "@/components/ui-premium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCan } from "@/hooks/useCan";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMenuMode } from "@/hooks/useMenuMode";
import { useObrasPainel } from "@/hooks/useObrasPainel";
import { useStaffUsers } from "@/hooks/useStaffUsers";
import type { PainelEtapa, PainelObraPatch } from "@/hooks/usePainelObras";
import { planningMonday, weekLabel, weekRange } from "@/lib/semanaPlan";
import { shiftISODate } from "@/lib/hojeDia";
import { ddmm, formatBRL, GREEN_MIN_SLACK, slackLabel, summarize, type ObraRow } from "@/lib/obrasPainel";
import {
  groupByEtapa,
  KANBAN_ETAPAS,
  LISTA_LABEL,
  listaFromParams,
  PROJETO_PARADO_DIAS,
  searchConcluidas,
  searchObraRows,
  searchProjetos,
  staleLabel,
  VISAO_LABEL,
  visaoFromParams,
  type KanbanCardData,
  type PainelLista,
  type PainelVisao,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { ObrasCards, ObrasTable } from "@/components/gestao/obras/ObrasList";
import {
  ConcluidasCards,
  ConcluidasTable,
  ProjetosCards,
  ProjetosTable,
} from "@/components/gestao/obras/OutrasListas";
import { EtapaBoard } from "@/components/gestao/obras/EtapaBoard";
import { EtapaKanban } from "@/components/gestao/obras/EtapaKanban";
import { ObraDrawer } from "@/components/gestao/obras/ObraDrawer";

const SCOPE_KEY = "bwild.obras.escopo";
type Scope = "minhas" | "todas";

/** Endereço do painel antigo (mesma rota, com o parâmetro que o mantém). */
export const PAINEL_ANTIGO_HREF = "/gestao/painel-obras?painel=antigo";

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
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-card p-0.5"
    >
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
              "min-h-[40px] whitespace-nowrap rounded-md px-2.5 text-sm font-medium transition-colors sm:px-3",
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

/** Cartão do Kanban a partir da linha de uma obra em execução. */
function cardFromObra(r: ObraRow): KanbanCardData {
  const headline =
    r.slack == null
      ? r.risk === "sem_prazo"
        ? "Sem prazo cadastrado"
        : "Sem cronograma"
      : `${slackLabel(r.slack)}${r.deadline ? ` · entrega ${ddmm(r.deadline)}` : ""}`;
  return {
    id: r.id,
    name: r.name,
    customer: r.customer,
    responsible: r.responsible,
    etapa: r.cadastro?.etapa ?? null,
    risk: r.risk,
    headline,
    headlineTone: r.slack == null ? "muted" : r.slack < 0 ? "destructive" : r.slack < GREEN_MIN_SLACK ? "warning" : "success",
    alert: r.alerts.find((a) => a.tone !== "muted")?.text ?? null,
    paused: r.cadastro?.paused ?? false,
    relationship: r.cadastro?.relationship ?? null,
  };
}

/** Cartão do Kanban a partir de uma obra em fase de projeto. */
function cardFromProjeto(r: ProjetoRow): KanbanCardData {
  const parado = r.staleDays != null && r.staleDays >= PROJETO_PARADO_DIAS;
  return {
    id: r.id,
    name: r.name,
    customer: r.customer,
    responsible: r.responsible,
    etapa: r.etapa,
    risk: null,
    headline: r.staleDays == null ? "Sem registro de atualização" : `Atualizado ${staleLabel(r.staleDays).toLowerCase()}`,
    headlineTone: parado ? "warning" : "muted",
    alert: null,
    paused: r.paused,
    relationship: r.relationship,
  };
}

export default function Obras() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { isSimple } = useMenuMode();
  const { can } = useCan();
  const canEdit = can("projects:edit");
  /** Escritório: vê busca, outras listas, visões e a gaveta. */
  const office = !isSimple;
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const patchParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  // Semana: "esta" (padrão; no fim de semana já é a que vai começar) ou "próxima".
  const baseMonday = planningMonday();
  const weekChoice = params.get("semana") === "proxima" ? "proxima" : "esta";
  const monday = weekChoice === "proxima" ? shiftISODate(baseMonday, 7) : baseMonday;
  const week = useMemo(() => weekRange(monday), [monday]);

  const lista: PainelLista = office ? listaFromParams(params) : "execucao";
  const visao: PainelVisao = office && lista !== "concluidas" ? visaoFromParams(params) : "lista";

  const data = useObrasPainel(week);
  const { rows, projetos, concluidas, isLoading, error, refetch } = data;
  const { data: staff = [] } = useStaffUsers();

  // Escopo: minhas obras (responsável) ou todas. Lembra a escolha.
  const mine = <T extends { responsibleId: string | null }>(list: readonly T[]) =>
    list.filter((r) => !!user?.id && r.responsibleId === user.id);
  const current = lista === "execucao" ? rows : lista === "projetos" ? projetos : concluidas;
  const mineCount = mine<{ responsibleId: string | null }>(current).length;
  const [scope, setScope] = useState<Scope | null>(() => {
    // localStorage pode estar bloqueado (modo privado): a tela não pode cair por isso.
    try {
      const v = typeof window !== "undefined" ? window.localStorage.getItem(SCOPE_KEY) : null;
      return v === "minhas" || v === "todas" ? v : null;
    } catch {
      return null;
    }
  });
  const effectiveScope: Scope = scope ?? (mineCount > 0 ? "minhas" : "todas");
  useEffect(() => {
    if (!scope) return;
    try {
      window.localStorage.setItem(SCOPE_KEY, scope);
    } catch {
      /* sem armazenamento: só não lembra a escolha */
    }
  }, [scope]);
  const scoped = <T extends { responsibleId: string | null }>(list: readonly T[]) =>
    effectiveScope === "minhas" ? mine(list) : [...list];

  const scopedRows = useMemo(() => scoped(rows), [rows, effectiveScope, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Os três números do topo são sempre das obras em execução, sem a busca, e
  // não mudam ao trocar de lista: sem escolha explícita, o escopo deles é o
  // das obras em execução (e não o da lista aberta).
  const summaryScope: Scope = scope ?? (mine(rows).length > 0 ? "minhas" : "todas");
  const summaryRows = useMemo(
    () => (summaryScope === "minhas" ? mine(rows) : rows),
    [rows, summaryScope, user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sum = summarize(summaryRows);
  // Sem dados (carregando ou erro) os números do topo ficam em branco, não em zero.
  const noData = isLoading || !!error;

  const visibleRows = useMemo(() => searchObraRows(scopedRows, query), [scopedRows, query]);
  const visibleProjetos = useMemo(
    () => searchProjetos(scoped(projetos), query),
    [projetos, query, effectiveScope, user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visibleConcluidas = useMemo(
    () => searchConcluidas(scoped(concluidas), query),
    [concluidas, query, effectiveScope, user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visibleCount =
    lista === "execucao" ? visibleRows.length : lista === "projetos" ? visibleProjetos.length : visibleConcluidas.length;

  const weekHref = (r: ObraRow) => `/gestao/semana?obra=${r.id}&semana=${monday}`;

  // Gaveta da obra (só escritório): ?obra=<id>.
  const openId = office ? params.get("obra") : null;
  const openObra = (id: string) => patchParams({ obra: id });
  const openRow = openId ? rows.find((r) => r.id === openId) ?? null : null;

  const patchObra = (id: string, patch: PainelObraPatch) => data.updateObra(id, patch);
  const moveEtapa = (id: string, etapa: PainelEtapa | null) => {
    patchObra(id, { etapa })
      .then(() => toast.success(etapa ? `Etapa: ${etapa}` : "Etapa removida"))
      .catch(() => {
        /* o aviso de erro vem de quem grava */
      });
  };

  const setLista = (v: PainelLista) =>
    patchParams({ fase: v === "projetos" ? "projetos" : null, aba: v === "concluidas" ? "concluidas" : null });

  const emptyTitle: Record<PainelLista, string> = {
    execucao: "Nenhuma obra em execução",
    projetos: "Nenhuma obra em fase de projeto",
    concluidas: "Nenhuma obra concluída",
  };
  const emptyDescription: Record<PainelLista, string> = {
    execucao: "Quando uma obra começa, ela aparece aqui com prazo, folga e o que acontece na semana.",
    projetos: "Obras que ainda estão em projeto aparecem aqui, da mais parada para a mais recente.",
    concluidas: "Com a entrega real registrada, a obra passa para esta lista com o resultado contra o contrato.",
  };

  const renderLista = () => {
    if (lista === "concluidas") {
      return isMobile ? (
        <ConcluidasCards rows={visibleConcluidas} onOpen={openObra} />
      ) : (
        <ConcluidasTable rows={visibleConcluidas} onOpen={openObra} />
      );
    }

    if (visao === "kanban") {
      const cards = lista === "execucao" ? visibleRows.map(cardFromObra) : visibleProjetos.map(cardFromProjeto);
      return (
        <EtapaKanban
          groups={groupByEtapa(cards, (c) => c.etapa, KANBAN_ETAPAS[lista])}
          onOpen={openObra}
          onMove={canEdit ? moveEtapa : undefined}
        />
      );
    }

    if (lista === "projetos") {
      const list = (items: ProjetoRow[]) =>
        isMobile ? <ProjetosCards rows={items} onOpen={openObra} /> : <ProjetosTable rows={items} onOpen={openObra} />;
      if (visao === "board") {
        return <EtapaBoard groups={groupByEtapa(visibleProjetos, (r) => r.etapa)} renderGroup={(items) => list(items)} />;
      }
      return list(visibleProjetos);
    }

    const onOpen = office ? (r: ObraRow) => openObra(r.id) : undefined;
    if (visao === "board") {
      return (
        <EtapaBoard
          groups={groupByEtapa(visibleRows, (r) => r.cadastro?.etapa)}
          summary={(items) => {
            const red = items.filter((r) => r.risk === "vermelho").length;
            return red > 0 ? `${red} no vermelho` : null;
          }}
          renderGroup={(items, first) =>
            isMobile ? (
              <ObrasCards rows={items} weekHref={weekHref} onOpen={onOpen} />
            ) : (
              <ObrasTable rows={items} weekHref={weekHref} onOpen={onOpen} headless={!first} />
            )
          }
        />
      );
    }
    return isMobile ? (
      <ObrasCards rows={visibleRows} weekHref={weekHref} onOpen={onOpen} />
    ) : (
      <ObrasTable rows={visibleRows} weekHref={weekHref} onOpen={onOpen} />
    );
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        eyebrow="Painel de Obras"
        title="Como estão as obras"
        description={office ? undefined : "Da mais arriscada para a mais tranquila. Toque numa obra para ver e planejar a semana dela."}
        actions={
          office ? (
            <Button asChild className="min-h-[44px]">
              <Link to="/gestao/nova-obra">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nova obra
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Topo: só três números. */}
      <dl className="mt-5 grid grid-cols-3 gap-2" aria-label="Resumo das obras">
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs font-medium text-muted-foreground">Obras ativas</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground sm:text-2xl">{noData ? "–" : sum.active}</dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs font-medium text-muted-foreground">No vermelho</dt>
          <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums sm:text-2xl", sum.red > 0 ? "text-destructive" : "text-foreground")}>
            {noData ? "–" : sum.red}
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
            {noData ? "–" : formatBRL(sum.penaltyTotal)}
          </dd>
          {!noData && sum.penaltyUnknown > 0 && (
            <dd className="mt-0.5 text-xs text-muted-foreground">
              +{sum.penaltyUnknown} {sum.penaltyUnknown === 1 ? "obra atrasada" : "obras atrasadas"} sem multa no contrato
            </dd>
          )}
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {office && (
          <Segmented<PainelLista>
            label="Lista"
            value={lista}
            onChange={setLista}
            options={[
              { value: "execucao", label: `${LISTA_LABEL.execucao} (${rows.length})` },
              { value: "projetos", label: `${LISTA_LABEL.projetos} (${projetos.length})` },
              { value: "concluidas", label: `${LISTA_LABEL.concluidas} (${concluidas.length})` },
            ]}
          />
        )}
        <Segmented<Scope>
          label="Quais obras"
          value={effectiveScope}
          onChange={setScope}
          options={[
            { value: "minhas", label: `Minhas${mineCount ? ` (${mineCount})` : ""}`, disabled: mineCount === 0 },
            // No escritório o total já está na aba da lista; repetir só ocupa espaço.
            { value: "todas", label: office ? "Todas" : `Todas (${current.length})` },
          ]}
        />
        {office && (
          <div className="relative order-last min-w-[200px] basis-full sm:order-none sm:basis-0 sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar obra, cliente ou responsável"
              aria-label="Buscar obra, cliente ou responsável"
              className="min-h-[44px] pl-9"
            />
          </div>
        )}
        {office && lista !== "concluidas" && (
          <Segmented<PainelVisao>
            label="Visão"
            value={visao}
            onChange={(v) => patchParams({ view: v === "lista" ? null : v })}
            options={[
              { value: "lista", label: VISAO_LABEL.lista },
              { value: "board", label: VISAO_LABEL.board },
              { value: "kanban", label: VISAO_LABEL.kanban },
            ]}
          />
        )}
      </div>

      {lista === "execucao" && visao !== "kanban" && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>
            Semana de {weekLabel(monday)}
            {!isLoading && sum.unplanned > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {sum.unplanned} {sum.unplanned === 1 ? "obra sem semana planejada" : "obras sem semana planejada"}
                </span>
              </>
            )}
            {!isLoading && sum.unclosed > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {sum.unclosed} sem fechar a semana anterior
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            aria-pressed={weekChoice === "proxima"}
            onClick={() => patchParams({ semana: weekChoice === "proxima" ? null : "proxima" })}
            className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {weekChoice === "proxima" ? "Voltar à semana anterior" : "Ver a semana seguinte"}
          </button>
        </p>
      )}

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
        ) : current.length === 0 ? (
          <EmptyState icon={Building2} title={emptyTitle[lista]} description={emptyDescription[lista]} />
        ) : visibleCount === 0 && query.trim() ? (
          <EmptyState
            icon={Search}
            title={`Nada encontrado para "${query.trim()}"`}
            description="A busca olha o nome da obra, o cliente e o responsável."
            action={{ label: "Limpar busca", onClick: () => setQuery("") }}
          />
        ) : visibleCount === 0 ? (
          <EmptyState
            icon={Building2}
            title={
              lista === "execucao"
                ? "Você não é responsável por nenhuma obra ativa"
                : "Você não é responsável por nenhuma obra desta lista"
            }
            action={{ label: "Ver todas", onClick: () => setScope("todas") }}
          />
        ) : (
          renderLista()
        )}
      </div>

      {!isLoading && lista === "execucao" && visao !== "kanban" && visibleRows.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Folga = dias úteis entre o término projetado (fim do cronograma + atraso da etapa mais atrasada) e a entrega do
          contrato. O ponto mostra a situação da obra: vermelho = atrasando ou crítica não feita · amarelo = folga curta,
          material faltando ou prazo correndo mais rápido que o avanço · verde = tranquila. "Não planejada" = nada marcado
          na semana.
        </p>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        <Link
          to={PAINEL_ANTIGO_HREF}
          className="rounded-sm underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Abrir o painel antigo
        </Link>
      </p>

      {/* A gaveta espera só a primeira carga; depois fica montada mesmo durante recargas. */}
      {office && (!isLoading || data.obraById.size > 0) && (
        <ObraDrawer
          open={!!openId}
          onOpenChange={(o) => {
            if (!o) patchParams({ obra: null });
          }}
          obra={openId ? data.obraById.get(openId) ?? null : null}
          row={openRow}
          projeto={openId ? projetos.find((p) => p.id === openId) ?? null : null}
          concluida={openId ? concluidas.find((c) => c.id === openId) ?? null : null}
          staff={staff}
          canEdit={canEdit}
          onPatch={patchObra}
          weekHref={openRow ? weekHref(openRow) : undefined}
        />
      )}
    </PageContainer>
  );
}
