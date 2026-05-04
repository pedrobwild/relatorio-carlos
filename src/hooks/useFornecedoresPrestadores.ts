/**
 * useFornecedoresPrestadores — lista fornecedores do tipo "prestador"
 * (mão de obra terceirizada que executa atividades em obra) para uso em
 * seletores ao quebrar atividades em micro-etapas no Calendário/Cronograma.
 *
 * Inclui status `ativo` e `rascunho` para que prestadores recém-criados via
 * QuickCreate apareçam imediatamente. Cache compartilhado com o seletor de
 * Compras (`fornecedores-prestadores`) para evitar refetch redundante.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PrestadorOption {
  id: string;
  nome: string;
  categoria: string | null;
  status: string;
}

export function useFornecedoresPrestadores() {
  return useQuery<PrestadorOption[]>({
    queryKey: ["fornecedores-prestadores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, categoria, status")
        .eq("supplier_type", "prestador")
        .in("status", ["ativo", "rascunho"])
        .order("nome");
      if (error) throw error;
      return (data ?? []) as PrestadorOption[];
    },
    staleTime: 5 * 60_000,
  });
}
