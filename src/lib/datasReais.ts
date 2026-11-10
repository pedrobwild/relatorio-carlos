/**
 * Regras puras da tela "Atualizar etapas" (equipe, celular): quais etapas
 * pedem data real hoje, o que pode ser gravado e os atalhos de data.
 *
 * As etapas são as do cronograma interno, no nível mais detalhado (etapa com
 * micro-etapas não aparece: atualiza-se cada micro-etapa), como no Hoje.
 *
 * Sem React e sem banco, para serem testáveis (datasReais.test.ts).
 */
import { isNonBusinessDay } from "@/lib/businessDays";
import { parseISODate, shiftISODate } from "@/lib/hojeDia";
import { businessDaysAfter } from "@/lib/obrasPainel";

export interface EtapaDatas {
  id: string;
  parent_id: string | null;
  description: string;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  sort_order: number;
}

export type CampoDataReal = "inicio" | "termino";

export type MotivoDataInvalida =
  | "futuro"
  | "termino_antes_do_inicio"
  | "inicio_depois_do_termino"
  | "inicio_obrigatorio";

export type ValidacaoDataReal = { ok: true } | { ok: false; motivo: MotivoDataInvalida };

/**
 * Valida a data real escolhida para um campo, contra hoje e a outra data.
 * `data` null = limpar o campo.
 *
 * - Nenhuma data real pode ser futura.
 * - Término não pode ser antes do início.
 * - Início não pode ser depois de um término já lançado.
 * - Não dá para limpar o início de uma etapa que já tem término.
 */
export function validarDataReal(input: {
  campo: CampoDataReal;
  data: string | null;
  hoje: string;
  inicio: string | null;
  termino: string | null;
}): ValidacaoDataReal {
  const { campo, data, hoje, inicio, termino } = input;
  if (data === null) {
    if (campo === "inicio" && termino) return { ok: false, motivo: "inicio_obrigatorio" };
    return { ok: true };
  }
  if (data > hoje) return { ok: false, motivo: "futuro" };
  if (campo === "termino" && inicio && data < inicio) return { ok: false, motivo: "termino_antes_do_inicio" };
  if (campo === "inicio" && termino && data > termino) return { ok: false, motivo: "inicio_depois_do_termino" };
  return { ok: true };
}

export type DatasReaisPatch = { actual_start?: string | null; actual_end?: string | null };

/**
 * O que gravar ao salvar um campo. Término sem início real também grava o
 * início: o previsto, quando ele não passa do término (mesmo padrão do
 * "Terminou hoje" do Hoje); senão, o próprio dia do término.
 */
export function patchDatasReais(
  etapa: Pick<EtapaDatas, "planned_start" | "actual_start">,
  campo: CampoDataReal,
  data: string | null,
): DatasReaisPatch {
  if (campo === "inicio") return { actual_start: data };
  if (data === null || etapa.actual_start) return { actual_end: data };
  return { actual_start: etapa.planned_start <= data ? etapa.planned_start : data, actual_end: data };
}

/** Datas anteriores dos campos que o patch toca (para o desfazer). */
export function patchParaDesfazer(
  etapa: Pick<EtapaDatas, "actual_start" | "actual_end">,
  patch: DatasReaisPatch,
): DatasReaisPatch {
  const antes: DatasReaisPatch = {};
  if ("actual_start" in patch) antes.actual_start = etapa.actual_start;
  if ("actual_end" in patch) antes.actual_end = etapa.actual_end;
  return antes;
}

export type AtalhoData = { id: "hoje" | "ontem" | "ultimo_dia_util"; date: string };

/**
 * Atalhos da gaveta: hoje, ontem e o último dia útil antes de ontem (numa
 * terça, a sexta anterior), para lançar o que ficou do fim da semana.
 */
export function atalhosDeData(hoje: string): AtalhoData[] {
  const ontem = shiftISODate(hoje, -1);
  let util = shiftISODate(ontem, -1);
  while (isNonBusinessDay(parseISODate(util))) util = shiftISODate(util, -1);
  return [
    { id: "hoje", date: hoje },
    { id: "ontem", date: ontem },
    { id: "ultimo_dia_util", date: util },
  ];
}

export type SituacaoEtapa =
  /** Passou do fim previsto e não terminou. */
  | "atrasada"
  /** Já deveria ter começado e não tem início real. */
  | "sem_inicio"
  /** O início previsto é hoje e ainda não começou. */
  | "comeca_hoje"
  /** Começou e está dentro do previsto. */
  | "em_andamento"
  | "futura"
  | "concluida";

export interface EtapaParaAtualizar<T extends EtapaDatas = EtapaDatas> {
  item: T;
  /** Nome da etapa-mãe, quando é micro-etapa. */
  parentName: string | null;
  situacao: SituacaoEtapa;
  /** Dias úteis de atraso (no fim, ou no início para `sem_inicio`). */
  lateDays: number;
  /** Próximo lançamento esperado. null para concluída. */
  proximo: CampoDataReal | null;
}

