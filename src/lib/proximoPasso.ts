/**
 * "O que fazer" no Painel de Obras: UMA ação por obra, a mais importante,
 * escrita para quem está começando. A ordem segue o que trava a obra antes:
 *
 *   1. Etapa atrasada        → cobrar a etapa (ou lançar o término)
 *   2. Atividade crítica não feita
 *   3. Algo que deveria ter começado e não tem início lançado
 *   4. Falta material com prazo perto
 *   5. Semana sem nenhum dia marcado (com trabalho previsto)
 *   6. Semana passada sem fechar
 *   7. Semana que vem sem dia marcado (com trabalho previsto)
 *   8. Cadastro faltando: cronograma, prazo do contrato, entrega real
 *
 * Regras puras: só olham a linha já calculada (`ObraRow`).
 */
import type { ObraRow } from "@/lib/obrasPainel";

export type PassoTom = "vermelho" | "amarelo" | "neutro" | "ok";

export interface ProximoPasso {
  /** Frase curta, no imperativo: "Cobrar a elétrica (4 dias atrasada)". */
  texto: string;
  tom: PassoTom;
  /**
   * Onde resolver: o Hoje (começou? terminou?), a Semana da obra, o
   * cronograma interno ou o cadastro da obra.
   */
  onde: "hoje" | "semana" | "cronograma" | "obra";
  /** Para `onde: "semana"`: qual semana abrir (padrão: esta). */
  semana?: "anterior" | "proxima";
  /** Quantas outras pendências a obra tem (além desta). */
  outras: number;
}

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Lista as pendências da obra, da mais importante para a menos. */
export function pendencias(row: ObraRow): Omit<ProximoPasso, "outras">[] {
  const out: Omit<ProximoPasso, "outras">[] = [];
  const a = row.andamento;
  const paused = row.cadastro?.paused === true;

  if (row.cadastro?.etapa === "Finalizada") {
    out.push({ texto: "Lançar a data de entrega da obra", tom: "amarelo", onde: "obra" });
  }

  const atrasadas = (a?.agora ?? []).filter((i) => i.state === "atrasada");
  if (atrasadas.length > 0) {
    const i = atrasadas[0];
    const mais = atrasadas.length > 1 ? ` +${atrasadas.length - 1}` : "";
    out.push({
      texto: `Cobrar ${i.name} (${dias(i.lateDays)} atrasada)${mais}`,
      tom: "vermelho",
      onde: "hoje",
    });
  }

  const critica = row.alerts.find((x) => x.kind === "critica_nao_feita");
  if (critica) {
    const texto = critica.text.startsWith("Crítica não feita:")
      ? critica.text.replace("Crítica não feita:", "Remarcar o que não foi feito:")
      : `Remarcar ${critica.text.replace(" não feitas", "")} que não foram feitas`;
    out.push({ texto, tom: "vermelho", onde: "semana" });
  }

  const semInicio = (a?.agora ?? []).filter((i) => i.state === "sem_inicio" && i.lateDays > 0);
  if (semInicio.length > 0) {
    const i = semInicio[0];
    const mais = semInicio.length > 1 ? ` +${semInicio.length - 1}` : "";
    out.push({ texto: `Confirmar se ${i.name} começou${mais}`, tom: "amarelo", onde: "hoje" });
  }

  const material = row.alerts.find((x) => x.kind === "material");
  if (material) {
    out.push({
      texto: material.text.replace("Falta material:", "Comprar").replace(/\((\S+)\)/, "(até $1)"),
      tom: "amarelo",
      onde: "semana",
    });
  }

  if (!paused && row.week.unplanned) {
    out.push({ texto: "Planejar esta semana (nenhum dia marcado)", tom: "amarelo", onde: "semana" });
  }
  if (row.week.previous?.pending) {
    out.push({ texto: "Fechar a semana passada", tom: "amarelo", onde: "semana", semana: "anterior" });
  }

  const temSemanaQueVem = (a?.proximaSemana.length ?? 0) > 0 || (a?.continuaProximaSemana.length ?? 0) > 0;
  if (!paused && temSemanaQueVem && row.nextWeekPlanned === 0) {
    out.push({ texto: "Planejar a semana que vem", tom: "neutro", onde: "semana", semana: "proxima" });
  }

  if (!a || a.fase === "sem_cronograma") {
    out.push({ texto: "Montar o cronograma da obra", tom: "amarelo", onde: "cronograma" });
  } else if (a.fase === "fim" && row.cadastro?.etapa !== "Finalizada") {
    out.push({ texto: "Etapas concluídas: lançar a entrega da obra", tom: "neutro", onde: "obra" });
  }
  if (!row.deadline) out.push({ texto: "Cadastrar o prazo do contrato", tom: "neutro", onde: "obra" });

  return out;
}

/** A ação mais importante da obra, ou "tudo em dia". */
export function proximoPasso(row: ObraRow): ProximoPasso {
  const lista = pendencias(row);
  if (lista.length === 0) {
    return {
      texto: row.cadastro?.paused ? "Obra paralisada" : "Nada pendente",
      tom: row.cadastro?.paused ? "neutro" : "ok",
      onde: "semana",
      outras: 0,
    };
  }
  return { ...lista[0], outras: lista.length - 1 };
}

/** Folga em palavras: "sobram 3 dias", "atrasa 4 dias", "no limite". */
export function folgaTexto(slack: number | null): string | null {
  if (slack == null) return null;
  if (slack > 0) return `sobram ${dias(slack)}`;
  if (slack < 0) return `atrasa ${dias(-slack)}`;
  return "no limite";
}
