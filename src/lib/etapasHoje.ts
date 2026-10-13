/**
 * "Começou? Terminou?" no Hoje: as etapas do cronograma interno que pedem
 * uma confirmação hoje, para lançar início e término real com um toque.
 *
 * Entram:
 *   - o que deveria ter começado (início previsto até hoje) e não tem início
 *     real → pergunta "Começou?";
 *   - o que começou e ainda não terminou → pergunta "Terminou?" (com mais
 *     ênfase quando o fim previsto já passou).
 *
 * Só o nível mais detalhado: etapa com micro-etapas não aparece (confirma-se
 * cada micro-etapa). Só obras ativas (paralisada, concluída e cancelada saem).
 *
 * Regras puras, testadas em etapasHoje.test.ts.
 */
import { businessDaysAfter } from "@/lib/obrasPainel";

export interface EtapaHojeInput {
  id: string;
  project_id: string;
  parent_id: string | null;
  client_activity_id: string | null;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  responsible_user_id: string | null;
  sort_order: number;
  project?: { name: string; status: string | null } | null;
}

export type Pergunta = "comecou" | "terminou";

export interface EtapaHoje {
  item: EtapaHojeInput;
  /** Nome da etapa-mãe, quando é micro-etapa. */
  parentName: string | null;
  pergunta: Pergunta;
  /** Dias úteis de atraso no início (comecou) ou no fim (terminou). */
  lateDays: number;
}

export interface ObraEtapasHoje {
  projectId: string;
  projectName: string;
  etapas: EtapaHoje[];
}

/** Seleciona e agrupa por obra. A obra com mais atraso vem primeiro. */
export function etapasParaConfirmar(items: readonly EtapaHojeInput[], today: string): ObraEtapasHoje[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const temFilhas = new Set(items.map((i) => i.parent_id).filter((x): x is string => !!x));
  const out = new Map<string, ObraEtapasHoje>();

  for (const item of items) {
    if (temFilhas.has(item.id)) continue;
    if (item.actual_end) continue;
    if (item.project?.status && item.project.status !== "active") continue;
    let e: EtapaHoje | null = null;
    if (!item.actual_start && item.planned_start <= today) {
      e = { item, parentName: null, pergunta: "comecou", lateDays: businessDaysAfter(item.planned_start, today) };
    } else if (item.actual_start) {
      e = { item, parentName: null, pergunta: "terminou", lateDays: businessDaysAfter(item.planned_end, today) };
    }
    if (!e) continue;
    e.parentName = item.parent_id ? (byId.get(item.parent_id)?.description ?? null) : null;
    const g = out.get(item.project_id) ?? {
      projectId: item.project_id,
      projectName: item.project?.name ?? "Obra",
      etapas: [],
    };
    g.etapas.push(e);
    out.set(item.project_id, g);
  }

  const groups = [...out.values()];
  for (const g of groups) {
    // Atrasadas primeiro; depois "começou?" antes de "terminou?"; depois a ordem do cronograma.
    g.etapas.sort(
      (a, b) =>
        b.lateDays - a.lateDays ||
        (a.pergunta === b.pergunta ? 0 : a.pergunta === "comecou" ? -1 : 1) ||
        a.item.sort_order - b.item.sort_order,
    );
  }
  const maxLate = (g: ObraEtapasHoje) => Math.max(0, ...g.etapas.map((e) => e.lateDays));
  return groups.sort((a, b) => maxLate(b) - maxLate(a) || a.projectName.localeCompare(b.projectName, "pt-BR"));
}

/**
 * Datas a gravar para cada resposta. "Terminou" sem início real usa o início
 * previsto (o mesmo padrão do "Concluir" do Calendário).
 */
export function datasDaResposta(
  e: Pick<EtapaHoje, "item">,
  resposta: "comecou_hoje" | "comecou_no_previsto" | "terminou_hoje",
  today: string,
): { actual_start?: string; actual_end?: string } {
  switch (resposta) {
    case "comecou_hoje":
      return { actual_start: today };
    case "comecou_no_previsto":
      return { actual_start: e.item.planned_start };
    case "terminou_hoje":
      return e.item.actual_start ? { actual_end: today } : { actual_start: e.item.planned_start, actual_end: today };
  }
}
