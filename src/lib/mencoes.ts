/**
 * Regras puras das menções em observações internas (pendências entre a
 * equipe): há quanto tempo está aberta, quando conta como atrasada e em que
 * lista cada uma aparece para quem está logado.
 *
 * "Atrasada" = aberta há mais de 24 horas ÚTEIS: só contam as horas de dias
 * úteis (sábado, domingo e feriado não contam), com o mesmo calendário do
 * resto do portal (`businessDays`).
 *
 * Sem React e sem banco, para serem testáveis.
 */
import { isNonBusinessDay } from "@/lib/businessDays";

export const HORAS_UTEIS_PARA_ATRASO = 24;

export interface MencaoBase {
  id: string;
  mentioned_user_id: string;
  requested_by: string;
  created_at: string;
  resolved_at: string | null;
  archived_at: string | null;
  /** Responsável pela obra no painel (`projects.painel_responsavel_id`). */
  responsavel_obra_id?: string | null;
}

const HORA_MS = 3_600_000;

/** Horas decorridas entre dois instantes contando só os dias úteis. */
export function horasUteisEntre(inicio: Date, fim: Date): number {
  if (!(fim > inicio)) return 0;
  let total = 0;
  const cursor = new Date(inicio);
  // Dia a dia: soma o trecho de cada dia útil dentro do intervalo.
  for (let guard = 0; cursor < fim && guard < 3660; guard++) {
    const fimDoDia = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    const ate = fimDoDia < fim ? fimDoDia : fim;
    if (!isNonBusinessDay(cursor)) total += ate.getTime() - cursor.getTime();
    cursor.setTime(fimDoDia.getTime());
  }
  return total / HORA_MS;
}

export const mencaoAberta = (m: Pick<MencaoBase, "resolved_at" | "archived_at">) => !m.resolved_at && !m.archived_at;

/** Aberta há mais de 24 horas úteis. */
export function mencaoAtrasada(m: Pick<MencaoBase, "created_at" | "resolved_at" | "archived_at">, agora: Date): boolean {
  return mencaoAberta(m) && horasUteisEntre(new Date(m.created_at), agora) > HORAS_UTEIS_PARA_ATRASO;
}

/** "agora", "há 40 min", "há 5 h", "há 3 dias" (tempo corrido, como a pessoa sente). */
export function haQuantoTempo(desde: string, agora: Date): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

export interface MencoesAgrupadas<T> {
  /** Marcaram você: é com você resolver. */
  comigo: T[];
  /** Você pediu e ainda está aberto. */
  pediEmAberto: T[];
  /** Atrasadas nas obras em que você é o responsável (pedidas e para outras pessoas). */
  atrasadasNasMinhasObras: T[];
}

const maisAntigaPrimeiro = (a: MencaoBase, b: MencaoBase) => a.created_at.localeCompare(b.created_at);

/**
 * Separa as menções ABERTAS nas listas de quem está logado. Cada menção
 * aparece uma vez só, na primeira lista em que couber.
 */
export function agruparMencoes<T extends MencaoBase>(
  mencoes: readonly T[],
  userId: string | null | undefined,
  agora: Date,
): MencoesAgrupadas<T> {
  const out: MencoesAgrupadas<T> = { comigo: [], pediEmAberto: [], atrasadasNasMinhasObras: [] };
  if (!userId) return out;
  for (const m of mencoes) {
    if (!mencaoAberta(m)) continue;
    if (m.mentioned_user_id === userId) out.comigo.push(m);
    else if (m.requested_by === userId) out.pediEmAberto.push(m);
    else if (m.responsavel_obra_id === userId && mencaoAtrasada(m, agora)) out.atrasadasNasMinhasObras.push(m);
  }
  out.comigo.sort(maisAntigaPrimeiro);
  out.pediEmAberto.sort(maisAntigaPrimeiro);
  out.atrasadasNasMinhasObras.sort(maisAntigaPrimeiro);
  return out;
}

/** Tira acentos e caixa, para buscar "sergio" e achar "Sérgio". */
export const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Se a pessoa acabou de digitar um @ (no começo ou depois de espaço),
 * devolve o que veio depois dele, para filtrar a lista. Senão, null.
 */
export function gatilhoDeMencao(texto: string, cursor: number): string | null {
  const antes = texto.slice(0, cursor);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(antes);
  return m ? m[2] : null;
}

/** Troca o "@trecho" que está sendo digitado por "@Nome ". */
export function inserirMencao(texto: string, cursor: number, nome: string): { texto: string; cursor: number } {
  const antes = texto.slice(0, cursor);
  const depois = texto.slice(cursor);
  const m = /(^|\s)@([^\s@]{0,30})$/.exec(antes);
  const base = m ? antes.slice(0, antes.length - m[2].length - 1) : antes + (antes && !/\s$/.test(antes) ? " " : "");
  const inserido = `@${nome} `;
  return { texto: base + inserido + depois.replace(/^\s+/, ""), cursor: (base + inserido).length };
}
