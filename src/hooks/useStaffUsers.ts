import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StaffUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

const STAFF_ROLES = ['admin', 'engineer', 'gestor', 'manager'];

export function useStaffUsers() {
  return useQuery({
    queryKey: ['staff-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users_profile')
        .select('id, nome, email, perfil')
        .in('perfil', STAFF_ROLES)
        .eq('status', 'ativo')
        .order('nome');
      if (error) throw error;
      return (data || []) as StaffUser[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
