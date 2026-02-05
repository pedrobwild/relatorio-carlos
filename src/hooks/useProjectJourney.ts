 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
import type { JourneyCSM } from '@/components/journey/JourneyCSMSection';
 
 export type JourneyStageStatus = 'pending' | 'waiting_action' | 'in_progress' | 'completed';
 
 export interface JourneyHero {
   id: string;
   project_id: string;
   title: string;
   subtitle: string;
   badge_text: string | null;
 }
 
 export interface JourneyFooter {
   id: string;
   project_id: string;
   text: string;
 }
 
 export interface JourneyTodo {
   id: string;
   stage_id: string;
   owner: 'client' | 'bwild';
   text: string;
   completed: boolean;
   completed_at: string | null;
   sort_order: number;
 }
 
 export interface JourneyStage {
   id: string;
   project_id: string;
   sort_order: number;
   name: string;
   icon: string;
   status: JourneyStageStatus;
   description: string | null;
   warning_text: string | null;
   cta_text: string | null;
   cta_url: string | null;
   cta_visible: boolean;
   microcopy: string | null;
   responsible: string | null;
   dependencies_text: string | null;
   revision_text: string | null;
   todos: JourneyTodo[];
 }
 
 export interface ProjectJourneyData {
   hero: JourneyHero | null;
   footer: JourneyFooter | null;
  csm: JourneyCSM | null;
   stages: JourneyStage[];
 }
 
 async function fetchProjectJourney(projectId: string): Promise<ProjectJourneyData> {
  // Fetch hero, footer, and csm in parallel
  const [heroResult, footerResult, csmResult, stagesResult] = await Promise.all([
    supabase
     .from('journey_hero')
     .select('*')
     .eq('project_id', projectId)
      .single(),
    supabase
     .from('journey_footer')
     .select('*')
     .eq('project_id', projectId)
      .single(),
    supabase
      .from('journey_csm')
      .select('*')
      .eq('project_id', projectId)
      .single(),
    supabase
     .from('journey_stages')
     .select('*')
     .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);
 
   const stages: JourneyStage[] = [];
 
  if (stagesResult.data) {
    for (const stage of stagesResult.data) {
       const { data: todos } = await supabase
         .from('journey_todos')
         .select('*')
         .eq('stage_id', stage.id)
         .order('sort_order', { ascending: true });
 
       stages.push({
         ...stage,
         status: stage.status as JourneyStageStatus,
         todos: (todos || []) as JourneyTodo[],
       });
     }
   }
 
   return {
    hero: heroResult.data as JourneyHero | null,
    footer: footerResult.data as JourneyFooter | null,
    csm: csmResult.data as JourneyCSM | null,
     stages,
   };
 }
 
 export function useProjectJourney(projectId: string | undefined) {
   return useQuery({
     queryKey: ['project-journey', projectId],
     queryFn: () => fetchProjectJourney(projectId!),
     enabled: !!projectId,
   });
 }
 
 export function useInitializeJourney() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (projectId: string) => {
       const { error } = await supabase.rpc('initialize_project_journey', {
         p_project_id: projectId,
       });
       if (error) throw error;
     },
     onSuccess: (_, projectId) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useToggleTodo() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ todoId, completed, projectId }: { todoId: string; completed: boolean; projectId: string }) => {
       const { error } = await supabase
         .from('journey_todos')
         .update({
           completed,
           completed_at: completed ? new Date().toISOString() : null,
         })
         .eq('id', todoId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useUpdateHero() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ heroId, updates, projectId }: { heroId: string; updates: Partial<JourneyHero>; projectId: string }) => {
       const { error } = await supabase
         .from('journey_hero')
         .update(updates)
         .eq('id', heroId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useUpdateFooter() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ footerId, text, projectId }: { footerId: string; text: string; projectId: string }) => {
       const { error } = await supabase
         .from('journey_footer')
         .update({ text })
         .eq('id', footerId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useUpdateStage() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ stageId, updates, projectId }: { stageId: string; updates: Partial<JourneyStage>; projectId: string }) => {
       const { todos, ...stageUpdates } = updates;
       const { error } = await supabase
         .from('journey_stages')
         .update(stageUpdates)
         .eq('id', stageId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useUpdateTodo() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ todoId, text, projectId }: { todoId: string; text: string; projectId: string }) => {
       const { error } = await supabase
         .from('journey_todos')
         .update({ text })
         .eq('id', todoId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useAddTodo() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ stageId, owner, text, projectId }: { stageId: string; owner: 'client' | 'bwild'; text: string; projectId: string }) => {
       // Get max sort_order for this stage
       const { data: existing } = await supabase
         .from('journey_todos')
         .select('sort_order')
         .eq('stage_id', stageId)
         .order('sort_order', { ascending: false })
         .limit(1);
 
       const sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;
 
       const { error } = await supabase
         .from('journey_todos')
         .insert({ stage_id: stageId, owner, text, sort_order: sortOrder });
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }
 
 export function useDeleteTodo() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ todoId, projectId }: { todoId: string; projectId: string }) => {
       const { error } = await supabase
         .from('journey_todos')
         .delete()
         .eq('id', todoId);
       if (error) throw error;
       return { projectId };
     },
     onSuccess: ({ projectId }) => {
       queryClient.invalidateQueries({ queryKey: ['project-journey', projectId] });
     },
   });
 }