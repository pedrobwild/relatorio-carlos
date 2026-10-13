/**
 * Hoje → "Etapas da obra": o que deveria ter começado pergunta "Começou?" e o
 * que está em andamento pergunta "Terminou?". Um toque lança a data real no
 * cronograma interno (e o Painel passa a mostrar onde a obra está).
 * Botões grandes: é usado em pé, na obra, no celular.
 */
import { useState } from "react";
import { Check, ChevronDown, Flag, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ddmm } from "@/lib/obrasPainel";
import { useEtapasHoje } from "@/hooks/useEtapasHoje";
import { datasDaResposta, type EtapaHoje, type ObraEtapasHoje } from "@/lib/etapasHoje";

/** Quantas etapas por obra aparecem antes do "ver mais". */
const POR_OBRA = 3;

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

function situacao(e: EtapaHoje): { texto: string; tom: string } {
  const { item } = e;
  if (e.pergunta === "comecou") {
    return e.lateDays > 0
      ? { texto: `Era para começar ${ddmm(item.planned_start)}`, tom: "text-warning" }
      : { texto: "Começa hoje", tom: "text-muted-foreground" };
  }
  return e.lateDays > 0
    ? { texto: `Era para terminar ${ddmm(item.planned_end)} · ${dias(e.lateDays)} atrasada`, tom: "text-destructive" }
    : { texto: `Em andamento · termina ${ddmm(item.planned_end)}`, tom: "text-muted-foreground" };
}

function EtapaLinha({
  e,
  today,
  onResponder,
}: {
  e: EtapaHoje;
  today: string;
  onResponder: (e: EtapaHoje, resposta: "comecou_hoje" | "comecou_no_previsto" | "terminou_hoje") => void;
}) {
  const s = situacao(e);
  const atrasoNoInicio = e.pergunta === "comecou" && e.item.planned_start < today;
  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-medium text-foreground">
        {e.parentName && <span className="font-normal text-muted-foreground">{e.parentName} › </span>}
        {e.item.description}
      </p>
      <p className={cn("text-xs", s.tom)}>{s.texto}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {e.pergunta === "comecou" ? (
          atrasoNoInicio ? (
            <>
              <Button type="button" className="min-h-[44px] flex-1" onClick={() => onResponder(e, "comecou_no_previsto")}>
                <Play className="h-4 w-4" aria-hidden="true" />
                Começou em {ddmm(e.item.planned_start)}
              </Button>
              <Button type="button" variant="outline" className="min-h-[44px] flex-1" onClick={() => onResponder(e, "comecou_hoje")}>
                Começou hoje
              </Button>
            </>
          ) : (
            <Button type="button" className="min-h-[44px] flex-1" onClick={() => onResponder(e, "comecou_hoje")}>
              <Play className="h-4 w-4" aria-hidden="true" />
              Começou
            </Button>
          )
        ) : (
          <Button type="button" className="min-h-[44px] flex-1" onClick={() => onResponder(e, "terminou_hoje")}>
            <Check className="h-4 w-4" aria-hidden="true" />
            Terminou hoje
          </Button>
        )}
      </div>
    </li>
  );
}

function ObraBloco({
  g,
  today,
  onResponder,
}: {
  g: ObraEtapasHoje;
  today: string;
  onResponder: (e: EtapaHoje, resposta: "comecou_hoje" | "comecou_no_previsto" | "terminou_hoje") => void;
}) {
  const [todas, setTodas] = useState(false);
  const shown = todas ? g.etapas : g.etapas.slice(0, POR_OBRA);
  const rest = g.etapas.length - shown.length;
  return (
    <section aria-labelledby={`etapas-${g.projectId}`}>
      <h3 id={`etapas-${g.projectId}`} className="mb-2 truncate text-sm font-semibold text-foreground">
        {g.projectName}
      </h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((e) => (
          <EtapaLinha key={e.item.id} e={e} today={today} onResponder={onResponder} />
        ))}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setTodas(true)}
          className="mt-2 inline-flex min-h-[40px] items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
          Ver mais {rest} {rest === 1 ? "etapa" : "etapas"}
        </button>
      )}
    </section>
  );
}

/**
 * `projectIds`: quando informado, mostra só essas obras (as do dia ou a
 * filtrada); vazio = todas as obras ativas que a pessoa vê.
 */
export function EtapasParaConfirmar({ today, projectIds }: { today: string; projectIds?: readonly string[] | null }) {
  const { groups, isLoading, isError, refetch, responder } = useEtapasHoje(today);
  const visiveis = projectIds && projectIds.length > 0 ? groups.filter((g) => projectIds.includes(g.projectId)) : groups;

  const onResponder = (e: EtapaHoje, resposta: "comecou_hoje" | "comecou_no_previsto" | "terminou_hoje") => {
    const datas = datasDaResposta(e, resposta, today);
    const undo = responder(e.item, datas);
    toast.success(resposta === "terminou_hoje" ? `${e.item.description}: terminou` : `${e.item.description}: começou`, {
      action: { label: "Desfazer", onClick: undo },
    });
  };

  if (isLoading) return <Skeleton className="mt-6 h-24 w-full rounded-xl" />;
  if (isError) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Não deu para carregar as etapas.{" "}
        <button type="button" onClick={() => void refetch()} className="font-medium text-primary hover:underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  if (visiveis.length === 0) return null;
  const total = visiveis.reduce((s, g) => s + g.etapas.length, 0);

  return (
    <section aria-labelledby="etapas-hoje" className="mt-6 space-y-4 rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
      <header>
        <h2 id="etapas-hoje" className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Flag className="h-4 w-4 text-primary" aria-hidden="true" />
          Etapas da obra: começou? terminou?
        </h2>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "etapa pede" : "etapas pedem"} confirmação. Um toque e o painel já mostra onde a obra está.
        </p>
      </header>
      {visiveis.map((g) => (
        <ObraBloco key={g.projectId} g={g} today={today} onResponder={onResponder} />
      ))}
    </section>
  );
}
