/**
 * Regras puras do Diário de obra (relatório de campo diário, celular).
 *
 * Tudo o que decide a tela mora aqui, sem React nem Supabase: a ordem dos
 * passos, o que trava o avanço, o vínculo entre etapa impedida e pendência,
 * os marcos de início real, o texto que vai para o cliente e a semana do
 * relatório semanal em que o relato entra. A tela (`/gestao/diario`) só
 * desenha o estado e despacha ações; o banco (`diario_obra_enviar`) revalida
 * as mesmas regras no envio.
 *
 * Fluxo: 1 Quem e onde → 2 Etapas do dia → 3 Equipe → 4 Algo mais hoje?
 * (→ Pendências → Material recebido → Mudança de prazo, só os marcados) →
 * 5 Conferir e enviar → Pronto.
 */
import { parseISODate, shiftISODate, toISODate } from "@/lib/hojeDia";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Tela = "id" | "etapas" | "equipe" | "triagem" | "pend" | "mat" | "prazo" | "conf" | "ok";
/** Telas com validação própria (as chaves de `validar`). */
export type TelaValidada = "id" | "etapas" | "equipe" | "pend" | "mat" | "prazo";

export type StatusEtapa = "concluida" | "andamento" | "impedida";
export type Marco = "eletrica" | "medicao";
export type TipoMedicao = "marmoraria" | "vidracaria" | "marcenaria";
export type Funcao = "gestor" | "coordenador";
export type Chegou = "sim" | "nao" | "parcial";
export type Confere = "ok" | "div" | "nc";
export type MotivoPrazo = "material" | "terceiro" | "cliente" | "condominio" | "outro";
export type Avisado = "sim" | "nao" | "vai";

/** Etapa do cronograma interno, no nível em que se trabalha (sem filhas). */
export interface EtapaCronograma {
  id: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  actualEnd: string | null;
  sortOrder: number;
}

export interface EtapaRelato {
  status: StatusEtapa | null;
  /** Id da foto guardada no aparelho (o arquivo fica fora do estado). */
  fotoId: string | null;
  tipo: TipoMedicao | null;
  agendada: boolean;
  /** yyyy-mm-dd */
  dataMedicao: string | null;
  fornecedorId: string | null;
  fornecedorNome: string | null;
}

export interface Pendencia {
  id: string;
  /** Etapa impedida que abriu a pendência; null = pendência avulsa. */
  etapaId: string | null;
  descricao: string;
  responsavel: string | null;
  responsavelUserId: string | null;
  /** yyyy-mm-dd */
  prazo: string | null;
  trava: boolean | null;
}

export interface Material {
  id: string;
  item: string | null;
  purchaseId: string | null;
  chegou: Chegou | null;
  confere: Confere | null;
  fotoId: string | null;
  divergencia: string;
}

export interface MudancaPrazo {
  /** yyyy-mm-dd */
  data: string | null;
  motivo: MotivoPrazo | null;
  avisado: Avisado | null;
}

export interface DiarioState {
  tela: Tela;
  dataEscolha: "hoje" | "ontem";
  obraId: string | null;
  funcao: Funcao;
  /** Etapa com o cartão aberto. */
  aberta: string | null;
  etapas: Record<string, EtapaRelato>;
  nenhumaEtapa: boolean;
  qtd: number;
  nomes: string;
  terceiros: string[];
  temPendencia: boolean;
  temMaterial: boolean;
  temPrazo: boolean;
  pendencias: Pendencia[];
  materiais: Material[];
  prazo: MudancaPrazo;
  /** Telas em que a pessoa já tentou avançar (liga os avisos em vermelho). */
  tentou: Partial<Record<TelaValidada | "conf", boolean>>;
  /** Aviso "Pendência incompleta" ao tentar voltar da tela de pendências. */
  modal: boolean;
  seq: number;
  /** Preenchidos no envio, para a tela "Pronto". */
  enviadoOffline: boolean;
}

export type Erros = Record<TelaValidada, string[]>;

// ---------------------------------------------------------------------------
// Listas fixas (as do protótipo)
// ---------------------------------------------------------------------------

export const CABECALHOS: Record<Tela, readonly [string, string]> = {
  id: ["Passo 1 de 5", "Quem e onde"],
  etapas: ["Passo 2 de 5", "Etapas do dia"],
  equipe: ["Passo 3 de 5", "Equipe"],
  triagem: ["Passo 4 de 5", "Algo mais hoje?"],
  pend: ["Passo 4 de 5 · extra", "Pendências"],
  mat: ["Passo 4 de 5 · extra", "Material recebido"],
  prazo: ["Passo 4 de 5 · extra", "Mudança de prazo"],
  conf: ["Passo 5 de 5", "Conferir e enviar"],
  ok: ["Relato registrado", "Pronto"],
};

/** Posição da tela na barra de 5 segmentos (as extras ficam no passo 4). */
export const SEGMENTO: Record<Tela, number> = {
  id: 0,
  etapas: 1,
  equipe: 2,
  triagem: 3,
  pend: 3,
  mat: 3,
  prazo: 3,
  conf: 4,
  ok: 5,
};

