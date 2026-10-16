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
 *   Em Projetos, cada obra mostra em que etapa da fase de projeto está, com
 *   quem e se o prazo da etapa venceu; arrastar no Kanban posiciona a obra
 *   numa etapa.
 *
 * Abre em /gestao/painel-obras (e em /gestao/obras). O painel antigo continua
 * em /gestao/painel-obras?painel=antigo.
 *
 * Interna (StaffRoute + RLS). O cliente não vê folga nem multa.
 */
import { useEffect, useMemo, useState } from "react";
import { useOpsScreenViewed } from "@/hooks/useOpsScreenViewed";
import { Link, useSearchParams } from "react-router-dom";
import { Building2, Newspaper, Plus, Search } from "lucide-react";
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
import { phaseStepLabel } from "@/lib/faseProjeto";
import { planningMonday, weekLabel, weekRange } from "@/lib/semanaPlan";
import { shiftISODate } from "@/lib/hojeDia";
import { ddmm, formatBRL, GREEN_MIN_SLACK, slackLabel, summarize, type ObraRow } from "@/lib/obrasPainel";
import {
  aprovacaoRegistrada,
  etapaOfKey,
  FASE_DESCONHECIDA,
  FASE_PRONTA,
  FASE_SEM_REGISTRO,
  groupByEtapa,
  groupByFase,
  isPhaseStepKey,
  KANBAN_ETAPAS,
  LISTA_LABEL,
  listaFromParams,
  PROJETO_PARADO_DIAS,
  projetoRegistrado,
  projetoResponsavel,
  projetosResumoText,
  searchConcluidas,
  searchObraRows,
  searchProjetos,
  staleLabel,
  VISAO_LABEL,
  visaoFromParams,
  type EtapaKey,
  type KanbanCardData,
  type PainelLista,
  type PainelVisao,
  type ProjetoRow,
} from "@/lib/painelNovo";
import { EtapaLegend, ObrasCards, ObrasTable } from "@/components/gestao/obras/ObrasList";
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

/**
 * Cartão do Kanban a partir de uma obra em fase de projeto: a etiqueta é a
 * situação da etapa atual e a linha de baixo, o prazo dela. Obra sem etapa
 * registrada (ou com as etapas ainda desconhecidas) mostra há quanto tempo
 * está sem atualização, como antes.
 */
function cardFromProjeto(r: ProjetoRow): KanbanCardData {
  const registered = projetoRegistrado(r);
  const parado = r.staleDays != null && r.staleDays >= PROJETO_PARADO_DIAS;
  const pronta = r.verdict?.verdict === "pronta";
  const headline = !registered
    ? r.staleDays == null
      ? "Sem registro de atualização"
      : `Atualizado ${staleLabel(r.staleDays).toLowerCase()}`
    : pronta
      ? r.officialStart
        ? `Início oficial ${ddmm(r.officialStart)}/${r.officialStart.slice(0, 4)}`
        : ""
      : r.dueDate
        ? `Prazo ${ddmm(r.dueDate)}/${r.dueDate.slice(2, 4)}`
        : "";
  return {
    id: r.id,
    name: r.name,
    customer: r.customer,
    responsible: projetoResponsavel(r),
    etapa: r.etapa,
    risk: null,
    headline,
    headlineTone: !registered && parado ? "warning" : "muted",
    alert: null,
    paused: r.paused,
    relationship: r.relationship,
    fase: r.verdict,
    // Com a aprovação do condomínio já registrada, mudar de etapa reabriria a
    // aprovação e o início oficial: só pela gaveta. Sem as etapas, não há de
    // onde mover.
    locked: !r.phase || aprovacaoRegistrada(r),
  };
}

/** Por que a gaveta abriu ao soltar um cartão em "Pronta para iniciar". */
const AVISO_PRONTA =
  "Arrastar para “Pronta para iniciar” não grava nada. Conclua as etapas aqui e informe o dia em que a aprovação do condomínio chegou: é essa data que define o início oficial da obra.";

