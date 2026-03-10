 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { projectKeys } from './useProjectsQuery';
 
 export function useDeleteProject() {
   const queryClient = useQueryClient();
 
   return useMutation({
      mutationFn: async (projectId: string) => {
        // Helper that throws on error
        const del = async (table: string) => {
          const { error } = await supabase.from(table as any).delete().eq('project_id', projectId);
          if (error) throw new Error(`Erro ao limpar ${table}: ${error.message}`);
        };

        // Delete child records that use RESTRICT or SET NULL FK rules
        // (tables with CASCADE are handled automatically by the DB)
        // Order matters: delete children before parents

        // RESTRICT FK tables — must be deleted manually
        await del('formalizations');
        await del('project_documents');
        await del('project_payments');
        await del('pending_items');
        await del('project_members');

        // SET NULL FK tables
        await del('files');
        await del('invitations');

        // Domain events (SET DEFAULT / no action)
        await del('domain_events');

        // Tables with CASCADE (deleted automatically, but explicit for safety)
        await del('project_engineers');
        await del('project_customers');

        // Finally delete the project
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;

        return projectId;
      },
     onSuccess: () => {
       toast.success('Obra excluída com sucesso');
       queryClient.invalidateQueries({ queryKey: projectKeys.all });
     },
     onError: (error: Error) => {
       console.error('Error deleting project:', error);
       toast.error('Erro ao excluir obra: ' + error.message);
     },
   });
 }