/**
 * Regras puras da Ficha da obra (project_studio_info).
 *
 * Ficam fora dos componentes para serem testáveis e para que a gaveta da
 * ficha, a tela Hoje e o cadastro falem a mesma língua.
 *
 * Formato gravado (o mesmo de "Dados do Cliente"):
 *   - allowed_work_days: lista com "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
 *   - allowed_work_start_time / allowed_work_end_time: texto "HH:MM"
 *   - data_recebimento_chaves: "yyyy-mm-dd"
 */
import type { StudioInfo, StudioInfoPatch } from "@/infra/repositories/studioInfo.repository";
import { parseISODate, todayISO } from "@/lib/hojeDia";
import { extractRichTextPlain, sanitizeInlineRichText } from "@/lib/sanitizeRichText";

/** A ficha como vem do banco; aceita pedaços (obra sem ficha, testes). */
export type FichaInfo = Partial<StudioInfo>;

export type WorkDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Dias na ordem da semana de obra (segunda primeiro), como em "Dados do Cliente". */
export const WORK_DAYS: ReadonlyArray<{ value: WorkDay; label: string; short: string }> = [
  { value: "mon", label: "Segunda", short: "Seg" },
  { value: "tue", label: "Terça", short: "Ter" },
  { value: "wed", label: "Quarta", short: "Qua" },
  { value: "thu", label: "Quinta", short: "Qui" },
  { value: "fri", label: "Sexta", short: "Sex" },
  { value: "sat", label: "Sábado", short: "Sáb" },
  { value: "sun", label: "Domingo", short: "Dom" },
];

/** Índice de `Date.getDay()` (0 = domingo) → valor gravado. */
const DAY_BY_JS_INDEX: readonly WorkDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const filled = (v: string | null | undefined): v is string => typeof v === "string" && v.trim().length > 0;

/** Dias permitidos válidos, sem repetição, na ordem da semana. */
export function allowedDays(info: FichaInfo | null | undefined): WorkDay[] {
  const set = new Set((info?.allowed_work_days ?? []).map((d) => String(d).trim().toLowerCase()));
  return WORK_DAYS.filter((d) => set.has(d.value)).map((d) => d.value);
}

/** "09:00" → "9h", "17:30" → "17h30". Aceita "HH:MM:SS". null se não for hora. */
export function formatHour(value: string | null | undefined): string | null {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return min === 0 ? `${h}h` : `${h}h${m[2]}`;
}

/** "9h às 17h", ou null quando falta início ou término. */
export function workHoursLabel(info: FichaInfo | null | undefined): string | null {
  const start = formatHour(info?.allowed_work_start_time);
  const end = formatHour(info?.allowed_work_end_time);
  return start && end ? `${start} às ${end}` : null;
}

/** "Seg a sex", "Seg, qua e sex", "Seg a sex e sáb", "Todos os dias". */
export function workDaysLabel(info: FichaInfo | null | undefined): string | null {
  const days = allowedDays(info);
  if (days.length === 0) return null;
  if (days.length === WORK_DAYS.length) return "Todos os dias";

  const short = (d: WorkDay) => (WORK_DAYS.find((w) => w.value === d)?.short ?? d).toLowerCase();
  const index = (d: WorkDay) => WORK_DAYS.findIndex((w) => w.value === d);

  // Sequências de dias seguidos: 3 ou mais viram "seg a sex".
  const runs: WorkDay[][] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && index(d) === index(last[last.length - 1]) + 1) last.push(d);
    else runs.push([d]);
  }
  const parts = runs.flatMap((run) => (run.length >= 3 ? [`${short(run[0])} a ${short(run[run.length - 1])}`] : run.map(short)));
  const text = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Seg a sex, 9h às 17h" — o que houver; null quando nada foi informado. */
