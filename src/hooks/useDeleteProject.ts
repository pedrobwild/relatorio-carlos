 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { projectKeys } from './useProjectsQuery';
 
 export function useDeleteProject() {
   const queryClient = useQueryClient();
 
   return useMutation({
      mutationFn: async (projectId: string) => {
        // All child tables now use ON DELETE CASCADE at the DB level,
        // so we only need to delete the project itself.
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