/**
 * Roteamento do master_bwild para os agentes especialistas.
 * Implementa as `routing_rules` da spec.
 *
 * Estratégia: classificação por palavras-chave do conteúdo + event_type.
 * Se nada bater, fica em master_bwild (resposta genérica e pede esclarecimento).
 */

import type { RoutedAgent } from './agentPrompts.ts';

export type AgentEventType =
  | 'new_project'
  | 'project_update'
  | 'schedule_request'
  | 'budget_request'
  | 'field_problem'
  | 'client_message'
  | 'supplier_quote'
  | 'purchase_decision'
  | 'quality_inspection'
  | 'scope_change'
  | 'handover';

interface KeywordRule {
  agent: RoutedAgent;
  patterns: RegExp[];
}

// Ordem importa: primeira regra que casar vence.
const KEYWORD_RULES: KeywordRule[] = [
  { agent: 'delay_recovery',         patterns: [/\batras[oa]\b/i, /\bgargalo\b/i, /\brecuper(?:ar|a[cç][aã]o)\b/i] },
  { agent: 'millwork_agent',         patterns: [/\bmarcenaria\b/i, /\bmarceneiro\b/i, /\barmari[oa]s?\s+(?:planejad|sob\s+medida)/i] },
  { agent: 'stonework_agent',        patterns: [/\bmarmorari[ao]\b/i, /\bbancad(?:a|ão)\b/i, /\bquartzo\b/i, /\bgranito\b/i, /\bm[aá]rmore\b/i] },
  { agent: 'coordination_engineer',  patterns: [/\bcompatibili(?:zar|za[cç][aã]o)\b/i, /\bconflito\b/i, /\binterferenc?ia\b/i] },
  { agent: 'procurement_manager',    patterns: [/\bcompras?\b/i, /\bpedido\b/i, /\bsupriment[oas]/i, /\blead\s*time\b/i] },
  { agent: 'supplier_evaluator',     patterns: [/\bfornecedor\b/i, /\bcota[cç][aã]o\b/i, /\borcament(?:ista)?\b/i] },
  { agent: 'cost_engineer',          patterns: [/\bcusto\b/i, /\bor[cç]amento\b/i, /\bmargem\b/i, /\bestouro\b/i] },
  { agent: 'schedule_planner',       patterns: [/\bcronograma\b/i, /\bplanejament[oa]\b/i, /\bprazo\b/i, /\bcaminho\s+cr[ií]tico\b/i] },
  { agent: 'risk_manager',           patterns: [/\brisco\b/i, /\bcontingenc?ia\b/i, /\bmitiga[cç][aã]o\b/i] },
  { agent: 'quality_controller',     patterns: [/\bqualidade\b/i, /\binspe[cç][aã]o\b/i, /\bn[aã]o\s*conformidade\b/i, /\bchecklist\b/i] },
  { agent: 'root_cause_engineer',    patterns: [/\bproblema\b/i, /\bdefeito\b/i, /\bfissur[ao]\b/i, /\binfiltra[cç][aã]o\b/i, /\bvazament[oa]\b/i] },
  { agent: 'handover_postwork',      patterns: [/\bentrega\b/i, /\bp[oó]s[-\s]?obra\b/i, /\bpunch\s*list\b/i, /\bvistoria\s+final\b/i] },
  { agent: 'field_engineer',         patterns: [/\bequipe\b/i, /\bexecu[cç][aã]o\b/i, /\bobra\s+(?:hoje|amanh[aã]|semana)/i, /\bproduti?vidade\b/i] },
  { agent: 'client_communication',   patterns: [/\bcliente\b/i, /\bmensagem\b/i, /\be[-\s]?mail\b/i, /\bwhatsapp\b/i] },
];

// Mapa direto de event_type → agente (fallback antes do master).
const EVENT_TYPE_HINTS: Partial<Record<AgentEventType, RoutedAgent>> = {
  schedule_request: 'schedule_planner',
  budget_request: 'cost_engineer',
  field_problem: 'root_cause_engineer',
  client_message: 'client_communication',
  supplier_quote: 'supplier_evaluator',
  purchase_decision: 'procurement_manager',
  quality_inspection: 'quality_controller',
  scope_change: 'cost_engineer',
  handover: 'handover_postwork',
};

export interface RoutingDecision {
  agent: RoutedAgent;
  reason: string;
}

export function routeRequest(opts: {
  event_type: AgentEventType;
  content: string;
}): RoutingDecision {
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.some((re) => re.test(opts.content))) {
      return { agent: rule.agent, reason: 'keyword_match' };
    }
  }

  const fromEvent = EVENT_TYPE_HINTS[opts.event_type];
  if (fromEvent) {
    return { agent: fromEvent, reason: 'event_type' };
  }

  return { agent: 'master_bwild', reason: 'default' };
}