export default function Obras() {
  useOpsScreenViewed("obras");
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { isSimple } = useMenuMode();
  const { can } = useCan();
  const canEdit = can("projects:edit");
  const canEditPhase = can("projectPhase:edit");
  const canResumo = can("portfolio:resumo");
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
  const { rows, projetos, concluidas, isLoading, error, refetch, phaseStatus } = data;
  const { data: staff = [] } = useStaffUsers();

  // Escopo: minhas obras (responsável) ou todas. Lembra a escolha. Em Projetos,
  // também é "minha" a obra cuja etapa atual está comigo.
  type Owned = { responsibleId: string | null; stepResponsibleId?: string | null };
  const mine = <T extends Owned>(list: readonly T[]) =>
    list.filter((r) => !!user?.id && (r.responsibleId === user.id || r.stepResponsibleId === user.id));
  const current = lista === "execucao" ? rows : lista === "projetos" ? projetos : concluidas;
  const mineCount = mine<Owned>(current).length;
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
  const scoped = <T extends Owned>(list: readonly T[]) => (effectiveScope === "minhas" ? mine(list) : [...list]);

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
  const scopedProjetos = useMemo(() => scoped(projetos), [projetos, effectiveScope, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibleProjetos = useMemo(() => searchProjetos(scopedProjetos, query), [scopedProjetos, query]);
  // Linha acima da lista de Projetos: como a dos três números, não muda com a busca.
  const projetosResumo = useMemo(() => projetosResumoText(scopedProjetos), [scopedProjetos]);
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
  /** Obra cuja gaveta abriu por soltar o cartão em "Pronta para iniciar". */
  const [prontaAviso, setProntaAviso] = useState<string | null>(null);
  const openRow = openId ? rows.find((r) => r.id === openId) ?? null : null;

  const patchObra = (id: string, patch: PainelObraPatch) => data.updateObra(id, patch);
  const moveEtapa = (id: string, etapa: PainelEtapa | null) => {
    patchObra(id, { etapa })
      .then(() => toast.success(etapa ? `Etapa: ${etapa}` : "Etapa removida"))
      .catch(() => {
        /* o aviso de erro vem de quem grava */
      });
  };

  /**
   * Soltou um cartão de projeto numa coluna. Numa das seis etapas: "a obra
   * está nesta etapa" (o banco conclui as anteriores e reabre as seguintes).
   * Em "Pronta para iniciar" nada é gravado: a data da aprovação do
   * condomínio define o início oficial e não pode sair "hoje" por um arrasto;
   * a gaveta abre para a pessoa informar o dia certo.
   */
  const moveFase = (id: string, key: string) => {
    if (key === FASE_PRONTA) {
      setProntaAviso(id);
      openObra(id);
      return;
    }
    if (!isPhaseStepKey(key)) return;
    data
      .moveToPhaseStep(id, key)
      .then(() => toast.success(`Etapa: ${phaseStepLabel(key)}`))
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
    projetos: "Obras que ainda estão em projeto aparecem aqui, com a etapa em que estão, o prazo e quem responde por ela.",
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

    if (lista === "projetos") {
      if (visao === "kanban") {
        return (
          <EtapaKanban
            label="Obras por etapa da fase de projeto"
            groups={groupByFase(visibleProjetos, { always: true }).map((g) => ({
              key: g.key,
              label: g.label,
              items: g.items.map(cardFromProjeto),
              // "Sem etapa registrada" e "Etapas não carregadas" não são destino.
              droppable: g.key !== FASE_SEM_REGISTRO && g.key !== FASE_DESCONHECIDA,
            }))}
            onOpen={openObra}
            onMove={canEditPhase ? moveFase : undefined}
          />
        );
      }
      const list = (items: ProjetoRow[]) =>
        isMobile ? <ProjetosCards rows={items} onOpen={openObra} /> : <ProjetosTable rows={items} onOpen={openObra} />;
      if (visao === "board") {
        return (
          <EtapaBoard
            groups={groupByFase(visibleProjetos)}
            summary={(items) => {
              const late = items.filter((r) => r.verdict?.verdict === "atrasada").length;
              return late > 0 ? `${late} ${late === 1 ? "atrasada" : "atrasadas"}` : null;
            }}
            renderGroup={(items) => list(items)}
          />
        );
      }
      return list(visibleProjetos);
    }

    if (visao === "kanban") {
      return (
        <EtapaKanban
          groups={groupByEtapa(visibleRows.map(cardFromObra), (c) => c.etapa, KANBAN_ETAPAS.execucao)}
          onOpen={openObra}
          onMove={canEdit ? (id, key) => moveEtapa(id, etapaOfKey(key as EtapaKey)) : undefined}
        />
      );
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
          office || canResumo ? (
            <div className="flex flex-wrap gap-2">
              {canResumo && (
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link to="/gestao/resumo">
                    <Newspaper className="h-4 w-4" aria-hidden="true" />
                    Resumo da semana
                  </Link>
                </Button>
              )}
              {office && (
                <Button asChild className="min-h-[44px]">
                  <Link to="/gestao/nova-obra">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Nova obra
                  </Link>
                </Button>
              )}
            </div>
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
        </p>
      )}

      {lista === "projetos" && !isLoading && !error && projetos.length > 0 && (projetosResumo || phaseStatus === "error") && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" aria-live="polite">
          {projetosResumo && <span className="font-medium text-foreground">{projetosResumo}</span>}
          {phaseStatus === "error" && (
            <>
              <span>Não deu para carregar as etapas da fase de projeto.</span>
              <button
                type="button"
                onClick={data.refetchPhase}
                className="rounded-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tentar de novo
              </button>
            </>
          )}
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
            description={
              lista === "projetos"
                ? "A busca olha o nome da obra, o cliente, a etapa e o responsável."
                : "A busca olha o nome da obra, o cliente e o responsável."
            }
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
        <div className="mt-3 space-y-1.5">
        <EtapaLegend />
        <p className="max-w-3xl text-xs text-muted-foreground">
          Tudo aqui sai do cronograma da obra. Uma etapa só conta como começada ou concluída quando alguém lança isso no
          Hoje. A bolinha ao lado do nome é a situação da obra: vermelho = vai atrasar a entrega, amarelo = precisa de
          atenção, verde = em dia. "Sobram N dias" conta só dias úteis até a entrega do contrato.
        </p>
        </div>
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
            if (o) return;
            setProntaAviso(null);
            patchParams({ obra: null });
          }}
          obra={openId ? data.obraById.get(openId) ?? null : null}
          row={openRow}
          projeto={openId ? projetos.find((p) => p.id === openId) ?? null : null}
          concluida={openId ? concluidas.find((c) => c.id === openId) ?? null : null}
          staff={staff}
          canEdit={canEdit}
          canEditPhase={canEditPhase}
          phaseNotice={openId && prontaAviso === openId ? AVISO_PRONTA : null}
          onPatch={patchObra}
          weekHref={openRow ? weekHref(openRow) : undefined}
        />
      )}
    </PageContainer>
  );
}
