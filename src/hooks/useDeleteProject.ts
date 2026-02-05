 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 import { projectKeys } from './useProjectsQuery';
 
 export function useDeleteProject() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (projectId: string) => {
       // Delete related records first (cascade may not cover all)
       // Delete project members
       await supabase.from('project_members').delete().eq('project_id', projectId);
       
       // Delete project engineers
       await supabase.from('project_engineers').delete().eq('project_id', projectId);
       
       // Delete project customers
       await supabase.from('project_customers').delete().eq('project_id', projectId);
       
       // Delete project activities
       await supabase.from('project_activities').delete().eq('project_id', projectId);
       
       // Delete project payments
       await supabase.from('project_payments').delete().eq('project_id', projectId);
       
       // Delete project documents
       await supabase.from('project_documents').delete().eq('project_id', projectId);
       
       // Delete project purchases
       await supabase.from('project_purchases').delete().eq('project_id', projectId);
       
       // Delete pending items
       await supabase.from('pending_items').delete().eq('project_id', projectId);
       
       // Delete formalizations
       await supabase.from('formalizations').delete().eq('project_id', projectId);
       
       // Delete domain events
       await supabase.from('domain_events').delete().eq('project_id', projectId);
       
       // Delete files
       await supabase.from('files').delete().eq('project_id', projectId);
       
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