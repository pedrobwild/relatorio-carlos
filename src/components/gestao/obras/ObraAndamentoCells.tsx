/**
 * Células do Painel de Obras, escritas para quem está começando: cada uma
 * responde uma pergunta em uma linha, sem siglas.
 *
 *   Onde está        etapa atual + linha do tempo das etapas
 *   Agora            o que deveria estar acontecendo hoje
 *   Semana que vem   o que começa (ou continua)
 *   O que fazer      a ação mais importante (ver `@/lib/proximoPasso`)
 *
 * Três cores, sempre com o mesmo sentido: verde = em dia, amarelo = atenção
 * (não começou na data), vermelho = atrasado. Cinza = ainda vai acontecer.
 * Regras do cronograma em `@/lib/obraAndamento`.
 */
import { cn } from "@/lib/utils";
import { ddmm, type ObraRow } from "@/lib/obrasPainel";
import { parseISODate, todayISO } from "@/lib/hojeDia";
import {
  axisPosition,
  itemStateLabel,
  type AndamentoItem,
  type ItemState,
  type ObraAndamento,
} from "@/lib/obraAndamento";
import { proximoPasso, type PassoTom } from "@/lib/proximoPasso";

export const ITEM_DOT: Record<ItemState, string> = {
  concluida: "bg-success/45",
  em_andamento: "bg-success",
  sem_inicio: "bg-warning",
  atrasada: "bg-destructive",
  futura: "bg-muted-foreground/25",
};

const ITEM_TEXT: Record<ItemState, string> = {
  concluida: "text-muted-foreground",
  em_andamento: "text-success",
  sem_inicio: "text-warning",
  atrasada: "text-destructive",
  futura: "text-muted-foreground",
};

/** Legenda: três cores e o cinza. */
export const ITEM_LEGEND: { dot: string; label: string }[] = [
  { dot: ITEM_DOT.em_andamento, label: "em dia" },
  { dot: ITEM_DOT.sem_inicio, label: "não começou na data" },
  { dot: ITEM_DOT.atrasada, label: "atrasada" },
  { dot: ITEM_DOT.futura, label: "ainda vai acontecer" },
];

const PASSO_TEXT: Record<PassoTom, string> = {
  vermelho: "font-medium text-destructive",
  amarelo: "font-medium text-warning",
  neutro: "text-foreground",
  ok: "text-success",
};

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const weekday = (iso: string) => WEEKDAY[parseISODate(iso).getDay()];

/** Situação curta, em palavras: "4 dias atrasada", "não começou", "até 20/10". */
function shortState(i: AndamentoItem): string {
  switch (i.state) {
    case "atrasada":
      return `${i.lateDays} ${i.lateDays === 1 ? "dia" : "dias"} atrasada`;
    case "em_andamento":
      return `em dia, até ${ddmm(i.end)}`;
    case "sem_inicio":
      return i.lateDays > 0 ? "não começou" : "começa hoje";
    case "concluida":
      return "concluída";
    case "futura":
      return `começa ${ddmm(i.start)}`;
  }
}

function itemTitle(i: AndamentoItem): string {
  const nome = i.parentName ? `${i.parentName} › ${i.name}` : i.name;
  return `${nome} · previsto ${ddmm(i.start)} a ${ddmm(i.end)} · ${itemStateLabel(i)}`;
}

/**
 * Linha do tempo das etapas: uma barra por etapa no eixo de datas, colorida
 * pela situação, e um traço em hoje.
 */