export const FUNCOES: ReadonlyArray<readonly [Funcao, string]> = [
  ["gestor", "Gestor de operação"],
  ["coordenador", "Coordenador técnico"],
];
export const FUNCAO_RESUMO: Record<Funcao, string> = {
  gestor: "gestor de operação",
  coordenador: "coordenador técnico",
};

export const STATUS_LABEL: Record<StatusEtapa, string> = {
  concluida: "Concluída",
  andamento: "Em andamento",
  impedida: "Impedida",
};

export const TIPOS_MEDICAO: ReadonlyArray<readonly [TipoMedicao, string]> = [
  ["marmoraria", "Marmoraria"],
  ["vidracaria", "Vidraçaria"],
  ["marcenaria", "Marcenaria"],
];
const TIPO_MINUSCULO: Record<TipoMedicao, string> = {
  marmoraria: "marmoraria",
  vidracaria: "vidraçaria",
  marcenaria: "marcenaria",
};

export const TERCEIROS = ["Marcenaria", "Vidraçaria", "Marmoraria", "Outro terceiro"] as const;
/** Responsáveis que não são pessoas da equipe da obra. */
export const RESPONSAVEIS_TERCEIROS = ["Marcenaria", "Vidraçaria", "Marmoraria", "Outro fornecedor"] as const;
export const ATALHOS_PENDENCIA = ["Falta material", "Aguardando terceiro", "Sem acesso", "Retrabalho"] as const;

export const MOTIVOS_PRAZO: ReadonlyArray<readonly [MotivoPrazo, string]> = [
  ["material", "Material"],
  ["terceiro", "Terceiro"],
  ["cliente", "Cliente"],
  ["condominio", "Condomínio"],
  ["outro", "Outro"],
];
export const AVISADO_OPCOES: ReadonlyArray<readonly [Avisado, string]> = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["vai", "Vou avisar"],
];
const AVISADO_RESUMO: Record<Avisado, string> = {
  sim: "cliente avisado",
  nao: "cliente NÃO avisado",
  vai: "cliente ainda será avisado",
};
export const CHEGOU_OPCOES: ReadonlyArray<readonly [Chegou, string]> = [
  ["sim", "Sim"],
  ["nao", "Não"],
  ["parcial", "Parcial"],
];
export const CONFERE_OPCOES: ReadonlyArray<readonly [Confere, string]> = [
  ["ok", "Confere"],
  ["div", "Diverge"],
  ["nc", "Não conferido"],
];
const CHEGOU_RESUMO: Record<Chegou, string> = { sim: "Chegou", nao: "Não chegou", parcial: "Chegou parcial" };
const CONFERE_RESUMO: Record<Confere, string> = { ok: "Confere", div: "Divergente", nc: "Não conferido" };

export const LIMITE_TEXTO_CURTO = 80;
export const LIMITE_NOMES = 160;
export const LIMITE_TEXTO_CLIENTE = 600;

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const DIAS_CHIP = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "yyyy-mm-dd" → "dd/mm". */
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "yyyy-mm-dd" → "sex 20/11" (com ano: "sex 20/11/2026"). */
export function diaCurto(iso: string, comAno = false): string {
  return `${DIAS_CURTOS[parseISODate(iso).getDay()]} ${ddmm(iso)}${comAno ? `/${iso.slice(0, 4)}` : ""}`;
}

/** Data do relato a partir da escolha Hoje / Ontem. */
export const dataDoRelato = (escolha: "hoje" | "ontem", hoje: string) =>
  escolha === "hoje" ? hoje : shiftISODate(hoje, -1);

/** Atalhos de data: amanhã, +2, +3 e +7 dias. */
export function atalhosDeData(hoje: string): Array<{ iso: string; label: string }> {
  return [1, 2, 3, 7].map((k) => {
    const iso = shiftISODate(hoje, k);
    return { iso, label: `${k === 1 ? "Amanhã" : DIAS_CHIP[parseISODate(iso).getDay()]} · ${ddmm(iso)}` };
  });
}

/**
 * Semana do relatório semanal em que um dia cai — a mesma conta de
 * `generateWeeklyReports` e da função `diario_obra_semana` no banco: a semana
 * 1 começa no início da obra e fecha na sexta; as seguintes vão de segunda a
 * sexta. Sábado e domingo entram na semana seguinte.
 */
export function semanaDoRelatorio(
  inicioObra: string | null | undefined,
  dia: string,
): { weekNumber: number; weekStart: string; weekEnd: string } | null {
  if (!inicioObra) return null;
  let d = dia;
  const dow = parseISODate(d).getDay();
  if (dow === 6) d = shiftISODate(d, 2);
  else if (dow === 0) d = shiftISODate(d, 1);

  const dowInicio = parseISODate(inicioObra).getDay();
  const primeiraSexta = shiftISODate(
    inicioObra,
    dowInicio === 5 ? 0 : dowInicio === 6 ? 6 : dowInicio === 0 ? 5 : 5 - dowInicio,
  );
  if (d <= primeiraSexta) return { weekNumber: 1, weekStart: inicioObra, weekEnd: primeiraSexta };

  const segundaSegunda = shiftISODate(primeiraSexta, 3);
  const segunda = shiftISODate(d, -((parseISODate(d).getDay() + 6) % 7));
  const dias = Math.round((parseISODate(segunda).getTime() - parseISODate(segundaSegunda).getTime()) / 86_400_000);
  return { weekNumber: 2 + Math.round(dias / 7), weekStart: segunda, weekEnd: shiftISODate(segunda, 4) };
}

