/**
 * Dias úteis no horário de São Paulo — mesmo calendário do portal
 * (`src/lib/businessDays.ts`): seg–sex, sem feriados nacionais, estaduais e
 * municipais de SP, Carnaval, Sexta-feira Santa e Corpus Christi.
 *
 * Sem dependências, para rodar igual no Deno (funções) e no Vitest.
 * São Paulo é UTC-3 o ano todo (sem horário de verão desde 2019).
 */
const SP_OFFSET_MS = 3 * 3_600_000;
const DIA_MS = 86_400_000;

const FERIADOS_FIXOS: [number, number][] = [
  [1, 1], [1, 25], [4, 21], [5, 1], [7, 9], [9, 7], [10, 12], [11, 2], [11, 15], [11, 20], [12, 25],
];

/** Domingo de Páscoa (meia-noite UTC do dia). */
function pascoa(ano: number): number {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia);
}

const cache = new Map<number, Set<string>>();
function feriadosDoAno(ano: number): Set<string> {
  let set = cache.get(ano);
  if (set) return set;
  set = new Set<string>();
  for (const [m, d] of FERIADOS_FIXOS) set.add(`${m}-${d}`);
  const p = pascoa(ano);
  for (const delta of [-48, -47, -2, 60]) {
    const dt = new Date(p + delta * DIA_MS);
    set.add(`${dt.getUTCMonth() + 1}-${dt.getUTCDate()}`);
  }
  cache.set(ano, set);
  return set;
}

/** O instante "visto" no relógio de São Paulo (use só os getters UTC). */
export function emSaoPaulo(instante: Date): Date {
  return new Date(instante.getTime() - SP_OFFSET_MS);
}

/** "2026-11-24" no calendário de São Paulo. */
export function diaEmSaoPaulo(instante: Date): string {
  return emSaoPaulo(instante).toISOString().slice(0, 10);
}

export function horaEmSaoPaulo(instante: Date): number {
  return emSaoPaulo(instante).getUTCHours();
}

export function ehDiaUtil(instante: Date): boolean {
  const sp = emSaoPaulo(instante);
  const dow = sp.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !feriadosDoAno(sp.getUTCFullYear()).has(`${sp.getUTCMonth() + 1}-${sp.getUTCDate()}`);
}

/** Horas entre dois instantes contando só os dias úteis de São Paulo. */
export function horasUteisEntre(inicio: Date, fim: Date): number {
  if (!(fim > inicio)) return 0;
  let total = 0;
  let cursor = inicio.getTime();
  const ate = fim.getTime();
  for (let guard = 0; cursor < ate && guard < 3660; guard++) {
    const sp = new Date(cursor - SP_OFFSET_MS);
    const fimDoDia =
      Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + 1) + SP_OFFSET_MS;
    const limite = Math.min(fimDoDia, ate);
    if (ehDiaUtil(new Date(cursor))) total += limite - cursor;
    cursor = fimDoDia;
  }
  return total / 3_600_000;
}

export const HORAS_UTEIS_PARA_ATRASO = 24;

/** Aberta há mais de 24 horas úteis. */
export function pendenciaAtrasada(criadaEm: string | Date, agora: Date): boolean {
  return horasUteisEntre(new Date(criadaEm), agora) > HORAS_UTEIS_PARA_ATRASO;
}

/** Lembrete só sai em dia útil, das 9h às 18h de São Paulo. */
export function horaDeLembrete(agora: Date): boolean {
  const h = horaEmSaoPaulo(agora);
  return ehDiaUtil(agora) && h >= 9 && h < 18;
}