export interface GruposDeEtapas<T extends EtapaDatas = EtapaDatas> {
  paraHoje: EtapaParaAtualizar<T>[];
  proximas: EtapaParaAtualizar<T>[];
  concluidas: EtapaParaAtualizar<T>[];
  /** Quantas de `paraHoje` estão de fato devendo uma data (atraso ou início). */
  esperando: number;
}

function situacaoDe(item: EtapaDatas, hoje: string): Pick<EtapaParaAtualizar, "situacao" | "lateDays" | "proximo"> {
  if (item.actual_end) return { situacao: "concluida", lateDays: 0, proximo: null };
  if (item.actual_start) {
    const late = businessDaysAfter(item.planned_end, hoje);
    return late > 0
      ? { situacao: "atrasada", lateDays: late, proximo: "termino" }
      : { situacao: "em_andamento", lateDays: 0, proximo: "termino" };
  }
  if (item.planned_start > hoje) return { situacao: "futura", lateDays: 0, proximo: "inicio" };
  if (item.planned_start === hoje) return { situacao: "comeca_hoje", lateDays: 0, proximo: "inicio" };
  return { situacao: "sem_inicio", lateDays: businessDaysAfter(item.planned_start, hoje), proximo: "inicio" };
}

const ESPERANDO: readonly SituacaoEtapa[] = ["atrasada", "sem_inicio", "comeca_hoje"];
const ORDEM_HOJE: Record<SituacaoEtapa, number> = {
  atrasada: 0,
  sem_inicio: 1,
  comeca_hoje: 2,
  em_andamento: 3,
  futura: 4,
  concluida: 5,
};

/**
 * Separa as etapas em "Para atualizar hoje" (em aberto que já começaram ou
 * já deveriam ter começado), "Próximas" (começam depois de hoje) e
 * "Concluídas" (com término real, a mais recente primeiro).
 */
export function agruparEtapas<T extends EtapaDatas>(items: readonly T[], hoje: string): GruposDeEtapas<T> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const temFilhas = new Set(items.map((i) => i.parent_id).filter((x): x is string => !!x && byId.has(x)));
  const grupos: GruposDeEtapas<T> = { paraHoje: [], proximas: [], concluidas: [], esperando: 0 };

  for (const item of items) {
    if (temFilhas.has(item.id)) continue;
    if (!item.planned_start || !item.planned_end) continue;
    const e: EtapaParaAtualizar<T> = {
      item,
      parentName: item.parent_id ? (byId.get(item.parent_id)?.description ?? null) : null,
      ...situacaoDe(item, hoje),
    };
    if (e.situacao === "concluida") grupos.concluidas.push(e);
    else if (e.situacao === "futura") grupos.proximas.push(e);
    else grupos.paraHoje.push(e);
  }

  grupos.paraHoje.sort(
    (a, b) =>
      ORDEM_HOJE[a.situacao] - ORDEM_HOJE[b.situacao] ||
      b.lateDays - a.lateDays ||
      a.item.sort_order - b.item.sort_order,
  );
  grupos.proximas.sort(
    (a, b) => a.item.planned_start.localeCompare(b.item.planned_start) || a.item.sort_order - b.item.sort_order,
  );
  grupos.concluidas.sort(
    (a, b) => (b.item.actual_end ?? "").localeCompare(a.item.actual_end ?? "") || a.item.sort_order - b.item.sort_order,
  );
  grupos.esperando = grupos.paraHoje.filter((e) => ESPERANDO.includes(e.situacao)).length;
  return grupos;
}

/** Rascunho da gaveta "Datas reais": as duas datas como a pessoa deixou. */
export interface RascunhoDatas {
  inicio: string | null;
  termino: string | null;
}

/**
 * Primeiro problema do rascunho (início e término juntos), ou null.
 * Término sem início é aceito: o início é preenchido ao gravar.
 */
export function validarRascunho(rascunho: RascunhoDatas, hoje: string): MotivoDataInvalida | null {
  const { inicio, termino } = rascunho;
  // O término é conferido primeiro para a mensagem falar dele ("o término
  // não pode ser antes do início"), que é o campo que a pessoa costuma mexer.
  const t = validarDataReal({ campo: "termino", data: termino, hoje, inicio, termino });
  if (!t.ok) return t.motivo;
  if (inicio === null) return null;
  const i = validarDataReal({ campo: "inicio", data: inicio, hoje, inicio, termino });
  return i.ok ? null : i.motivo;
}

/** O que gravar para levar a etapa ao rascunho. Vazio = nada mudou. */
export function patchDoRascunho(
  etapa: Pick<EtapaDatas, "planned_start" | "actual_start" | "actual_end">,
  rascunho: RascunhoDatas,
): DatasReaisPatch {
  const patch: DatasReaisPatch = {};
  if (rascunho.inicio !== etapa.actual_start) patch.actual_start = rascunho.inicio;
  if (rascunho.termino !== etapa.actual_end || (rascunho.termino && !rascunho.inicio)) {
    Object.assign(
      patch,
      patchDatasReais({ planned_start: etapa.planned_start, actual_start: rascunho.inicio }, "termino", rascunho.termino),
    );
  }
  return patch;
}
