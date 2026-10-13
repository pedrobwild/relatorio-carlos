/**
 * Células do Painel de Obras que respondem "onde a obra está" pelo
 * cronograma interno: etapa atual (com uma linha do tempo das etapas), o que
 * deveria estar acontecendo agora e o que começa na semana que vem.
 * Regras em `@/lib/obraAndamento`.
 */
import type { ReactNode } from "react";
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

export const ITEM_DOT: Record<ItemState, string> = {
  concluida: "bg-success",
  atrasada: "bg-destructive",
  em_andamento: "bg-primary",
  sem_inicio: "bg-warning",
  futura: "bg-muted-foreground/30",
};

const ITEM_TEXT: Record<ItemState, string> = {
  concluida: "text-muted-foreground",
  atrasada: "text-destructive",
  em_andamento: "text-foreground",
  sem_inicio: "text-warning",
  futura: "text-muted-foreground",
};

export const ITEM_LEGEND: { state: ItemState; label: string }[] = [
  { state: "concluida", label: "concluída" },
  { state: "em_andamento", label: "em andamento" },
  { state: "sem_inicio", label: "deveria ter começado" },
  { state: "atrasada", label: "atrasada" },
  { state: "futura", label: "a fazer" },
];

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
function dayLabel(iso: string): string {
  return `${WEEKDAY[parseISODate(iso).getDay()]} ${ddmm(iso)}`;
}

/** Etapa, curta: "atrasada 3 dias", "em andamento", "sem início"… */
function shortState(i: AndamentoItem): string {
  switch (i.state) {
    case "atrasada":
      return `atrasada ${i.lateDays} ${i.lateDays === 1 ? "dia" : "dias"}`;
    case "em_andamento":
      return `até ${ddmm(i.end)}`;
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
  return `${nome} · previsto ${ddmm(i.start)}–${ddmm(i.end)} · ${itemStateLabel(i)}`;
}

/**
 * Linha do tempo das etapas: uma barra por etapa no eixo de datas (do
 * primeiro início ao último fim), colorida pela situação, e um traço em hoje.
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
          className="absolute -inset-y-0 w-0.5 bg-foreground"
          style={{ left: `calc(${hoje * 100}% - 1px)` }}
        />
      )}
    </div>
  );
}

/** Coluna "Etapa": onde a obra está no cronograma. */
export function EtapaCell({ row }: { row: ObraRow }) {
  const a = row.andamento;
  if (!a || a.fase === "sem_cronograma") {
    return <span className="text-sm text-muted-foreground">Sem cronograma interno</span>;
  }
  let main: ReactNode;
  let sub: ReactNode = null;
  if (a.fase === "fim") {
    main = <span className="text-foreground">Todas as etapas concluídas</span>;
    sub = row.deadline ? `Entrega ${ddmm(row.deadline)}` : null;
  } else if (a.fase === "antes" && a.atual) {
    main = <span className="text-foreground">Começa {dayLabel(a.atual.start)}</span>;
    sub = `1ª etapa: ${a.atual.name}`;
  } else if (a.fase === "intervalo" && a.proximo) {
    main = <span className="text-muted-foreground">Entre etapas</span>;
    sub = `Próxima: ${a.proximo.parentName ?? a.proximo.name} ${ddmm(a.proximo.start)}`;
  } else if (a.atual) {
    main = (
      <span className={cn("font-medium", a.atual.state === "atrasada" ? "text-destructive" : "text-foreground")}>
        {a.atual.name}
      </span>
    );
    sub = (
      <>
        {a.posicao && `Etapa ${a.posicao.n} de ${a.posicao.total}`}
        {" · "}
        <span className={ITEM_TEXT[a.atual.state]}>{shortState(a.atual)}</span>
      </>
    );
  }
  return (
    <div className="min-w-0" title={a.atual ? itemTitle(a.atual) : undefined}>
      <span className="block truncate text-sm">{main}</span>
      {sub && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sub}</span>}
      <StageTimeline andamento={a} className="mt-1.5" />
    </div>
  );
}

function ItemLine({ item, when }: { item: AndamentoItem; when?: string }) {
  return (
    <li className="flex min-w-0 items-baseline gap-1.5 text-sm leading-snug" title={itemTitle(item)}>
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 translate-y-[-1px] rounded-full", ITEM_DOT[item.state])} />
      <span className="min-w-0 truncate text-foreground">
        {when && <span className="text-muted-foreground tabular-nums">{when} · </span>}
        {item.name}
      </span>
      {!when && <span className={cn("shrink-0 text-xs", ITEM_TEXT[item.state])}>{shortState(item)}</span>}
    </li>
  );
}

