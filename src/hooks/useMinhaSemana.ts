/**
 * useMinhaSemana — inbox pessoal do staff logado.
 *
 * Agrega em paralelo, do banco, tudo que precisa da atenção do usuário atual:
 *   1. Atividades de cronograma sob responsabilidade dele (não concluídas).
 *   2. Não conformidades atribuídas a ele (não fechadas).
 *   3. Tickets CS atribuídos a ele (não concluídos).
 *   4. Formalizações aguardando assinatura interna (staff pode assinar em nome
 *      da empresa — mostradas a todos os usuários staff).
 *   5. Alertas de cronograma (início/fim não sinalizados) nas obras onde ele é
 *      responsável no painel.
 *   6. Pendências (`pending_items`) nas obras onde ele é `painel_responsavel_id`
 *      — como não há responsável individual por item, listamos as pendências
 *      das obras que ele gerencia.
 *
 * Retorna 4 buckets temporais (Atrasado / Hoje / Esta semana / Próximas) com
 * ordenação: mais atrasado primeiro, depois prazo mais próximo.
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { queryKeys } from "@/lib/queryKeys";
import { countBusinessDaysInclusive } from "@/lib/businessDays";

export type InboxKind =
  | "atividade"
  | "nc"
  | "ticket"
  | "formalizacao"
  | "alerta"
  | "pendencia"
  | "entrega";


export type InboxBucket = "atrasado" | "hoje" | "semana" | "proximas";

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  /** ISO YYYY-MM-DD; null quando o item não tem prazo definido. */
  dueDate: string | null;
  daysOverdue: number;
  /** Dias úteis restantes (>=0). null quando não há prazo. */
  businessDaysUntil: number | null;
  projectId: string;
  projectName: string;
  href: string;
  /** Contexto adicional em uma linha (ex.: severidade, tipo). */
  hint?: string;
}

interface Buckets {
  atrasado: InboxItem[];
  hoje: InboxItem[];
  semana: InboxItem[];
  proximas: InboxItem[];
}

const TODAY = () => new Date().toISOString().slice(0, 10);

function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function calcOverdue(iso: string | null): number {
  if (!iso) return 0;
  const today = TODAY();
  if (iso >= today) return 0;
  return countBusinessDaysInclusive(parseISODate(iso), new Date()) - 1;
}

function calcBusinessDaysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = TODAY();
  if (iso < today) return 0;
  if (iso === today) return 0;
  return countBusinessDaysInclusive(new Date(), parseISODate(iso)) - 1;
}

function bucketOf(item: InboxItem): InboxBucket {
  if (item.dueDate && item.dueDate < TODAY()) return "atrasado";
  if (item.dueDate === TODAY()) return "hoje";
  if (item.businessDaysUntil != null && item.businessDaysUntil <= 5) {
    return "semana";
  }
  return "proximas";
}

function sortItems(items: InboxItem[]): InboxItem[] {
  return [...items].sort((a, b) => {
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    const av = a.dueDate ?? "9999-12-31";
    const bv = b.dueDate ?? "9999-12-31";
    if (av !== bv) return av.localeCompare(bv);
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

// ---------- Queries individuais ----------

async function fetchMyActivities(userId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("project_activities")
    .select(
      "id, description, planned_start, planned_end, actual_start, actual_end, project_id, projects:project_id(id, name)",
    )
    .eq("responsible_user_id", userId)
    .is("actual_end", null)
    .order("planned_end", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const due = row.planned_end ?? row.planned_start ?? null;
    return {
      id: `atv-${row.id}`,
      kind: "atividade" as InboxKind,
      title: row.description ?? "Atividade sem título",
      dueDate: due,
      daysOverdue: calcOverdue(due),
      businessDaysUntil: calcBusinessDaysUntil(due),
      projectId: row.project_id,
      projectName:
        (row.projects as { name?: string } | null)?.name ?? "Sem obra",
      href: `/obra/${row.project_id}/cronograma`,
      hint: row.actual_start ? "Em andamento" : "Não iniciada",
    };
  });
}

async function fetchMyNcs(userId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("non_conformities")
    .select(
      "id, title, deadline, severity, status, project_id, projects:project_id(id, name)",
    )
    .eq("responsible_user_id", userId)
    .in("status", [
      "open",
      "in_treatment",
      "reopened",
      "pending_verification",
      "pending_approval",
    ])
    .order("deadline", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: `nc-${row.id}`,
    kind: "nc" as InboxKind,
    title: row.title,
    dueDate: row.deadline ?? null,
    daysOverdue: calcOverdue(row.deadline ?? null),
    businessDaysUntil: calcBusinessDaysUntil(row.deadline ?? null),
    projectId: row.project_id,
    projectName:
      (row.projects as { name?: string } | null)?.name ?? "Sem obra",
    href: `/obra/${row.project_id}/nao-conformidades`,
    hint: `Severidade: ${row.severity}`,
  }));
}

async function fetchMyTickets(userId: string): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("cs_tickets")
    .select(
      "id, situation, severity, status, updated_at, project_id, projects:project_id(id, name)",
    )
    .eq("responsible_user_id", userId)
    .neq("status", "concluido")
    .order("updated_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: `cs-${row.id}`,
    kind: "ticket" as InboxKind,
    title: row.situation,
    dueDate: null,
    daysOverdue: 0,
    businessDaysUntil: null,
    projectId: row.project_id,
    projectName:
      (row.projects as { name?: string } | null)?.name ?? "Sem obra",
    href: `/gestao/cs/${row.id}`,
    hint: `Severidade: ${row.severity}`,
  }));
}

