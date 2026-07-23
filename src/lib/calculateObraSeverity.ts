/**
 * calculateObraSeverity — score de severidade 0–100 por obra, staff-only.
 *
 * Escopo: SUPERSEDE parcial da constraint "não recriar Health Score" (mem://
 * constraints/health-score-removed) — decisão do gestor em 23/07/2026,
 * restrita ao Painel de Obras (staff-only, /gestao/painel-obras). Continua
 * PROIBIDO expor score em qualquer superfície do cliente.
 *
 * Pesos (soma = 100):
 *  - 35% desvio de prazo         (0..30 dias de atraso)
 *  - 30% variação de custo (EAC) (0..15% de estouro)
 *  - 15% pendências vencidas     (0..10 itens)
 *  - 10% compras críticas        (0..5 itens, entregas ≤14d não recebidas)
 *  - 10% desatualização          (0..120h desde o último update)
 *
 * Classificação:
 *  - 0..29  → 'saudavel'
 *  - 30..59 → 'atencao'
 *  - 60..100 → 'critica'
 *
 * Gatilhos que forçam 'critica' independentemente do score:
 *  - atraso > 15 dias
 *  - variação de custo > 10%
 *  - NC crítica aberta (>0)
 *  - sem atualização > 120h
 *
 * Função PURA (testável). Recebe apenas primitivos.
 */

export type SeverityLevel = "saudavel" | "atencao" | "critica";

export interface SeverityInputs {
  /** Dias corridos de atraso vs entrega oficial. 0 quando não atrasada. */
  overdueDays: number;
  /** Variação % do EAC vs orçado. null quando não há dados de custo. */
  variacaoPct: number | null;
  /** Pendências vencidas da obra. */
  pendingOverdue: number;
  /** Compras críticas — entregas previstas ≤14d ainda não recebidas. */
  comprasCriticas: number;
  /** Horas desde o último update relevante da obra. null quando desconhecido. */
  hoursSinceUpdate: number | null;
  /** NCs críticas em aberto. */
  ncsCriticas: number;
}

export interface SeverityComponents {
  prazo: number;         // 0..35
  financeiro: number;    // 0..30
  pendencias: number;    // 0..15
  compras: number;       // 0..10
  desatualizacao: number; // 0..10
}

export interface SeverityBreakdown {
  score: number;                 // 0..100 arredondado
  level: SeverityLevel;
  /** True quando algum gatilho forçou 'critica' independentemente do score. */
  triggeredCritical: boolean;
  components: SeverityComponents;
  /** Motivos legíveis dos gatilhos críticos (para tooltip/breakdown). */
  criticalReasons: string[];
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/**
 * Score puro e determinístico. Não depende de Date.now() nem de nada externo.
 */
export function calculateObraSeverity(
  input: SeverityInputs,
): SeverityBreakdown {
  // Prazo: 0..30d → 0..35
  const prazoRatio = clamp(input.overdueDays / 30, 0, 1);
  const prazo = prazoRatio * 35;

  // Financeiro: usa apenas estouro (>0). Sem dados → 0.
  const varPos = input.variacaoPct != null ? Math.max(0, input.variacaoPct) : 0;
  const financeiro = clamp(varPos / 15, 0, 1) * 30;

  // Pendências vencidas: 0..10 → 0..15
  const pendencias = clamp(input.pendingOverdue / 10, 0, 1) * 15;

  // Compras críticas: 0..5 → 0..10
  const compras = clamp(input.comprasCriticas / 5, 0, 1) * 10;

  // Desatualização: 0..120h → 0..10 (null = 0)
  const horas = input.hoursSinceUpdate ?? 0;
  const desatualizacao = clamp(horas / 120, 0, 1) * 10;

  const rawScore = prazo + financeiro + pendencias + compras + desatualizacao;
  const score = Math.round(clamp(rawScore, 0, 100));

  // Gatilhos críticos absolutos
  const criticalReasons: string[] = [];
  if (input.overdueDays > 15)
    criticalReasons.push(`Atraso de ${input.overdueDays} dias (>15d)`);
  if (input.variacaoPct != null && input.variacaoPct > 10)
    criticalReasons.push(
      `Estouro de custo ${input.variacaoPct.toFixed(1)}% (>10%)`,
    );
  if (input.ncsCriticas > 0)
    criticalReasons.push(`${input.ncsCriticas} NC crítica(s) aberta(s)`);
  if (input.hoursSinceUpdate != null && input.hoursSinceUpdate > 120)
    criticalReasons.push(
      `Sem atualização há ${Math.round(input.hoursSinceUpdate)}h (>120h)`,
    );

  const triggeredCritical = criticalReasons.length > 0;
  const level: SeverityLevel = triggeredCritical
    ? "critica"
    : score >= 60
      ? "critica"
      : score >= 30
        ? "atencao"
        : "saudavel";

  return {
    score,
    level,
    triggeredCritical,
    criticalReasons,
    components: {
      prazo: Math.round(prazo * 10) / 10,
      financeiro: Math.round(financeiro * 10) / 10,
      pendencias: Math.round(pendencias * 10) / 10,
      compras: Math.round(compras * 10) / 10,
      desatualizacao: Math.round(desatualizacao * 10) / 10,
    },
  };
}

/** Helper: label PT-BR de cada nível. */
export function severityLabel(level: SeverityLevel): string {
  return level === "critica"
    ? "Crítica"
    : level === "atencao"
      ? "Atenção"
      : "Saudável";
}

/** Helper: tom semântico para uso em Badge/pill. */
export function severityTone(
  level: SeverityLevel,
): "destructive" | "warning" | "success" {
  return level === "critica"
    ? "destructive"
    : level === "atencao"
      ? "warning"
      : "success";
}