export function workScheduleLabel(info: FichaInfo | null | undefined): string | null {
  const parts = [workDaysLabel(info), workHoursLabel(info)].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export interface WorkWindow {
  kind: "permitido" | "proibido";
  text: string;
}

const WEEKDAY_TITLE = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_ON = ["no domingo", "na segunda", "na terça", "na quarta", "na quinta", "na sexta", "no sábado"];

/**
 * O condomínio deixa trabalhar no dia `dateISO`?
 *
 *   { kind: "permitido", text: "Hoje: 9h às 17h" }
 *   { kind: "proibido",  text: "Condomínio não permite obra hoje" }
 *   null → dias ou horários não informados (não dá para afirmar nada)
 *
 * Para outro dia que não hoje, o texto usa o dia da semana ("Quinta: 9h às
 * 17h", "Condomínio não permite obra no sábado"). Não considera feriados: a
 * ficha só registra dias da semana.
 */
export function workWindowToday(
  info: FichaInfo | null | undefined,
  dateISO: string,
  now: Date = new Date(),
): WorkWindow | null {
  const days = allowedDays(info);
  if (days.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;

  const jsDay = parseISODate(dateISO).getDay();
  const isToday = dateISO === todayISO(now);

  if (!days.includes(DAY_BY_JS_INDEX[jsDay])) {
    return { kind: "proibido", text: `Condomínio não permite obra ${isToday ? "hoje" : WEEKDAY_ON[jsDay]}` };
  }
  const hours = workHoursLabel(info);
  if (!hours) return null;
  return { kind: "permitido", text: `${isToday ? "Hoje" : WEEKDAY_TITLE[jsDay]}: ${hours}` };
}

/** yyyy-mm-dd → dd/mm/aaaa (sem passar por `Date`, para não trocar o dia no fuso). */
export function formatDateBR(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

/**
 * "Recebidas em 03/08/2026 por Fulano" · "Recebidas por Fulano" ·
 * "Recebimento previsto para 20/11/2026" · "Ainda não recebidas".
 */
export function keysStatus(info: FichaInfo | null | undefined, today: string = todayISO()): { received: boolean; text: string } {
  const date = formatDateBR(info?.data_recebimento_chaves);
  const who = info?.keys_received_by?.trim() || null;
  const dateISO = (info?.data_recebimento_chaves ?? "").slice(0, 10);
  // Data futura sem ninguém ter recebido = combinado, ainda não aconteceu.
  if (date && !who && dateISO > today) return { received: false, text: `Recebimento previsto para ${date}` };
  if (date && who) return { received: true, text: `Recebidas em ${date} por ${who}` };
  if (date) return { received: true, text: `Recebidas em ${date}` };
  if (who) return { received: true, text: `Recebidas por ${who}` };
  return { received: false, text: "Ainda não recebidas" };
}

/** O essencial que ainda falta na ficha, na ordem em que aparece na tela. */
export function fichaMissing(info: FichaInfo | null | undefined): string[] {
  const missing: string[] = [];
  if (!filled(info?.endereco_completo)) missing.push("Endereço");
  if (!filled(info?.data_recebimento_chaves) && !filled(info?.key_location)) missing.push("Chaves");
  if (allowedDays(info).length === 0 || !workHoursLabel(info)) missing.push("Dias e horários permitidos");
  if (!filled(info?.access_release_process)) missing.push("Como pedir a liberação da equipe");
  const phones = [info?.syndic_phone, info?.building_manager_phone, info?.concierge_phone, info?.property_admin_phone];
  if (!phones.some(filled)) missing.push("Telefone de um contato do prédio");
  return missing;
}

/** "Faltam 3 informações nesta ficha" / "Falta 1 informação nesta ficha". */
export function fichaMissingLabel(count: number): string {
  return count === 1 ? "Falta 1 informação nesta ficha" : `Faltam ${count} informações nesta ficha`;
}

// ---------------------------------------------------------------------------
// Telefones
// ---------------------------------------------------------------------------

/**
 * Telefone brasileiro só com dígitos e com o 55 na frente (DDD + número).
 * Aceita máscara, "+55", "0" de operadora antes do DDD. null quando não dá
 * para discar (sem DDD, dígitos de menos ou de mais).
 */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 10 && digits.length !== 11) return null;
  // DDD brasileiro nunca tem zero.
  if (digits[0] === "0" || digits[1] === "0") return null;
  return `55${digits}`;
}

/** Números gratuitos / de tarifa única (0800, 0300): só dá para ligar. */
function tollFreeDigits(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return /^0[38]00\d{6,7}$/.test(digits) ? digits : null;
}

/** Link `tel:` para tocar e ligar; null quando o número não serve. */
export function telHref(raw: string | null | undefined): string | null {
  const tollFree = tollFreeDigits(raw);
  if (tollFree) return `tel:${tollFree}`;
  const n = normalizeBrPhone(raw);
  return n ? `tel:+${n}` : null;
}

/** Link do WhatsApp (https://wa.me/55…); null quando o número não serve. */
export function whatsappHref(raw: string | null | undefined): string | null {
  if (tollFreeDigits(raw)) return null;
  const n = normalizeBrPhone(raw);
  return n ? `https://wa.me/${n}` : null;
}

// ---------------------------------------------------------------------------
// Endereço
// ---------------------------------------------------------------------------

/** Texto para procurar no mapa: endereço, bairro, cidade e CEP. */
export function mapQuery(info: FichaInfo | null | undefined): string | null {
  if (!filled(info?.endereco_completo)) return null;
  return [info?.endereco_completo, info?.bairro, info?.cidade, info?.cep]
    .filter(filled)
    .map((p) => p.trim())
    .join(", ");
}

export function mapHref(info: FichaInfo | null | undefined): string | null {
  const q = mapQuery(info);
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

// ---------------------------------------------------------------------------
// Validação do formulário (mesmas regras e mensagens de "Dados do Cliente",
// para que o que se grava na ficha também seja aceito lá)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Telefone é opcional; preenchido, exige DDD + número (10 ou 11 dígitos). */
export function contactPhoneError(value: string | null | undefined): string | null {
  if (!filled(value)) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length < 10 || digits.length > 11
    ? "Use DDD + número, com 10 ou 11 dígitos. Ex.: (11) 99999-9999"
    : null;
}

export function contactEmailError(value: string | null | undefined): string | null {
  if (!filled(value)) return null;
  return EMAIL_RE.test(value.trim()) ? null : "E-mail inválido. Exemplo: nome@dominio.com";
}

/** Dias e horários andam juntos: ou tudo vazio, ou dias + início < término. */
export function workWindowError(
  days: readonly string[] | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const hasDays = (days?.length ?? 0) > 0;
  if (!hasDays && !filled(start) && !filled(end)) return null;
  if (!hasDays) return "Selecione pelo menos um dia da semana";
  if (!filled(start) || !filled(end)) return "Informe horário de início e término";
  if (start >= end) return "O horário de término deve ser maior que o de início";
  return null;
}

// ---------------------------------------------------------------------------
// Formulário da ficha: estado ↔ banco
// ---------------------------------------------------------------------------

/** Campos de texto simples do formulário (gravados como texto ou null). */
export const FICHA_TEXT_FIELDS = [
  "nome_do_empreendimento",
  "endereco_completo",
  "complemento",
  "bairro",
  "cidade",
  "data_recebimento_chaves",
  "keys_received_by",
  "key_location",
  "electronic_lock_password",
  "allowed_work_start_time",
  "allowed_work_end_time",
  "access_release_process",
  "syndic_name",
  "syndic_phone",
  "syndic_email",
  "building_manager_name",
  "building_manager_phone",
  "building_manager_email",
  "concierge_name",
  "concierge_phone",
  "property_admin_name",
  "property_admin_phone",
  "property_admin_email",
] as const satisfies ReadonlyArray<keyof StudioInfoPatch>;

export type FichaTextField = (typeof FICHA_TEXT_FIELDS)[number];

export type FichaForm = Record<FichaTextField, string> & {
  allowed_work_days: WorkDay[];
  /** HTML simples (negrito, listas), o mesmo formato de "Dados do Cliente". */
  provider_access_instructions: string;
};

export function fichaFormFromInfo(info: FichaInfo | null | undefined): FichaForm {
  const form = { allowed_work_days: allowedDays(info), provider_access_instructions: "" } as FichaForm;
  for (const f of FICHA_TEXT_FIELDS) form[f] = info?.[f] ?? "";
  form.provider_access_instructions = sanitizeInlineRichText(info?.provider_access_instructions);
  return form;
}

const textOrNull = (v: string | null | undefined) => (v ?? "").trim() || null;

/** HTML limpo, ou null quando não sobra texto nenhum. */
const richOrNull = (html: string | null | undefined) => {
  const clean = sanitizeInlineRichText(html);
  return extractRichTextPlain(clean).length > 0 ? clean : null;
};

/**
 * Só o que mudou em relação ao que está no banco. Texto vazio vira null.
 * Objeto vazio = nada para gravar.
 */
export function fichaPatch(info: FichaInfo | null | undefined, form: FichaForm): StudioInfoPatch {
  const patch: StudioInfoPatch = {};
  for (const f of FICHA_TEXT_FIELDS) {
    const next = textOrNull(form[f]);
    if (next !== textOrNull(info?.[f])) patch[f] = next;
  }
  const days = allowedDays({ allowed_work_days: form.allowed_work_days });
  if (days.join(",") !== allowedDays(info).join(",")) patch.allowed_work_days = days.length > 0 ? days : null;
  const rich = richOrNull(form.provider_access_instructions);
  if (rich !== richOrNull(info?.provider_access_instructions)) patch.provider_access_instructions = rich;
  return patch;
}
