/**
 * Compras da obra (`project_purchases`) — gravação de uma nova solicitação.
 *
 * É o MESMO caminho da tela Compras (`useProjectPurchases().addPurchase`, que
 * chama esta função) e do "Pedir compra" da gaveta da atividade na Semana.
 * Os padrões de uma solicitação nova vêm do banco (situação `pending`,
 * unidade `un`, prazo de 7 dias) e do formulário de Compras
 * (`emptyPurchase` em `src/pages/compras/types.ts`).
 *
 * RLS: só equipe com acesso à obra (20260628073734 / 20261011120000).
 */
import { supabase, executeQuery } from "./base.repository";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ProjectPurchaseRow = Tables<"project_purchases">;
export type CreatePurchaseInput = Omit<TablesInsert<"project_purchases">, "created_by">;

export const purchasesRepo = {
  /** Cria a solicitação de compra; `created_by` é quem está logado. */
  async create(input: CreatePurchaseInput, createdBy: string) {
    return executeQuery<ProjectPurchaseRow>(async () => {
      return await supabase
        .from("project_purchases")
        .insert({ ...input, created_by: createdBy })
        .select()
        .single();
    });
  },
};