/** Sexta que fecha a semana do relato (o que o cliente recebe). */
export function sextaDaSemana(dia: string): string {
  const dow = parseISODate(dia).getDay();
  const base = dow === 6 ? shiftISODate(dia, 2) : dow === 0 ? shiftISODate(dia, 1) : dia;
  return shiftISODate(base, 5 - parseISODate(base).getDay());
}

export const hojeISO = (agora: Date = new Date()) => toISODate(agora);

// ---------------------------------------------------------------------------
// Etapas e marcos
// ---------------------------------------------------------------------------

/**
 * Marco pelo nome da etapa (espelha `diario_obra_marco` no banco):
 * "Medição ..." é medição; "Adequação/Adequações elétrica(s)" é o marco
 * elétrico. "Medições, marcações..." (plural, etapa de mobilização) não é.
 */
export function marcoDaEtapa(description: string | null | undefined): Marco | null {
  const d = (description ?? "").trim();
  if (/^medi[cç][aã]o(\s|$)/i.test(d)) return "medicao";
  if (/adequa[cç][aãoõ][a-zà-ú]*\s+el[eé]tric/i.test(d)) return "eletrica";
  return null;
}

/** Concluir esta etapa define o início real da obra? */
export function defineInicioReal(marco: Marco | null, relato: Pick<EtapaRelato, "status" | "tipo">): boolean {
  if (relato.status !== "concluida") return false;
  if (marco === "eletrica") return true;
  return marco === "medicao" && (relato.tipo === "marmoraria" || relato.tipo === "vidracaria");
}

export const previstaNoDia = (e: Pick<EtapaCronograma, "plannedStart" | "plannedEnd" | "actualEnd">, dia: string) =>
  !e.actualEnd && e.plannedStart <= dia && dia <= e.plannedEnd;

/** Previstas para o dia primeiro; depois a ordem do cronograma. */
export function ordenarEtapas<T extends EtapaCronograma>(etapas: readonly T[], dia: string): T[] {
  return [...etapas].sort(
    (a, b) =>
      Number(previstaNoDia(b, dia)) - Number(previstaNoDia(a, dia)) ||
      a.sortOrder - b.sortOrder ||
      a.plannedStart.localeCompare(b.plannedStart),
  );
}

export function etiquetaEtapa(e: EtapaCronograma, dia: string, temRelato: boolean): string {
  const hoje = previstaNoDia(e, dia);
  const base = marcoDaEtapa(e.description)
    ? hoje
      ? "Marco · prevista hoje"
      : "Marco"
    : hoje
      ? "Prevista hoje"
      : "Cronograma";
  return temRelato ? `${base} · relatório cadastrado` : base;
}

const RELATO_VAZIO: EtapaRelato = {
  status: null,
  fotoId: null,
  tipo: null,
  agendada: false,
  dataMedicao: null,
  fornecedorId: null,
  fornecedorNome: null,
};

export const relatoDaEtapa = (s: DiarioState, id: string): EtapaRelato => ({ ...RELATO_VAZIO, ...(s.etapas[id] ?? {}) });

/** Etapas com situação marcada, na ordem recebida. */
export const etapasTocadas = <T extends EtapaCronograma>(s: DiarioState, etapas: readonly T[]): T[] =>
  etapas.filter((e) => !!relatoDaEtapa(s, e.id).status);

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export function estadoInicial(): DiarioState {
  return {
    tela: "id",
    dataEscolha: "hoje",
    obraId: null,
    funcao: "gestor",
    aberta: null,
    etapas: {},
    nenhumaEtapa: false,
    qtd: 0,
    nomes: "",
    terceiros: [],
    temPendencia: false,
    temMaterial: false,
    temPrazo: false,
    pendencias: [],
    materiais: [],
    prazo: { data: null, motivo: null, avisado: null },
    tentou: {},
    modal: false,
    seq: 1,
    enviadoOffline: false,
  };
}

const pendenciaVazia = (id: string, etapaId: string | null = null): Pendencia => ({
  id,
  etapaId,
  descricao: "",
  responsavel: null,
  responsavelUserId: null,
  prazo: null,
  trava: null,
});
const materialVazio = (id: string): Material => ({
  id,
  item: null,
  purchaseId: null,
  chegou: null,
  confere: null,
  fotoId: null,
  divergencia: "",
});

export const pendenciaIncompleta = (p: Pendencia) =>
  !p.descricao.trim() || !p.responsavel || !p.prazo || p.trava === null;

/** "Tem pendência?" vale Sim se marcado ou se há etapa impedida. */
export const temPendenciaEfetivo = (s: DiarioState) => s.temPendencia || s.pendencias.some((p) => p.etapaId);
export const pendenciaTravadaEmSim = (s: DiarioState) => s.pendencias.some((p) => p.etapaId);