async function fetchPendingSignatures(): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from("formalizations_public_customer")
    .select(
      "id, title, project_id, status, last_activity_at, parties_signed, parties_total",
    )
    .eq("status", "pending_signatures")
    .order("last_activity_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  // Nomes das obras em uma segunda query enxuta.
  const projectIds = Array.from(
    new Set(
      (data ?? [])
        .map((r) => r.project_id)
        .filter((id): id is string => !!id),
    ),
  );
  const nameMap = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projs } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    (projs ?? []).forEach((p) => nameMap.set(p.id, p.name));
  }
  return (data ?? []).map((row) => ({
    id: `form-${row.id}`,
    kind: "formalizacao" as InboxKind,
    title: row.title ?? "Formalização sem título",
    dueDate: row.last_activity_at
      ? String(row.last_activity_at).slice(0, 10)
      : null,
    daysOverdue: 0,
    businessDaysUntil: null,
    projectId: row.project_id ?? "",
    projectName: row.project_id
      ? (nameMap.get(row.project_id) ?? "Sem obra")
      : "Sem obra",
    href: `/obra/${row.project_id}/formalizacoes/${row.id}`,
    hint: `${row.parties_signed ?? 0}/${row.parties_total ?? 0} assinaturas`,
  }));
}

async function fetchMyScheduleAlerts(userId: string): Promise<InboxItem[]> {
  // Obras onde sou responsável no painel.
  const { data: myProjects, error: projErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("painel_responsavel_id", userId)
    .is("deleted_at", null);
  if (projErr) throw projErr;
  if (!myProjects || myProjects.length === 0) return [];
  const ids = myProjects.map((p) => p.id);
  const nameMap = new Map(myProjects.map((p) => [p.id, p.name]));
  const today = TODAY();
  const lookback = new Date();
  lookback.setUTCDate(lookback.getUTCDate() - 60);
  const lookbackIso = lookback.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("project_activities")
    .select(
      "id, description, planned_start, planned_end, actual_start, actual_end, project_id",
    )
    .in("project_id", ids)
    .gte("planned_start", lookbackIso)
    .or(
      `and(actual_start.is.null,planned_start.lte.${today}),and(actual_end.is.null,planned_end.lte.${today})`,
    )
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const missingStart = !row.actual_start;
    const due = (missingStart ? row.planned_start : row.planned_end) ?? null;
    return {
      id: `alerta-${row.id}`,
      kind: "alerta" as InboxKind,
      title: row.description ?? "Atividade",
      dueDate: due,
      daysOverdue: calcOverdue(due),
      businessDaysUntil: calcBusinessDaysUntil(due),
      projectId: row.project_id,
      projectName: nameMap.get(row.project_id) ?? "Sem obra",
      href: `/gestao/alertas-cronograma`,
      hint: missingStart ? "Início não sinalizado" : "Término não sinalizado",
    };
  });
}

async function fetchMyPendencias(userId: string): Promise<InboxItem[]> {
  const { data: myProjects, error: projErr } = await supabase
    .from("projects")
    .select("id, name")
    .eq("painel_responsavel_id", userId)
    .is("deleted_at", null);
  if (projErr) throw projErr;
  if (!myProjects || myProjects.length === 0) return [];
  const ids = myProjects.map((p) => p.id);
  const nameMap = new Map(myProjects.map((p) => [p.id, p.name]));
  const { data, error } = await supabase
    .from("pending_items")
    .select("id, title, type, due_date, project_id, status")
    .in("project_id", ids)
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: `pend-${row.id}`,
    kind: "pendencia" as InboxKind,
    title: row.title,
    dueDate: row.due_date ?? null,
    daysOverdue: calcOverdue(row.due_date ?? null),
    businessDaysUntil: calcBusinessDaysUntil(row.due_date ?? null),
    projectId: row.project_id,
    projectName: nameMap.get(row.project_id) ?? "Sem obra",
    href: `/obra/${row.project_id}/pendencias`,
    hint: `Tipo: ${row.type}`,
  }));
}

// ---------- Hook principal ----------

export function useMinhaSemana() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  const results = useQueries({
    queries: [
      {
        queryKey: queryKeys.minhaSemana.activities(uid),
        queryFn: () => fetchMyActivities(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.minhaSemana.ncs(uid),
        queryFn: () => fetchMyNcs(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.minhaSemana.tickets(uid),
        queryFn: () => fetchMyTickets(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.minhaSemana.formalizations(),
        queryFn: () => fetchPendingSignatures(),
        enabled: !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.minhaSemana.alerts(uid),
        queryFn: () => fetchMyScheduleAlerts(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
      {
        queryKey: queryKeys.minhaSemana.pendencias(uid),
        queryFn: () => fetchMyPendencias(uid),
        enabled: !!uid,
        staleTime: 60_000,
      },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const error = results.find((r) => r.error)?.error as Error | undefined;

  const buckets = useMemo<Buckets>(() => {
    const all: InboxItem[] = [];
    for (const r of results) {
      if (r.data) all.push(...r.data);
    }
    const groups: Buckets = {
      atrasado: [],
      hoje: [],
      semana: [],
      proximas: [],
    };
    for (const item of all) {
      groups[bucketOf(item)].push(item);
    }
    return {
      atrasado: sortItems(groups.atrasado),
      hoje: sortItems(groups.hoje),
      semana: sortItems(groups.semana),
      proximas: sortItems(groups.proximas),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.map((r) => r.dataUpdatedAt).join("|")]);

  const total =
    buckets.atrasado.length +
    buckets.hoje.length +
    buckets.semana.length +
    buckets.proximas.length;

  return {
    buckets,
    total,
    isLoading,
    isError,
    error,
    refetchAll: () => results.forEach((r) => r.refetch()),
  };
}
