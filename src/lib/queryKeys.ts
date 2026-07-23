/**
 * Centralized Query Keys
 *
 * All query keys should be defined here for consistent cache management.
 * Use these keys in useQuery, useMutation invalidation, and prefetching.
 *
 * Pattern: queryKeys.{entity}({params}) returns a tuple for fine-grained invalidation.
 */

export const queryKeys = {
  // ============================================================================
  // Projects
  // ============================================================================
  projects: {
    all: ["projects"] as const,
    lists: () => [...queryKeys.projects.all, "list"] as const,
    list: (filters?: { status?: string; userId?: string }) =>
      [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, "detail"] as const,
    detail: (id: string | undefined) =>
      [...queryKeys.projects.details(), id] as const,
    summary: (id: string | undefined) =>
      [...queryKeys.projects.all, "summary", id] as const,
    members: (projectId: string | undefined) =>
      [...queryKeys.projects.all, "members", projectId] as const,
  },

  // ============================================================================
  // Documents
  // ============================================================================
  documents: {
    all: ["documents"] as const,
    lists: () => [...queryKeys.documents.all, "list"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.documents.lists(), projectId] as const,
    byCategory: (projectId: string | undefined, category: string) =>
      [...queryKeys.documents.list(projectId), "category", category] as const,
    detail: (documentId: string | undefined) =>
      [...queryKeys.documents.all, "detail", documentId] as const,
    versions: (documentId: string | undefined) =>
      [...queryKeys.documents.all, "versions", documentId] as const,
  },

  // ============================================================================
  // Activities (Cronograma)
  // ============================================================================
  activities: {
    all: ["activities"] as const,
    lists: () => [...queryKeys.activities.all, "list"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.activities.lists(), projectId] as const,
    detail: (activityId: string | undefined) =>
      [...queryKeys.activities.all, "detail", activityId] as const,
    baseline: (projectId: string | undefined) =>
      [...queryKeys.activities.all, "baseline", projectId] as const,
    alerts: () => [...queryKeys.activities.all, "alerts"] as const,
  },

  // ============================================================================
  // Formalizations
  // ============================================================================
  formalizacoes: {
    all: ["formalizacoes"] as const,
    lists: () => [...queryKeys.formalizacoes.all, "list"] as const,
    list: (filters?: { projectId?: string; status?: string; type?: string }) =>
      [...queryKeys.formalizacoes.lists(), filters] as const,
    detail: (id: string | undefined) =>
      [...queryKeys.formalizacoes.all, "detail", id] as const,
    parties: (id: string | undefined) =>
      [...queryKeys.formalizacoes.all, "parties", id] as const,
    versions: (id: string | undefined) =>
      [...queryKeys.formalizacoes.all, "versions", id] as const,
  },

  // ============================================================================
  // Payments
  // ============================================================================
  payments: {
    all: ["project-payments"] as const,
    lists: () => [...queryKeys.payments.all, "list"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.payments.lists(), projectId] as const,
    detail: (paymentId: string | undefined) =>
      [...queryKeys.payments.all, "detail", paymentId] as const,
  },

  // ============================================================================
  // Purchases
  // ============================================================================
  purchases: {
    all: ["project-purchases"] as const,
    lists: () => [...queryKeys.purchases.all, "list"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.purchases.lists(), projectId] as const,
    alerts: (projectId: string | undefined) =>
      [...queryKeys.purchases.all, "alerts", projectId] as const,
  },

  // ============================================================================
  // Pending Items
  // ============================================================================
  pendingItems: {
    all: ["pending-items"] as const,
    lists: () => [...queryKeys.pendingItems.all, "list"] as const,
    list: (projectId?: string, includeCompleted?: boolean) =>
      [...queryKeys.pendingItems.lists(), projectId, includeCompleted] as const,
    stats: (projectId?: string) =>
      [...queryKeys.pendingItems.all, "stats", projectId] as const,
  },

  // ============================================================================
  // Journey
  // ============================================================================
  journey: {
    all: ["journey"] as const,
    config: (projectId: string | undefined) =>
      [...queryKeys.journey.all, "config", projectId] as const,
    stages: (projectId: string | undefined) =>
      [...queryKeys.journey.all, "stages", projectId] as const,
    slots: (stageId: string | undefined) =>
      [...queryKeys.journey.all, "slots", stageId] as const,
  },

  // ============================================================================
  // Weekly Reports
  // ============================================================================
  weeklyReports: {
    all: ["weekly-reports"] as const,
    lists: () => [...queryKeys.weeklyReports.all, "list"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.weeklyReports.lists(), projectId] as const,
    detail: (reportId: string | undefined) =>
      [...queryKeys.weeklyReports.all, "detail", reportId] as const,
    current: (projectId: string | undefined) =>
      [...queryKeys.weeklyReports.all, "current", projectId] as const,
  },

  // ============================================================================
  // Users & Profiles
  // ============================================================================
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (filters?: { role?: string }) =>
      [...queryKeys.users.lists(), filters] as const,
    profile: (userId: string | undefined) =>
      [...queryKeys.users.all, "profile", userId] as const,
    role: (userId: string | undefined) =>
      [...queryKeys.users.all, "role", userId] as const,
    current: () => [...queryKeys.users.all, "current"] as const,
  },

  // ============================================================================
  // Auditoria
  // ============================================================================
  auditoria: {
    all: ["audits"] as const,
    lists: () => [...queryKeys.auditoria.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [...queryKeys.auditoria.lists(), filters] as const,
    entityTrail: (
      entidade: string | undefined,
      entidadeId: string | undefined,
    ) =>
      [
        ...queryKeys.auditoria.all,
        "entity-trail",
        entidade,
        entidadeId,
      ] as const,
    entityTypes: () => [...queryKeys.auditoria.all, "entity-types"] as const,
  },

  // ============================================================================
  // Domain Events
  // ============================================================================
  events: {
    all: ["domain-events"] as const,
    list: (projectId: string | undefined) =>
      [...queryKeys.events.all, "list", projectId] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.events.all, "entity", entityType, entityId] as const,
  },

  // ============================================================================
  // Files
  // ============================================================================
  files: {
    all: ["files"] as const,
    list: (filters?: {
      projectId?: string;
      entityType?: string;
      entityId?: string;
    }) => [...queryKeys.files.all, "list", filters] as const,
    detail: (fileId: string | undefined) =>
      [...queryKeys.files.all, "detail", fileId] as const,
    cleanup: () => [...queryKeys.files.all, "cleanup"] as const,
  },

  // ============================================================================
  // Project Templates
  // ============================================================================
  projectTemplates: {
    all: ["project-templates"] as const,
    lists: () => [...queryKeys.projectTemplates.all, "list"] as const,
    list: (filters?: { search?: string }) =>
      [...queryKeys.projectTemplates.lists(), filters] as const,
    detail: (id: string | undefined) =>
      [...queryKeys.projectTemplates.all, "detail", id] as const,
  },

  // ============================================================================
  // Orcamentos (Budget)
  // ============================================================================
  orcamentos: {
    all: ["orcamentos"] as const,
    lists: () => [...queryKeys.orcamentos.all, "list"] as const,
    list: (filters?: { status?: string }) =>
      [...queryKeys.orcamentos.lists(), filters] as const,
    detail: (id: string | undefined) =>
      [...queryKeys.orcamentos.all, "detail", id] as const,
    sections: (id: string | undefined) =>
      [...queryKeys.orcamentos.all, "sections", id] as const,
    adjustments: (id: string | undefined) =>
      [...queryKeys.orcamentos.all, "adjustments", id] as const,
    notes: (id: string | undefined) =>
      [...queryKeys.orcamentos.all, "notas", id] as const,
    events: (id: string | undefined) =>
      [...queryKeys.orcamentos.all, "eventos", id] as const,
    byProject: (projectId: string | undefined) =>
      [...queryKeys.orcamentos.all, "by-project", projectId] as const,
  },

  // ============================================================================
  // Staff Profiles (lightweight lookup cache)
  // ============================================================================
  staffProfiles: {
    all: ["staff-profiles"] as const,
    lookup: () => [...queryKeys.staffProfiles.all, "lookup"] as const,
  },

  // ============================================================================
  // BWild Agent (Assessor stateful)
  // Spec: docs/BWILD_AI_AGENTS_SPEC.yaml
  // ============================================================================
  agent: {
    all: ["bwild-agent"] as const,
    state: (projectId: string | undefined) =>
      [...queryKeys.agent.all, "state", projectId] as const,
    /** Prefix for all event lists of a project — use to invalidate every limit at once. */
    events: (projectId: string | undefined) =>
      [...queryKeys.agent.all, "events", projectId] as const,
    /** Concrete event list cached by limit. */
    eventsList: (projectId: string | undefined, limit: number) =>
      [...queryKeys.agent.events(projectId), limit] as const,
  },

  // ============================================================================
  // Minha Semana (staff personal inbox) — see src/hooks/useMinhaSemana.ts
  // ============================================================================
  minhaSemana: {
    all: ["minha-semana"] as const,
    activities: (userId: string) =>
      [...queryKeys.minhaSemana.all, "activities", userId] as const,
    ncs: (userId: string) =>
      [...queryKeys.minhaSemana.all, "ncs", userId] as const,
    tickets: (userId: string) =>
      [...queryKeys.minhaSemana.all, "tickets", userId] as const,
    formalizations: () =>
      [...queryKeys.minhaSemana.all, "formalizations"] as const,
    alerts: (userId: string) =>
      [...queryKeys.minhaSemana.all, "alerts", userId] as const,
    pendencias: (userId: string) =>
      [...queryKeys.minhaSemana.all, "pendencias", userId] as const,
    punch: (userId: string) =>
      [...queryKeys.minhaSemana.all, "punch", userId] as const,
    entregasCompras: (userId: string) =>
      [...queryKeys.minhaSemana.all, "entregas-compras", userId] as const,
  },



  // ============================================================================
  // Painel de Obras — exceções cross-domain (faixa clicável no topo)
  // ============================================================================
  painelExcecoes: {
    all: ["painel-excecoes"] as const,
    ncsCriticas: () =>
      [...queryKeys.painelExcecoes.all, "ncs-criticas"] as const,
    formalizacoesParadas: () =>
      [...queryKeys.painelExcecoes.all, "formalizacoes-paradas"] as const,
    faturasVencidas: () =>
      [...queryKeys.painelExcecoes.all, "faturas-vencidas"] as const,
    atividadesSemResponsavel: () =>
      [...queryKeys.painelExcecoes.all, "atividades-sem-responsavel"] as const,
  },

  // ============================================================================
  // Painel de Obras — snapshot gerencial batch (RPC única)
  // ============================================================================
  painelSnapshot: {
    all: ["painel-snapshot"] as const,
    list: () => [...queryKeys.painelSnapshot.all, "list"] as const,
  },

  // ============================================================================
  // Lookahead (staff 14/21 dias) — see src/hooks/useLookahead.ts
  // ============================================================================
  lookahead: {
    all: ["lookahead"] as const,
    list: (windowDays: number) =>
      [...queryKeys.lookahead.all, "list", windowDays] as const,
  },

  // ============================================================================
  // Avanço físico (medições + baselines) — Onda A1, staff-only
  // ============================================================================
  avancoFisico: {
    all: ["avanco-fisico"] as const,
    byActivity: (activityId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "measurements", "activity", activityId] as const,
    byProject: (projectId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "measurements", "project", projectId] as const,
    latest: (projectId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "measurements", "latest", projectId] as const,
    baselines: (projectId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "baselines", projectId] as const,
    baselineCurrent: (projectId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "baseline-current", projectId] as const,
    baselineActivities: (baselineId: string | undefined) =>
      [...queryKeys.avancoFisico.all, "baseline-activities", baselineId] as const,
    sCurve: (projectId: string | undefined, baselineId: string | undefined | null) =>
      [...queryKeys.avancoFisico.all, "s-curve", projectId, baselineId ?? "current"] as const,
    weightedProgress: (projectId: string | undefined, baselineId: string | undefined | null) =>
      [...queryKeys.avancoFisico.all, "weighted-progress", projectId, baselineId ?? "current"] as const,
  },

  // ============================================================================
  // Custos (orçado × comprometido × realizado) — Onda B1, staff-only
  // ============================================================================
  custos: {
    all: ["custos"] as const,
    summary: (projectId: string | undefined) =>
      [...queryKeys.custos.all, "summary", projectId] as const,
    totals: (projectId: string | undefined) =>
      [...queryKeys.custos.all, "totals", projectId] as const,
    sCurve: (projectId: string | undefined) =>
      [...queryKeys.custos.all, "s-curve", projectId] as const,
  },


  // ============================================================================
  // Qualidade (checklist templates + inspeções agregadas)
  // ============================================================================
  qualidade: {
    all: ["qualidade"] as const,
    templates: () => [...queryKeys.qualidade.all, "templates"] as const,
    template: (id: string | undefined) =>
      [...queryKeys.qualidade.all, "template", id] as const,
    templateItems: (templateId: string | undefined) =>
      [...queryKeys.qualidade.all, "template-items", templateId] as const,
    inspecoes: (filters?: { status?: string; projectId?: string }) =>
      [...queryKeys.qualidade.all, "inspecoes", filters ?? null] as const,
    punchItems: (filters?: {
      projectId?: string;
      responsibleUserId?: string;
      status?: string;
    }) => [...queryKeys.qualidade.all, "punch-items", filters ?? null] as const,
  },

  // ============================================================================
  // Suprimentos (Requisições + Cotações)
  // ============================================================================
  suprimentos: {
    all: ["suprimentos"] as const,
    requisicoes: (filters?: {
      projectId?: string;
      status?: string;
      needyDays?: number;
    }) => [...queryKeys.suprimentos.all, "requisicoes", filters ?? null] as const,
    requisicao: (id: string | undefined) =>
      [...queryKeys.suprimentos.all, "requisicao", id] as const,
    itens: (requisitionId: string | undefined) =>
      [...queryKeys.suprimentos.all, "itens", requisitionId] as const,
    cotacoes: (requisitionId: string | undefined) =>
      [...queryKeys.suprimentos.all, "cotacoes", requisitionId] as const,
  },

  // ============================================================================
  // Recebimentos de compra (Onda E2) — staff-only
  // ============================================================================
  purchaseReceipts: {
    all: ["purchase-receipts"] as const,
    byPurchase: (purchaseId: string | undefined) =>
      [...queryKeys.purchaseReceipts.all, "by-purchase", purchaseId] as const,
    byPurchaseIds: (purchaseIds: string[] | undefined) =>
      [
        ...queryKeys.purchaseReceipts.all,
        "by-purchase-ids",
        purchaseIds ? [...purchaseIds].sort().join(",") : "empty",
      ] as const,
  },

} as const;