/** Telas do relato, na ordem; as extras só entram se marcadas. */
export function cadeia(s: DiarioState): Tela[] {
  const c: Tela[] = ["id", "etapas", "equipe", "triagem"];
  if (temPendenciaEfetivo(s)) c.push("pend");
  if (s.temMaterial) c.push("mat");
  if (s.temPrazo) c.push("prazo");
  c.push("conf");
  return c;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export function validar(s: DiarioState, etapas: readonly EtapaCronograma[]): Erros {
  const o: Erros = { id: [], etapas: [], equipe: [], pend: [], mat: [], prazo: [] };
  if (!s.obraId) o.id.push("Escolha a obra");

  const tocadas = etapasTocadas(s, etapas);
  if (tocadas.length === 0 && !s.nenhumaEtapa) {
    o.etapas.push("Marque ao menos uma etapa, ou “Nenhuma etapa avançou hoje”");
  }
  for (const d of tocadas) {
    const e = relatoDaEtapa(s, d.id);
    if (!e.fotoId) o.etapas.push(`Foto da etapa: ${d.description}`);
    if (marcoDaEtapa(d.description) === "medicao") {
      if (!e.tipo) o.etapas.push("Tipo da medição");
      if (e.status !== "concluida" && e.agendada && !e.dataMedicao) o.etapas.push("Data agendada da medição");
      if (e.status !== "concluida" && e.agendada && !e.fornecedorId) o.etapas.push("Fornecedor da medição");
    }
  }

  if (tocadas.length > 0 && s.qtd < 1) o.equipe.push("Quantas pessoas estiveram na obra");
  if ((tocadas.length > 0 || s.qtd > 0) && !s.nomes.trim()) o.equipe.push("Nomes de quem esteve na obra");

  if (temPendenciaEfetivo(s) && s.pendencias.length === 0) o.pend.push("Adicione ao menos uma pendência");
  s.pendencias.forEach((p, i) => {
    const n = `Pendência ${i + 1}: `;
    if (!p.descricao.trim()) o.pend.push(`${n}descrição`);
    if (!p.responsavel) o.pend.push(`${n}responsável`);
    if (!p.prazo) o.pend.push(`${n}prazo`);
    if (p.trava === null) o.pend.push(`${n}trava a obra?`);
  });

  if (s.temMaterial && s.materiais.length === 0) o.mat.push("Adicione ao menos um item");
  s.materiais.forEach((m, i) => {
    const n = `Item ${i + 1}: `;
    if (!m.item?.trim()) o.mat.push(`${n}qual item`);
    if (!m.chegou) o.mat.push(`${n}chegou?`);
    if (m.chegou && m.chegou !== "nao" && !m.confere) o.mat.push(`${n}confere com o executivo?`);
    if (m.confere === "div") {
      if (!m.fotoId) o.mat.push(`${n}foto da divergência`);
      if (!m.divergencia.trim()) o.mat.push(`${n}descrição da divergência`);
    }
  });

  if (s.temPrazo) {
    if (!s.prazo.data) o.prazo.push("Nova data de entrega");
    if (!s.prazo.motivo) o.prazo.push("Motivo");
    if (!s.prazo.avisado) o.prazo.push("Cliente já foi avisado?");
  }
  return o;
}

const ORDEM_ERROS: TelaValidada[] = ["id", "etapas", "equipe", "pend", "mat", "prazo"];

/** Tudo o que falta, com a tela onde se corrige (para "Conferir e enviar"). */
export function errosComTela(v: Erros): Array<{ texto: string; tela: TelaValidada }> {
  return ORDEM_ERROS.flatMap((k) => v[k].map((texto) => ({ texto, tela: k })));
}

// ---------------------------------------------------------------------------
// Ações (reducer)
// ---------------------------------------------------------------------------

export type DiarioAction =
  | { type: "data"; escolha: "hoje" | "ontem" }
  | { type: "obra"; id: string }
  | { type: "funcao"; funcao: Funcao }
  | { type: "abrirEtapa"; id: string }
  | { type: "status"; id: string; status: StatusEtapa }
  | { type: "etapa"; id: string; patch: Partial<EtapaRelato> }
  | { type: "nenhumaEtapa" }
  | { type: "qtd"; delta: 1 | -1 }
  | { type: "nomes"; nomes: string }
  | { type: "terceiro"; nome: string }
  | { type: "triagem"; chave: "temPendencia" | "temMaterial" | "temPrazo"; valor: boolean }
  | { type: "pendencia"; id: string; patch: Partial<Pendencia> }
  | { type: "novaPendencia" }
  | { type: "removerPendencia"; id: string }
  | { type: "material"; id: string; patch: Partial<Material> }
  | { type: "chegou"; id: string; valor: Chegou }
  | { type: "confere"; id: string; valor: Confere }
  | { type: "novoMaterial" }
  | { type: "removerMaterial"; id: string }
  | { type: "prazo"; patch: Partial<MudancaPrazo> }
  | { type: "ir"; tela: Tela }
  | { type: "voltar" }
  | { type: "avancar"; etapas: readonly EtapaCronograma[] }
  | { type: "modalFicar" }
  | { type: "modalParaAndamento" }
  | { type: "modalDescartar" }
  | { type: "enviado"; offline: boolean }
  | { type: "novoRelato" };

function marcarStatus(s: DiarioState, id: string, status: StatusEtapa): DiarioState {
  const atual = relatoDaEtapa(s, id);
  // Tocar de novo na mesma situação desmarca.
  const novo = atual.status === status ? null : status;
  let pendencias = s.pendencias.filter((p) => !(p.etapaId === id && novo !== "impedida"));
  let seq = s.seq;
  if (novo === "impedida" && !pendencias.some((p) => p.etapaId === id)) {
    pendencias = [...pendencias, pendenciaVazia(`p${seq}`, id)];
    seq += 1;
  }
  // Concluída não tem agendamento de medição.
  const limpa = novo === "concluida" ? { agendada: false, dataMedicao: null, fornecedorId: null, fornecedorNome: null } : {};
  return {
    ...s,
    etapas: { ...s.etapas, [id]: { ...atual, ...limpa, status: novo } },
    pendencias,
    seq,
    nenhumaEtapa: novo ? false : s.nenhumaEtapa,
  };
}

function setTriagem(s: DiarioState, chave: "temPendencia" | "temMaterial" | "temPrazo", valor: boolean): DiarioState {
  if (chave === "temPendencia") {
    // Com etapa impedida, a resposta fica travada em Sim.
    if (!valor && pendenciaTravadaEmSim(s)) return s;
    if (valor && s.pendencias.length === 0) {
      return { ...s, temPendencia: true, pendencias: [pendenciaVazia(`p${s.seq}`)], seq: s.seq + 1 };
    }
    return { ...s, temPendencia: valor, pendencias: valor ? s.pendencias : s.pendencias.filter((p) => p.etapaId) };
  }
  if (chave === "temMaterial") {
    if (valor && s.materiais.length === 0) {
      return { ...s, temMaterial: true, materiais: [materialVazio(`m${s.seq}`)], seq: s.seq + 1 };
    }
    return { ...s, temMaterial: valor, materiais: valor ? s.materiais : [] };
  }
  return { ...s, temPrazo: valor, prazo: valor ? s.prazo : { data: null, motivo: null, avisado: null } };
}

export function diarioReducer(s: DiarioState, a: DiarioAction): DiarioState {
  switch (a.type) {
    case "data":
      return { ...s, dataEscolha: a.escolha };
    case "obra":
      // Trocar de obra troca o cronograma: o que foi marcado não vale mais.
      if (a.id === s.obraId) return s;
      return {
        ...s,
        obraId: a.id,
        aberta: null,
        etapas: {},
        nenhumaEtapa: false,
        pendencias: s.pendencias.filter((p) => !p.etapaId),
        materiais: s.materiais.map((m) => ({ ...m, item: null, purchaseId: null })),
      };
    case "funcao":
      return { ...s, funcao: a.funcao };
    case "abrirEtapa":
      return { ...s, aberta: s.aberta === a.id ? null : a.id };
    case "status":
      return marcarStatus(s, a.id, a.status);
    case "etapa":
      return { ...s, etapas: { ...s.etapas, [a.id]: { ...relatoDaEtapa(s, a.id), ...a.patch } } };
    case "nenhumaEtapa":
      return { ...s, nenhumaEtapa: !s.nenhumaEtapa };
    case "qtd":
      return { ...s, qtd: Math.max(0, s.qtd + a.delta) };
    case "nomes":
      return { ...s, nomes: a.nomes.slice(0, LIMITE_NOMES) };
    case "terceiro":
      return {
        ...s,
        terceiros: s.terceiros.includes(a.nome) ? s.terceiros.filter((t) => t !== a.nome) : [...s.terceiros, a.nome],
      };
    case "triagem":
      return setTriagem(s, a.chave, a.valor);
    case "pendencia":
      return { ...s, pendencias: s.pendencias.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) };
    case "novaPendencia":
      return { ...s, pendencias: [...s.pendencias, pendenciaVazia(`p${s.seq}`)], seq: s.seq + 1, temPendencia: true };
    case "removerPendencia": {
      // Pendência de etapa impedida só sai mudando a etapa.
      const alvo = s.pendencias.find((p) => p.id === a.id);
      if (!alvo || alvo.etapaId) return s;
      const pendencias = s.pendencias.filter((p) => p.id !== a.id);
      return { ...s, pendencias, temPendencia: pendencias.length > 0 ? s.temPendencia : false };
    }
    case "material":
      return { ...s, materiais: s.materiais.map((m) => (m.id === a.id ? { ...m, ...a.patch } : m)) };
    case "chegou":
      return {
        ...s,
        materiais: s.materiais.map((m) => {
          if (m.id !== a.id) return m;
          // Não chegou: não há o que conferir.
          if (a.valor === "nao") return { ...m, chegou: a.valor, confere: "nc", fotoId: null, divergencia: "" };
          return { ...m, chegou: a.valor, confere: m.chegou === "nao" ? null : m.confere };
        }),
      };
    case "confere":
      return {
        ...s,
        materiais: s.materiais.map((m) => {
          if (m.id !== a.id) return m;
          return a.valor === "div" ? { ...m, confere: a.valor } : { ...m, confere: a.valor, fotoId: null, divergencia: "" };
        }),
      };
    case "novoMaterial":
      return { ...s, materiais: [...s.materiais, materialVazio(`m${s.seq}`)], seq: s.seq + 1 };
    case "removerMaterial":
      return s.materiais.length > 1 ? { ...s, materiais: s.materiais.filter((m) => m.id !== a.id) } : s;
    case "prazo":
      return { ...s, prazo: { ...s.prazo, ...a.patch } };
    case "ir":
      return { ...s, tela: a.tela };
    case "voltar": {
      // Não se sai da tela de pendências deixando uma pela metade.
      if (s.tela === "pend" && s.pendencias.some(pendenciaIncompleta)) return { ...s, modal: true };
      const c = cadeia(s);
      const i = c.indexOf(s.tela);
      return i > 0 ? { ...s, tela: c[i - 1] } : s;
    }
    case "avancar": {
      const v = validar(s, a.etapas);
      if (s.tela === "ok") return s;
      if (s.tela === "conf") {
        return errosComTela(v).length > 0 ? { ...s, tentou: { ...s.tentou, conf: true } } : s;
      }
      if (s.tela !== "triagem" && v[s.tela].length > 0) {
        return { ...s, tentou: { ...s.tentou, [s.tela]: true } };
      }
      const c = cadeia(s);
      return { ...s, tela: c[Math.min(c.length - 1, c.indexOf(s.tela) + 1)] };
    }
    case "modalFicar":
      return { ...s, modal: false, tentou: { ...s.tentou, pend: true } };
    case "modalParaAndamento": {
      const ids = s.pendencias.filter((p) => p.etapaId && pendenciaIncompleta(p)).map((p) => p.etapaId as string);
      const etapas = { ...s.etapas };
      for (const id of ids) etapas[id] = { ...relatoDaEtapa(s, id), status: "andamento" };
      const pendencias = s.pendencias.filter((p) => !(p.etapaId && ids.includes(p.etapaId)));
      return {
        ...s,
        etapas,
        pendencias,
        temPendencia: pendencias.length > 0 ? s.temPendencia : false,
        modal: false,
        tela: "triagem",
      };
    }
    case "modalDescartar": {
      const pendencias = s.pendencias.filter((p) => !(pendenciaIncompleta(p) && !p.etapaId));
      return { ...s, pendencias, temPendencia: pendencias.length > 0, modal: false, tela: "triagem" };
    }
    case "enviado":
      return { ...s, tela: "ok", enviadoOffline: a.offline };
    case "novoRelato":
      // Você e a data ficam salvos. Escolha só a obra.
      return { ...estadoInicial(), dataEscolha: s.dataEscolha, funcao: s.funcao };
    default:
      return s;
  }
}

