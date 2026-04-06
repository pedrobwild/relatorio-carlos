import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { Loader2, FileText } from 'lucide-react';
import OrcamentoDetalhe from '@/pages/gestao/OrcamentoDetalhe';

/**
 * Project-scoped budget page.
 * Finds the orcamento linked to this project and renders the detail inline
 * within the project shell (no redirect away from project context).
 */
export default function OrcamentoProjeto() {
  const { projectId } = useParams<{ projectId: string }>();

  const { data: orcamento, isLoading } = useQuery({
    queryKey: queryKeys.orcamentos.byProject(projectId),
    queryFn: async () => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orcamento) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nenhum orçamento vinculado</h2>
          <p className="text-sm text-muted-foreground mt-1">
            O orçamento será exibido aqui quando sincronizado pelo sistema comercial.
          </p>
        </div>
      </div>
    );
  }

  return <OrcamentoDetalhe embeddedOrcamentoId={orcamento.id} />;
}