export function StageTimeline({ andamento, className }: { andamento: ObraAndamento; className?: string }) {
  const { etapas, inicio, fim } = andamento;
  if (!inicio || !fim || etapas.length === 0) return null;
  const today = todayISO();
  const hoje = axisPosition(today, inicio, fim);
  const resumo = `${andamento.concluidas} de ${etapas.length} etapas concluídas`;
  return (
    <div className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="img" aria-label={resumo}>
      {etapas.map((e) => {
        const left = axisPosition(e.start, inicio, fim);
        const right = axisPosition(e.end, inicio, fim);
        return (
          <span
            key={e.id}
            title={itemTitle(e)}
            className={cn("absolute inset-y-0 border-r border-card", ITEM_DOT[e.state])}
            style={{ left: `${left * 100}%`, width: `max(3px, ${(right - left) * 100}%)` }}
          />
        );
      })}
      {today >= inicio && today <= fim && (
        <span
          aria-hidden="true"
          title={`Hoje, ${ddmm(today)}`}
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `calc(${hoje * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** "Onde está": etapa atual em uma linha e a linha do tempo. */
export function EtapaCell({ row }: { row: ObraRow }) {
  const a = row.andamento;
  if (!a || a.fase === "sem_cronograma") {
    return <span className="text-sm text-muted-foreground">Sem cronograma</span>;
  }
  let texto: string;
  let tom = "text-foreground";
  if (a.fase === "fim") {
    texto = "Todas as etapas concluídas";
  } else if (a.fase === "antes" && a.atual) {
    texto = `Começa ${weekday(a.atual.start)} ${ddmm(a.atual.start)}`;
    tom = "text-muted-foreground";
  } else if (a.fase === "intervalo" && a.proximo) {
    texto = `Parada até ${ddmm(a.proximo.start)}`;
    tom = "text-muted-foreground";
  } else if (a.atual) {
    texto = a.atual.name;
    tom = a.atual.state === "atrasada" ? "font-medium text-destructive" : "font-medium text-foreground";
  } else {
    texto = "—";
  }
  return (
    <div className="min-w-0" title={a.atual ? itemTitle(a.atual) : undefined}>
      <span className={cn("block truncate text-sm", tom)}>{texto}</span>
      <span className="mt-1.5 flex items-center gap-2">
        <StageTimeline andamento={a} className="flex-1" />
        {a.posicao && a.fase !== "fim" && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Etapa atual / total de etapas">
            {a.posicao.n}/{a.posicao.total}
          </span>
        )}
      </span>
    </div>
  );
}

/** "Agora": o item mais urgente que deveria estar acontecendo, e quantos mais. */
export function AgoraCell({ row }: { row: ObraRow }) {
  const a = row.andamento;
  const items = a?.agora ?? [];
  if (items.length === 0) {
    const vazio = !a || a.fase === "sem_cronograma" ? "—" : a.fase === "fim" ? "Nada" : "Nada previsto hoje";
    return <span className="text-sm text-muted-foreground">{vazio}</span>;
  }
  const first = items[0];
  const rest = items.length - 1;
  return (
    <div className="min-w-0 text-sm" title={items.map(itemTitle).join("\n")}>
      <span className="block truncate text-foreground">{first.name}</span>
      <span className="block truncate text-xs">
        <span className={first.state === "sem_inicio" && first.lateDays === 0 ? "text-muted-foreground" : ITEM_TEXT[first.state]}>
          {shortState(first)}
        </span>
        {rest > 0 && (
          <span className="text-muted-foreground">
            {" "}
            · +{rest} {rest === 1 ? "outra" : "outras"}
          </span>
        )}
      </span>
    </div>
  );
}

/** "Semana que vem": o que começa (com o dia) ou o que continua. */
export function ProximaSemanaCell({ row }: { row: ObraRow }) {
  const a = row.andamento;
  if (!a || a.fase === "sem_cronograma") return <span className="text-sm text-muted-foreground">—</span>;
  const comeca = a.proximaSemana;
  const continua = a.continuaProximaSemana;
  if (comeca.length === 0 && continua.length === 0) {
    return <span className="text-sm text-muted-foreground">Nada previsto</span>;
  }
  const lista = comeca.length > 0 ? comeca : continua;
  const first = lista[0];
  const rest = lista.length - 1;
  return (
    <div className="min-w-0 text-sm" title={[...comeca, ...continua].map(itemTitle).join("\n")}>
      <span className="block truncate text-foreground">{first.name}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {comeca.length > 0 ? `começa ${weekday(first.start)}` : "continua"}
        {rest > 0 && ` · +${rest}`}
      </span>
    </div>
  );
}

/** "O que fazer": uma ação. */
export function PassoCell({ row }: { row: ObraRow }) {
  const p = proximoPasso(row);
  return (
    <div className="min-w-0 text-sm">
      <span className={cn("block leading-snug", PASSO_TEXT[p.tom])}>{p.texto}</span>
      {p.outras > 0 && (
        <span className="mt-0.5 block text-xs text-muted-foreground">
          +{p.outras} {p.outras === 1 ? "pendência" : "pendências"}
        </span>
      )}
    </div>
  );
}