// ---------------------------------------------------------------------------
// Textos derivados
// ---------------------------------------------------------------------------

/** Aviso ao tentar voltar com pendência pela metade. */
export function avisoPendencia(s: DiarioState) {
  const ligada = s.pendencias.some((p) => p.etapaId && pendenciaIncompleta(p));
  const avulsa = s.pendencias.some((p) => !p.etapaId && pendenciaIncompleta(p));
  return {
    ligada,
    avulsa: avulsa && !ligada,
    texto: ligada
      ? "Você marcou uma etapa como Impedida. Ela precisa de responsável e prazo para sair desta tela. Sem isso a obra fica parada sem dono."
      : "Esta pendência está sem descrição, responsável, prazo ou resposta de “trava a obra”. Preencha ou descarte.",
  };
}

export function rotuloBotao(s: DiarioState, online: boolean): string {
  if (s.tela === "triagem") {
    return temPendenciaEfetivo(s) || s.temMaterial || s.temPrazo ? "Continuar" : "Conferir e enviar";
  }
  if (s.tela === "pend" || s.tela === "mat" || s.tela === "prazo") {
    const c = cadeia(s);
    return c[c.indexOf(s.tela) + 1] === "conf" ? "Conferir e enviar" : "Continuar";
  }
  if (s.tela === "conf") return online ? "Enviar relatório" : "Salvar e enviar quando houver sinal";
  return "Continuar";
}

