/**
 * Atualizar etapas (equipe): lançar início e término real das etapas da obra
 * com um toque. Pensada para o celular, em pé, na obra.
 *
 * Grupos: "Para atualizar hoje" (em aberto que já começaram ou já deveriam
 * ter começado), "Próximas" e "Concluídas". "Começou hoje" / "Terminou hoje"
 * gravam na hora, com desfazer; "Outra data" abre a gaveta de datas reais.
 *
 * Usa o cronograma interno e espelha no do cliente, como o Hoje
 * (`useAtualizarEtapas`). Rota de equipe: /obra/:projectId/etapas.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Check, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-premium";
import { DatasReaisSheet } from "@/components/etapas/DatasReaisSheet";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useAtualizarEtapas } from "@/hooks/useAtualizarEtapas";
import { useCan } from "@/hooks/useCan";
import { todayISO } from "@/lib/hojeDia";
import { ddmm } from "@/lib/obrasPainel";
import { datasDaResposta } from "@/lib/etapasHoje";
import {
  agruparEtapas,
  type CampoDataReal,
  type DatasReaisPatch,
  type EtapaParaAtualizar,
  type SituacaoEtapa,
} from "@/lib/datasReais";
import type { InternalScheduleItemWithRefs } from "@/infra/repositories/internalSchedule.repository";
import { equipeMobileLabels } from "@/content/equipeMobileLabels";
import { cn } from "@/lib/utils";

const L = equipeMobileLabels.etapas;
type Etapa = EtapaParaAtualizar<InternalScheduleItemWithRefs>;

const CHIP_TONE: Record<SituacaoEtapa, string> = {
  atrasada: "bg-destructive/10 text-destructive",
  sem_inicio: "bg-warning/15 text-warning",
  comeca_hoje: "bg-warning/15 text-warning",
  em_andamento: "bg-primary/10 text-primary",
  futura: "bg-muted text-muted-foreground",
  concluida: "bg-success/15 text-success",
};

function chipText(e: Etapa): string {
  return e.situacao === "atrasada" ? L.chip.atrasada(e.lateDays) : L.chip[e.situacao];
}

function datasLinha(e: Etapa): string {
  const { item } = e;
  const previsto = L.previsto(ddmm(item.planned_start), ddmm(item.planned_end));
  if (item.actual_end) {
    return `${previsto} · ${item.actual_start ? `${L.comecou(ddmm(item.actual_start))} · ` : ""}${L.terminou(ddmm(item.actual_end))}`;
  }
  return `${previsto} · ${item.actual_start ? L.comecou(ddmm(item.actual_start)) : L.semInicio}`;
}

function EtapaTexto({ e }: { e: Etapa }) {
  return (
    // Tela estreita: a etiqueta desce para baixo do texto, que fica com a
    // largura toda (lado a lado ela espremia o nome em três linhas).
    <div className="flex flex-col gap-1.5 min-[400px]:flex-row min-[400px]:items-start min-[400px]:justify-between min-[400px]:gap-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words text-base font-semibold text-foreground">
          {e.parentName && <span className="font-normal text-muted-foreground">{e.parentName} › </span>}
          {e.item.description}
        </span>
        <span className="text-sm text-muted-foreground">{datasLinha(e)}</span>
      </div>
      <span className={cn("shrink-0 self-start whitespace-nowrap rounded-xl px-2.5 py-1 text-xs font-semibold", CHIP_TONE[e.situacao])}>
        {chipText(e)}
      </span>
    </div>
  );
}

function Grupo({
  id,
  title,
  etapas,
  canEdit,
  onAbrir,
}: {
  id: string;
  title: string;
  etapas: Etapa[];
  canEdit: boolean;
  onAbrir: (e: Etapa) => void;
}) {
  const [open, setOpen] = useState(false);
  if (etapas.length === 0) return null;
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex !min-h-[48px] w-full items-center justify-between rounded-xl border border-border bg-card px-3.5 text-[15px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{title}</span>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul id={id} className="mt-2 space-y-2">
          {etapas.map((e) => (
            <li key={e.item.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5">
              <EtapaTexto e={e} />
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 self-start rounded-xl px-4 text-[15px] font-semibold"
                  onClick={() => onAbrir(e)}
                >
                  {e.situacao === "concluida" ? L.editarDatas : L.informarDatas}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AtualizarEtapas() {
  const { projectId } = useProjectNavigation();
  const { project } = useProject();
  const { can } = useCan();
  const canEdit = can("schedule:edit");
  const hoje = todayISO();
  const { items, isLoading, error, refetch, gravar, isSaving, hasSaved } = useAtualizarEtapas(projectId);
  const grupos = useMemo(() => agruparEtapas(items, hoje), [items, hoje]);
  const [aberta, setAberta] = useState<{ id: string; campo: CampoDataReal } | null>(null);
  const etapaAberta = aberta ? (items.find((i) => i.id === aberta.id) ?? null) : null;

  const projectName = project ? `${project.name}${project.unit_name ? ` · ${project.unit_name}` : ""}` : "";

  const salvar = (item: InternalScheduleItemWithRefs, patch: DatasReaisPatch, mensagem: string) => {
    if (Object.keys(patch).length === 0) return;
    const desfazer = gravar(item, patch);
    toast.success(mensagem, { action: { label: L.desfazer, onClick: desfazer } });
  };

  const responder = (e: Etapa) => {
    if (e.proximo === "inicio") {
      salvar(e.item, datasDaResposta(e, "comecou_hoje", hoje), L.toastComecou(e.item.description));
    } else {
      salvar(e.item, datasDaResposta(e, "terminou_hoje", hoje), L.toastTerminou(e.item.description));
    }
  };

  const abrir = (e: Etapa) => setAberta({ id: e.item.id, campo: e.proximo ?? "termino" });

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="flex min-h-[52px] items-center gap-1 border-b border-border bg-card pl-2 pr-4">
        <Link
          to={projectId ? `/obra/${projectId}` : "/gestao/painel-obras"}
          aria-label={L.voltar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="text-base font-bold text-foreground">{L.title}</h1>
          {projectName && <span className="sr-only">{projectName}</span>}
        </div>
        <span role="status" aria-live="polite" className="flex shrink-0 items-center gap-1 text-xs font-semibold">
          {isSaving ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {L.salvando}
            </span>
          ) : hasSaved ? (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-4 w-4" aria-hidden="true" />
              {L.salvo}
            </span>
          ) : null}
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label={L.title}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <EmptyState icon={CalendarCheck} title={L.erro} action={{ label: L.tentarDeNovo, onClick: () => void refetch() }} />
        ) : items.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={L.vazio.title} description={L.vazio.description} />
        ) : (
          <>
            {!canEdit && <p className="rounded-xl bg-muted px-3.5 py-3 text-sm text-muted-foreground">{L.somenteLeitura}</p>}

            <section aria-labelledby="etapas-para-hoje" className="flex flex-col gap-3">
              <h2 id="etapas-para-hoje" className="text-sm font-semibold text-muted-foreground">
                {L.paraHoje(grupos.paraHoje.length)}
              </h2>
              {grupos.paraHoje.length === 0 && (
                <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{L.vazioHoje}</p>
              )}
              {grupos.paraHoje.map((e) => (
                <article key={e.item.id} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3.5">
                  <EtapaTexto e={e} />
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={e.situacao === "em_andamento" ? "outline" : "default"}
                        className={cn(
                          "h-12 min-w-[9.5rem] flex-1 rounded-xl text-[15px] font-semibold",
                          e.situacao === "em_andamento" && "border-primary text-primary",
                        )}
                        onClick={() => responder(e)}
                      >
                        {e.proximo === "inicio" ? L.comecouHoje : L.terminouHoje}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 flex-1 rounded-xl px-4 text-[15px] font-semibold min-[360px]:flex-none"
                        onClick={() => abrir(e)}
                      >
                        {L.outraData}
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </section>

            <Grupo id="etapas-proximas" title={L.proximas(grupos.proximas.length)} etapas={grupos.proximas} canEdit={canEdit} onAbrir={abrir} />
            <Grupo id="etapas-concluidas" title={L.concluidas(grupos.concluidas.length)} etapas={grupos.concluidas} canEdit={canEdit} onAbrir={abrir} />
          </>
        )}
      </div>

      <DatasReaisSheet
        etapa={etapaAberta}
        campoInicial={aberta?.campo ?? "inicio"}
        hoje={hoje}
        onClose={() => setAberta(null)}
        onSave={(etapa, patch) => {
          const item = items.find((i) => i.id === etapa.id);
          if (!item) return;
          const limpou = Object.values(patch).every((v) => v === null);
          salvar(item, patch, limpou ? L.toastLimpo : L.toastSalvo);
        }}
      />
    </div>
  );
}
