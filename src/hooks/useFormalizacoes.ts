import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Formalization = Database['public']['Tables']['formalizations']['Row'];
type FormalizationInsert = Database['public']['Tables']['formalizations']['Insert'];
type FormalizationUpdate = Database['public']['Tables']['formalizations']['Update'];
type FormalizationWithDetails = Database['public']['Views']['formalizations_public_customer']['Row'];

export function useFormalizacoes(filters?: {
  status?: string;
  type?: string;
  projectId?: string;
}) {
  return useQuery({
    queryKey: ['formalizacoes', filters],
    queryFn: async () => {
      let query = supabase
        .from('formalizations_public_customer')
        .select('*')
        .order('last_activity_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status as any);
      }
      if (filters?.type) {
        query = query.eq('type', filters.type as any);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FormalizationWithDetails[];
    },
  });
}

export function useFormalizacao(id: string | undefined) {
  return useQuery({
    queryKey: ['formalizacao', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('formalizations_public_customer')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as FormalizationWithDetails | null;
    },
    enabled: !!id,
  });
}

export function useCreateFormalizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: FormalizationInsert) => {
      const { data: result, error } = await supabase
        .from('formalizations')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formalizacoes'] });
    },
  });
}

export function useUpdateFormalizacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormalizationUpdate }) => {
      const { data: result, error } = await supabase
        .from('formalizations')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['formalizacoes'] });
      queryClient.invalidateQueries({ queryKey: ['formalizacao', id] });
    },
  });
}

export function useSendForSignature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First compute hash to lock the content
      const { data: hash, error: hashError } = await supabase
        .rpc('compute_formalization_hash', { p_formalization_id: id });

      if (hashError) throw hashError;

      // Update status and set locked_hash
      const { data: result, error } = await supabase
        .from('formalizations')
        .update({
          status: 'pending_signatures',
          locked_hash: hash,
          locked_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Add event
      await supabase.from('formalization_events').insert({
        formalization_id: id,
        event_type: 'sent_for_signature',
        actor_user_id: (await supabase.auth.getUser()).data.user?.id,
        meta: { locked_hash: hash },
      });

      return result;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['formalizacoes'] });
      queryClient.invalidateQueries({ queryKey: ['formalizacao', id] });
    },
  });
}

export function useAddParty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Database['public']['Tables']['formalization_parties']['Insert']) => {
      const { data: result, error } = await supabase
        .from('formalization_parties')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formalizacao', result.formalization_id] });
    },
  });
}

export function useAcknowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      formalizationId, 
      partyId,
      signatureText 
    }: { 
      formalizationId: string; 
      partyId: string;
      signatureText?: string;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      
      // Create hash from signature
      const timestamp = new Date().toISOString();
      const signatureData = `${formalizationId}-${partyId}-${timestamp}-${user?.id}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data: result, error } = await supabase
        .from('formalization_acknowledgements')
        .insert({
          formalization_id: formalizationId,
          party_id: partyId,
          acknowledged: true,
          acknowledged_at: timestamp,
          acknowledged_by_user_id: user?.id,
          acknowledged_by_email: user?.email,
          signature_text: signatureText,
          signature_hash: signatureHash,
          user_agent: navigator.userAgent,
        })
        .select()
        .single();

      if (error) throw error;

      // Add event
      await supabase.from('formalization_events').insert({
        formalization_id: formalizationId,
        event_type: 'signed_by_party',
        actor_user_id: user?.id,
        meta: { party_id: partyId, signature_hash: signatureHash },
      });

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['formalizacao', result.formalization_id] });
      queryClient.invalidateQueries({ queryKey: ['formalizacoes'] });
    },
  });
}