/** Botão em cinza: falta algo e a pessoa ainda não tentou avançar. */
export function botaoApagado(s: DiarioState, v: Erros): boolean {
  if (s.tela === "conf") return errosComTela(v).length > 0;
  if (s.tela === "triagem" || s.tela === "ok") return false;
  return v[s.tela].length > 0 && !s.tentou[s.tela];
}

export const notaDeEnvio = (online: boolean) =>
  online
    ? "Ao enviar, as etapas viram baixa e as pendências viram tarefas com dono e prazo. O que é do cliente entra sozinho na atualização semanal do portal."
    : "Sem sinal: o relato fica salvo no aparelho e sobe sozinho quando a conexão voltar.";

/** Linha de efeito de cada etapa em "Conferir e enviar". */
export function efeitoDaEtapa(etapa: EtapaCronograma, e: EtapaRelato, dia: string): string {
  const marco = marcoDaEtapa(etapa.description);
  let t = "Foto anexada";
  if (e.status === "concluida") t += ` · vira término real em ${ddmm(dia)}`;
  if (e.status === "concluida" && marco === "eletrica") t += " · define INÍCIO REAL da obra";
  if (marco === "medicao") {
    t += ` · medição de ${e.tipo ? TIPO_MINUSCULO[e.tipo] : ""}`;
    if (e.status === "concluida" && (e.tipo === "marmoraria" || e.tipo === "vidracaria")) {
      t += " · define INÍCIO REAL da obra";
    }
    if (e.status === "concluida" && e.tipo === "marcenaria") t += " · não define início";
    if (e.status !== "concluida" && e.agendada && e.dataMedicao) {
      t += ` · agendada ${ddmm(e.dataMedicao)} com ${e.fornecedorNome ?? ""}`;
    }
  }
  if (e.status === "impedida") t += " · abriu pendência";
  return t;
}