function more(n: number, items: readonly AndamentoItem[]) {
  if (n <= 0) return null;
  return (
    <li className="text-xs text-muted-foreground" title={items.map((i) => i.name).join(", ")}>
      +{n} {n === 1 ? "outra" : "outras"}
    </li>
  );
}

/** Coluna "Agora": o que deveria estar acontecendo hoje (e o que está atrasado). */
export function AgoraCell({ row, max = 3 }: { row: ObraRow; max?: number }) {
  const a = row.andamento;
  const items = a?.agora ?? [];
  const shown = items.slice(0, max);
  return (
    <div className="min-w-0">
      {shown.length > 0 ? (
        <ul className="space-y-0.5">
          {shown.map((i) => (
            <ItemLine key={i.id} item={i} />
          ))}
          {more(items.length - shown.length, items.slice(shown.length))}
        </ul>
      ) : (
        <span className="text-sm text-muted-foreground">
          {!a || a.fase === "sem_cronograma" ? "—" : a.fase === "fim" ? "Nada previsto" : "Nada previsto para hoje"}
        </span>
      )}
      <WeekLine row={row} />
    </div>
  );
}

/** Uma linha sobre a semana (dias marcados e fechamento). */
function WeekLine({ row }: { row: ObraRow }) {
  const w = row.week;
  if (row.cadastro?.paused && w.planned === 0) {
    return <span className="mt-1 block text-xs text-muted-foreground">Obra paralisada</span>;
  }
  if (w.unplanned) {
    return (
      <span className="mt-1 block text-xs font-medium text-warning">
        Semana sem dia marcado
        {w.previous?.pending && " · anterior sem fechar"}
      </span>
    );
  }
  if (w.planned === 0) {
    return w.previous?.pending ? (
      <span className="mt-1 block text-xs font-medium text-warning">Semana anterior sem fechar</span>
    ) : null;
  }
  return (
    <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
      Semana: {w.planned} {w.planned === 1 ? "dia marcado" : "dias marcados"}
      {w.done > 0 && ` · ${w.done} feito${w.done === 1 ? "" : "s"}`}
      {w.notDone > 0 && <span className="text-destructive">{` · ${w.notDone} não feito${w.notDone === 1 ? "" : "s"}`}</span>}
      {w.ppc != null && ` · PPC ${w.ppc}%`}
      {w.ppc == null && w.previous?.ppc != null && ` · PPC anterior ${w.previous.ppc}%`}
      {w.previous?.pending && <span className="font-medium text-warning"> · anterior sem fechar</span>}
    </span>
  );
}

/** Coluna "Próxima semana": o que começa, o que continua e se já foi planejada. */
export function ProximaSemanaCell({ row, max = 3 }: { row: ObraRow; max?: number }) {
  const a = row.andamento;
  if (!a || a.fase === "sem_cronograma") return <span className="text-sm text-muted-foreground">—</span>;
  const comeca = a.proximaSemana;
  const continua = a.continuaProximaSemana;
  const shown = comeca.slice(0, max);
  const algo = comeca.length > 0 || continua.length > 0;
  const planned = row.nextWeekPlanned;
  return (
    <div className="min-w-0">
      {shown.length > 0 ? (
        <ul className="space-y-0.5">
          {shown.map((i) => (
            <ItemLine key={i.id} item={i} when={dayLabel(i.start)} />
          ))}
          {more(comeca.length - shown.length, comeca.slice(shown.length))}
        </ul>
      ) : (
        <span className="block text-sm text-muted-foreground">
          {continua.length > 0 ? "Nada novo começa" : a.fase === "fim" ? "—" : "Nada previsto"}
        </span>
      )}
      {continua.length > 0 && (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={continua.map((i) => i.name).join(", ")}>
          Continua: {continua.map((i) => i.name).slice(0, 2).join(", ")}
          {continua.length > 2 && ` +${continua.length - 2}`}
        </span>
      )}
      {algo && planned != null && !row.cadastro?.paused && (
        <span
          className={cn(
            "mt-1 block text-xs tabular-nums",
            planned > 0 ? "text-muted-foreground" : "font-medium text-warning",
          )}
        >
          {planned > 0 ? `${planned} ${planned === 1 ? "dia marcado" : "dias marcados"}` : "Ainda sem dia marcado"}
        </span>
      )}
    </div>
  );
}
