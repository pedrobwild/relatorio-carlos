import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'engineer' | 'admin' | 'customer';

interface UserRoleState {
  role: AppRole | null;
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isCustomer: boolean;
}

export function useUserRole(): UserRoleState {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole('customer'); // Default to customer
        } else {
          setRole(data.role as AppRole);
        }
      } catch (err) {
        console.error('Error:', err);
        setRole('customer');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user, authLoading]);

  return {
    role,
    loading: loading || authLoading,
    isStaff: role === 'engineer' || role === 'admin',
    isAdmin: role === 'admin',
    isCustomer: role === 'customer',
  };
}