export function resumoPendencia(p: Pendencia) {
  return {
    titulo: p.descricao || "[sem descrição]",
    selo: p.trava === true ? "Trava a obra" : p.trava === false ? "Não trava" : "Incompleta",
    tom: (p.trava === false ? "neutro" : "alerta") as "neutro" | "alerta",
    meta: `Resp.: ${p.responsavel || "—"} · Prazo: ${p.prazo ? ddmm(p.prazo) : "—"}`,
  };
}

export function resumoMaterial(m: Material) {
  const selo =
    m.confere === "div" ? "Divergente" : m.confere === "ok" ? "Confere" : m.chegou === "nao" ? "Não chegou" : "Não conferido";
  const tom = (m.confere === "div" ? "alerta" : m.confere === "ok" ? "ok" : "neutro") as "alerta" | "ok" | "neutro";
  const chegou = m.chegou ? CHEGOU_RESUMO[m.chegou] : "—";
  const resto =
    m.confere === "div"
      ? ` · ${m.divergencia} · foto anexada`
      : m.chegou !== "nao" && m.confere
        ? ` · ${CONFERE_RESUMO[m.confere]}`
        : "";
  return { titulo: m.item || "[sem item]", selo, tom, meta: chegou + resto };
}

export function resumoPrazo(p: MudancaPrazo) {
  const motivo = MOTIVOS_PRAZO.find(([k]) => k === p.motivo)?.[1];
  return {
    titulo: `Nova entrega: ${p.data ? ddmm(p.data) : "—"}`,
    meta: `Motivo: ${motivo ?? "—"} · ${p.avisado ? AVISADO_RESUMO[p.avisado] : "aviso ao cliente: —"}`,
  };
}