// ============================================================================
// Helper Types
// ============================================================================

export type QueryKeys = typeof queryKeys;

// Utility to get query key type for a specific entity
export type ProjectQueryKey = ReturnType<typeof queryKeys.projects.detail>;
export type DocumentQueryKey = ReturnType<typeof queryKeys.documents.list>;
export type ActivityQueryKey = ReturnType<typeof queryKeys.activities.list>;
export type FormalizacaoQueryKey = ReturnType<
  typeof queryKeys.formalizacoes.detail
>;

// ============================================================================
// Invalidation Helpers
// ============================================================================

import { queryClient } from "./queryClient";

/**
 * Invalidate all project-related queries
 */
export function invalidateProjectQueries(projectId?: string) {
  if (projectId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.documents.list(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.activities.list(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.payments.list(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.pendingItems.list(projectId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.weeklyReports.list(projectId),
    });
  } else {
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
  }
}

/**
 * Invalidate document-related queries after approval or upload
 */
export function invalidateDocumentQueries(
  projectId: string,
  documentId?: string,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.documents.list(projectId),
  });
  if (documentId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.documents.detail(documentId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.documents.versions(documentId),
    });
  }
  // Also invalidate pending items since document approval may resolve one
  queryClient.invalidateQueries({
    queryKey: queryKeys.pendingItems.list(projectId),
  });
}

/**
 * Invalidate activity queries after Gantt updates
 */
export function invalidateActivityQueries(
  projectId: string,
  activityId?: string,
) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.activities.list(projectId),
  });
  if (activityId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.activities.detail(activityId),
    });
  }
}

/**
 * Invalidate formalization queries after changes
 */
export function invalidateFormalizacaoQueries(
  projectId?: string,
  formalizacaoId?: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.formalizacoes.all });
  if (formalizacaoId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.formalizacoes.detail(formalizacaoId),
    });
  }
  if (projectId) {
    // Formalization changes may affect pending items
    queryClient.invalidateQueries({
      queryKey: queryKeys.pendingItems.list(projectId),
    });
  }
}
