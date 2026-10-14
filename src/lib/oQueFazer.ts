/**
 * Tela "O que fazer": tudo o que a pessoa precisa resolver, de todas as suas
 * obras, numa lista só, da mais grave para a mais leve. Cada item é uma ação
 * curta com o endereço de onde se resolve.
 *
 * - Obras em execução: as pendências de `pendencias()` (proximoPasso.ts).
 * - Obras em fase de projeto: a etapa atual atrasada, vencendo, sem prazo ou
 *   sem registro.
 * - "Minhas" = a pessoa é responsável pela obra (ou, em projeto, pela etapa
 *   atual). Sem nenhuma obra dela, a tela mostra todas.
 *
 * Regras puras, testadas em oQueFazer.test.ts.
 */
import { pendencias, type PassoTom, type ProximoPasso } from "@/lib/proximoPasso";
import { PROJETO_PARADO_DIAS, type ProjetoRow } from "@/lib/painelNovo";
import { ddmm, type ObraRow } from "@/lib/obrasPainel";
import { shiftISODate } from "@/lib/hojeDia";

export interface Tarefa {
  /** Chave estável (obra + texto). */
  key: string;
  obraId: string;
  obraNome: string;
  texto: string;
  tom: PassoTom;
  href: string;
  /** Rótulo do botão: "Abrir o Hoje", "Planejar", "Abrir o cronograma"… */
  acao: string;
  fase: "execucao" | "projeto";
}

export interface OQueFazer {
  /** Vermelho, depois amarelo, depois o resto. */
  tarefas: Tarefa[];
  /** Obras do escopo sem nenhuma pendência (só nome). */
  emDia: { id: string; nome: string }[];
  /** Quantas obras do escopo têm pelo menos uma pendência. */
  obrasComPendencia: number;
  /** Escopo usado: as obras da pessoa ou todas. */
  escopo: "minhas" | "todas";
}

const TOM_ORDEM: Record<PassoTom, number> = { vermelho: 0, amarelo: 1, neutro: 2, ok: 3 };

/** Endereço de onde resolver uma pendência de obra em execução. */
export function hrefDoPasso(
  obraId: string,
  passo: Pick<ProximoPasso, "onde" | "semana">,
  monday: string,
): { href: string; acao: string } {
  switch (passo.onde) {
    case "hoje":
      return { href: `/gestao/hoje?obra=${obraId}`, acao: "Abrir o Hoje" };
    case "cronograma":
      return { href: `/obra/${obraId}/cronograma-interno`, acao: "Abrir o cronograma" };
    case "obra":
      return { href: `/gestao/painel-obras?obra=${obraId}`, acao: "Abrir a obra" };
    case "semana": {
      const semana = passo.semana === "proxima" ? shiftISODate(monday, 7) : passo.semana === "anterior" ? shiftISODate(monday, -7) : monday;
      return {
        href: `/gestao/semana?obra=${obraId}&semana=${semana}`,
        acao: passo.semana === "anterior" ? "Fechar a semana" : "Abrir a semana",
      };
    }
  }
}

/** A pendência de uma obra em fase de projeto (no máximo uma: a etapa atual). */
export function tarefaDoProjeto(p: ProjetoRow): Omit<Tarefa, "key" | "obraId" | "obraNome" | "fase"> | null {
  if (p.paused) return null;
  const href = `/gestao/painel-obras?fase=projetos&obra=${p.id}`;
  const acao = "Abrir o projeto";
  const etapa = p.phase?.current;
  if (p.phase && !p.phase.registered) {
    if (p.staleDays != null && p.staleDays >= PROJETO_PARADO_DIAS) {
      return { texto: `Registrar em que etapa do projeto está (sem atualização há ${p.staleDays} dias)`, tom: "amarelo", href, acao };
    }
    return { texto: "Registrar em que etapa do projeto está", tom: "neutro", href, acao };
  }
  if (!etapa || !p.verdict) return null;
  switch (p.verdict.verdict) {
    case "atrasada":
      return {
        texto: `Cobrar ${etapa.label} (etapa ${p.verdict.text.toLowerCase()})`,
        tom: "vermelho",
        href,
        acao,
      };
    case "vence_logo":
      return {
        texto: `${etapa.label}: ${p.verdict.text.toLowerCase()}${etapa.dueDate ? ` (${ddmm(etapa.dueDate)})` : ""}`,
        tom: "amarelo",
        href,
        acao,
      };
    case "sem_prazo":
      return { texto: `Combinar prazo para ${etapa.label}`, tom: "neutro", href, acao };
    default:
      return null;
  }
}

export function montarOQueFazer(input: {
  rows: readonly ObraRow[];
  projetos: readonly ProjetoRow[];
  userId: string | null;
  /** Segunda-feira da semana atual (planejamento). */
  monday: string;
  /** Escolha da pessoa; null = automático (minhas, se houver). */
  escopo: "minhas" | "todas" | null;
}): OQueFazer {
  const { rows, projetos, userId, monday } = input;
  const minhaObra = (r: ObraRow) => !!userId && r.responsibleId === userId;
  const meuProjeto = (p: ProjetoRow) => !!userId && (p.responsibleId === userId || p.stepResponsibleId === userId);
  const temMinhas = rows.some(minhaObra) || projetos.some(meuProjeto);
  const escopo = input.escopo ?? (temMinhas ? "minhas" : "todas");
  const rowsEsc = escopo === "minhas" ? rows.filter(minhaObra) : [...rows];
  const projEsc = escopo === "minhas" ? projetos.filter(meuProjeto) : [...projetos];

  const tarefas: Tarefa[] = [];
  const emDia: { id: string; nome: string }[] = [];
  const comPendencia = new Set<string>();

  for (const r of rowsEsc) {
    const lista = pendencias(r);
    if (lista.length === 0) {
      if (!r.cadastro?.paused) emDia.push({ id: r.id, nome: r.name });
      continue;
    }
    comPendencia.add(r.id);
    for (const p of lista) {
      tarefas.push({
        key: `${r.id}:${p.texto}`,
        obraId: r.id,
        obraNome: r.name,
        texto: p.texto,
        tom: p.tom,
        fase: "execucao",
        ...hrefDoPasso(r.id, p, monday),
      });
    }
  }
  for (const p of projEsc) {
    const t = tarefaDoProjeto(p);
    if (!t) continue;
    comPendencia.add(p.id);
    tarefas.push({ key: `${p.id}:${t.texto}`, obraId: p.id, obraNome: p.name, fase: "projeto", ...t });
  }

  // Estável: dentro do mesmo tom, mantém a ordem das obras (já vêm por risco).
  tarefas.sort((a, b) => TOM_ORDEM[a.tom] - TOM_ORDEM[b.tom]);
  return { tarefas, emDia, obrasComPendencia: comPendencia.size, escopo };
}