/** "O que segue" na tela Pronto. */
export function linhasDoEnvio(s: DiarioState, etapas: readonly EtapaCronograma[]): string[] {
  const tocadas = etapasTocadas(s, etapas);
  const concluidas = tocadas.filter((e) => relatoDaEtapa(s, e.id).status === "concluida").length;
  const linhas = [
    `${tocadas.length} etapa(s) tocada(s) · ${concluidas} com término real`,
    `Equipe: ${s.qtd} pessoa(s)`,
  ];
  if (s.pendencias.length > 0) linhas.push(`${s.pendencias.length} pendência(s) com dono e prazo`);
  if (s.materiais.length > 0) {
    linhas.push(
      `${s.materiais.length} item(ns) de material${s.materiais.some((m) => m.confere === "div") ? " · divergência sinalizada" : ""}`,
    );
  }
  if (s.temPrazo) linhas.push(`Nova data de entrega: ${s.prazo.data ? ddmm(s.prazo.data) : "—"}`);
  if (tocadas.length > 0) {
    linhas.push(`Portal do cliente: ${tocadas.length} etapa(s) entram sozinhas na atualização semanal`);
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Texto do cliente
// ---------------------------------------------------------------------------

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Texto de uma etapa para o relatório do cliente. Macro, como o cliente deve
 * ver: SEM nomes da equipe, sem motivos internos; das pendências só a conta.
 */
export function gerarTextoCliente(input: {
  etapa: string;
  status: StatusEtapa;
  /** yyyy-mm-dd */
  dia: string;
  equipe: number;
  fotos: number;
  pendencias: number;
  defineInicio: boolean;
  proximaEtapa: string | null;
}): string {
  const data = diaCurto(input.dia);
  const linhas = [
    input.status === "concluida"
      ? `${input.etapa} concluída em ${data}.`
      : input.status === "andamento"
        ? `${input.etapa} em andamento, com serviço executado em ${data}.`
        : `${input.etapa} aguardando liberação para seguir, registrado em ${data}.`,
  ];
  if (input.equipe > 0) linhas.push(`Equipe de ${plural(input.equipe, "pessoa", "pessoas")} na obra no dia.`);
  if (input.fotos > 0) {
    linhas.push(
      `${plural(input.fotos, "foto do serviço registrada", "fotos do serviço registradas")} no relatório de campo.`,
    );
  }
  if (input.defineInicio) linhas.push("A conclusão desta etapa marca o início real da obra.");
  if (input.pendencias > 0) {
    linhas.push(
      `${plural(input.pendencias, "pendência", "pendências")} em acompanhamento, com responsável e prazo definidos.`,
    );
  }
  if (input.proximaEtapa) linhas.push(`Próxima etapa: ${input.proximaEtapa}.`);
  return linhas.join("\n").slice(0, LIMITE_TEXTO_CLIENTE);
}

/** Próxima etapa em aberto no cronograma, depois desta. */
export function proximaEtapaDe(etapas: readonly EtapaCronograma[], id: string, s?: DiarioState): string | null {
  const ordem = [...etapas].sort((a, b) => a.sortOrder - b.sortOrder || a.plannedStart.localeCompare(b.plannedStart));
  const i = ordem.findIndex((e) => e.id === id);
  const seguinte = ordem
    .slice(i + 1)
    .find((e) => !e.actualEnd && !(s && relatoDaEtapa(s, e.id).status === "concluida"));
  return seguinte?.description ?? null;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

export interface DiarioPayload {
  client_id: string;
  project_id: string;
  report_date: string;
  reporter_function: Funcao;
  no_progress: boolean;
  team_count: number;
  team_names: string;
  third_parties: string[];
  sent_offline: boolean;
  etapas: Array<{
    item_id: string;
    status: StatusEtapa;
    /** Preenchido depois do upload da foto. */
    photo_path: string | null;
    foto_id: string;
    medicao_tipo: TipoMedicao | null;
    medicao_agendada: boolean;
    medicao_data: string | null;
    medicao_fornecedor_id: string | null;
    texto_cliente: string;
  }>;
  pendencias: Array<{
    etapa_item_id: string | null;
    descricao: string;
    responsavel: string;
    responsavel_user_id: string | null;
    prazo: string;
    trava_obra: boolean;
  }>;
  materiais: Array<{
    item: string;
    purchase_id: string | null;
    chegou: Chegou;
    confere: Confere;
    divergencia_foto_path: string | null;
    foto_id: string | null;
    divergencia_descricao: string | null;
  }>;
  prazo: { data: string; motivo: MotivoPrazo; avisado: Avisado } | null;
}

/**
 * Monta o que vai para `diario_obra_enviar`. Só chamar com o relato válido
 * (`validar` sem erros). Os caminhos das fotos entram depois do upload.
 */
export function montarPayload(input: {
  state: DiarioState;
  etapas: readonly EtapaCronograma[];
  clientId: string;
  hoje: string;
  offline: boolean;
}): DiarioPayload {
  const { state: s, etapas } = input;
  const dia = dataDoRelato(s.dataEscolha, input.hoje);
  const tocadas = etapasTocadas(s, etapas);
  return {
    client_id: input.clientId,
    project_id: s.obraId as string,
    report_date: dia,
    reporter_function: s.funcao,
    no_progress: tocadas.length === 0 && s.nenhumaEtapa,
    team_count: s.qtd,
    team_names: s.nomes.trim(),
    third_parties: s.terceiros,
    sent_offline: input.offline,
    etapas: tocadas.map((d) => {
      const e = relatoDaEtapa(s, d.id);
      const marco = marcoDaEtapa(d.description);
      const agendada = marco === "medicao" && e.status !== "concluida" && e.agendada;
      return {
        item_id: d.id,
        status: e.status as StatusEtapa,
        photo_path: null,
        foto_id: e.fotoId as string,
        medicao_tipo: marco === "medicao" ? e.tipo : null,
        medicao_agendada: agendada,
        medicao_data: agendada ? e.dataMedicao : null,
        medicao_fornecedor_id: agendada ? e.fornecedorId : null,
        texto_cliente: gerarTextoCliente({
          etapa: d.description,
          status: e.status as StatusEtapa,
          dia,
          equipe: s.qtd,
          fotos: 1,
          pendencias: s.pendencias.filter((p) => p.etapaId === d.id).length,
          defineInicio: defineInicioReal(marco, e),
          proximaEtapa: proximaEtapaDe(etapas, d.id, s),
        }),
      };
    }),
    pendencias: s.pendencias.map((p) => ({
      etapa_item_id: p.etapaId,
      descricao: p.descricao.trim().slice(0, LIMITE_TEXTO_CURTO),
      responsavel: p.responsavel as string,
      responsavel_user_id: p.responsavelUserId,
      prazo: p.prazo as string,
      trava_obra: p.trava as boolean,
    })),
    materiais: s.materiais.map((m) => ({
      item: (m.item as string).trim(),
      purchase_id: m.purchaseId,
      chegou: m.chegou as Chegou,
      confere: m.chegou === "nao" ? "nc" : (m.confere as Confere),
      divergencia_foto_path: null,
      foto_id: m.confere === "div" ? m.fotoId : null,
      divergencia_descricao: m.confere === "div" ? m.divergencia.trim().slice(0, LIMITE_TEXTO_CURTO) : null,
    })),
    prazo: s.temPrazo
      ? { data: s.prazo.data as string, motivo: s.prazo.motivo as MotivoPrazo, avisado: s.prazo.avisado as Avisado }
      : null,
  };
}
