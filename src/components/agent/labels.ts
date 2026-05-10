/**
 * Tabelas de rótulos PT-BR para os enums do BWild Assessor.
 * Compartilhado entre AssessorSheet, AssessorResponse, AssessorEventsList,
 * AssessorMemoryView e a página dedicada `/obra/:projectId/assessor`.
 *
 * Spec autoritativa: docs/BWILD_AI_AGENTS_SPEC.yaml
 */

import type {
  AgentEventSource,
  AgentEventType,
  ProjectState,
  RoutedAgent,
} from "@/infra/repositories/agentMemory.repository";

export const EVENT_TYPE_LABEL: Record<AgentEventType, string> = {
  new_project: "Novo projeto",
  project_update: "Atualização do projeto",
  schedule_request: "Cronograma",
  budget_request: "Orçamento",
  field_problem: "Problema em campo",
  client_message: "Mensagem ao cliente",
  supplier_quote: "Cotação de fornecedor",
  purchase_decision: "Decisão de compra",
  quality_inspection: "Inspeção de qualidade",
  scope_change: "Mudança de escopo",
  handover: "Entrega / pós-obra",
};

export const SOURCE_LABEL: Record<AgentEventSource, string> = {
  cliente: "Cliente",
  equipe: "Equipe",
  fornecedor: "Fornecedor",
  gestor: "Gestor",
  vistoria: "Vistoria",
  documento: "Documento",
};

export const ROUTED_AGENT_LABEL: Record<RoutedAgent, string> = {
  master_bwild: "Master BWild",
  schedule_planner: "Planejador",
  cost_engineer: "Eng. de Custos",
  procurement_manager: "Suprimentos",
  field_engineer: "Eng. de Campo",
  root_cause_engineer: "Diagnóstico",
  coordination_engineer: "Compatibilização",
  risk_manager: "Riscos",
  quality_controller: "Qualidade",
  client_communication: "Comunicação",
  supplier_evaluator: "Aval. Fornecedor",
  millwork_agent: "Marcenaria",
  stonework_agent: "Marmoraria",
  delay_recovery: "Recup. de Atraso",
  handover_postwork: "Entrega / Pós-obra",
};

export const STATE_SECTION_LABEL: Record<keyof ProjectState, string> = {
  project_context: "Contexto do projeto",
  technical_scope: "Escopo técnico",
  design_status: "Status do projeto/design",
  schedule_state: "Cronograma",
  financial_state: "Financeiro",
  procurement_state: "Suprimentos",
  execution_state: "Execução",
  quality_state: "Qualidade",
  communication_state: "Comunicação",
};
