/**
 * usePurchasesByCreationRange — busca solicitações de compra (project_purchases)
 * cuja DATA DE CRIAÇÃO (created_at) caia em um intervalo [start, end].
 *
 * Usado pelo Calendário de Obras para exibir, junto às atividades, em qual
 * dia cada solicitação de compra foi cadastrada — dando visibilidade do
 * volume e da distribuição de pedidos ao longo do tempo.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PurchaseCalendarEvent {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string | null;
  item_name: string;
  category: string | null;
  purchase_type: string | null;
  status: string;
  estimated_cost: number | null;
  supplier_name: string | null;
  /** Data de criação (apenas YYYY-MM-DD em horário local SP). */
  created_date: string;
  created_at: string;
}

async function fetchPurchasesByCreation(
  startStr: string,
  endStr: string,
): Promise<PurchaseCalendarEvent[]> {
  // Buscamos created_at >= start (00:00) e < end+1d (00:00) para cobrir o dia todo.
  const startISO = `${startStr}T00:00:00.000Z`;
  // end+1 dia para inclusivo
  const endDate = new Date(`${endStr}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endISO = endDate.toISOString();

  const { data, error } = await supabase
    .from("project_purchases")
    .select(
      `
      id,
      project_id,
      item_name,
      category,
      purchase_type,
      status,
      estimated_cost,
      supplier_name,
      created_at,
      projects:project_id (
        name,
        client_name,
        project_customers!project_customers_project_id_fkey (
          customer_name
        )
      )
    `,
    )
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const created = new Date(row.created_at);
    // Converte para YYYY-MM-DD em local time (não UTC) — alinhado com o que o
    // usuário enxerga em horário de Brasília.
    const y = created.getFullYear();
    const m = String(created.getMonth() + 1).padStart(2, "0");
    const d = String(created.getDate()).padStart(2, "0");
    return {
      id: row.id,
      project_id: row.project_id,
      project_name: row.projects?.name ?? "Obra sem nome",
      client_name:
        row.projects?.project_customers?.[0]?.customer_name ??
        row.projects?.client_name ??
        null,
      item_name: row.item_name,
      category: row.category,
      purchase_type: row.purchase_type,
      status: row.status,
      estimated_cost: row.estimated_cost,
      supplier_name: row.supplier_name,
      created_date: `${y}-${m}-${d}`,
      created_at: row.created_at,
    };
  });
}

export function usePurchasesByCreationRange(startStr: string, endStr: string) {
  const { user } = useAuth();
  const {
    data = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["purchases-by-creation", startStr, endStr],
    queryFn: () => fetchPurchasesByCreation(startStr, endStr),
    enabled: !!user && !!startStr && !!endStr,
    staleTime: 60_000,
  });

  // Agrupa por dia (YYYY-MM-DD) para lookup O(1) durante a renderização do calendário.
  const byDay = useMemo(() => {
    const map = new Map<string, PurchaseCalendarEvent[]>();
    for (const p of data) {
      const arr = map.get(p.created_date) ?? [];
      arr.push(p);
      map.set(p.created_date, arr);
    }
    return map;
  }, [data]);

  return {
    purchases: data,
    purchasesByDay: byDay,
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
