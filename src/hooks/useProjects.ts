import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserRole } from './useUserRole';

export interface Project {
  id: string;
  name: string;
  unit_name: string | null;
  address: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_email?: string;
}

export function useProjects() {
  const { user } = useAuth();
  const { isStaff, isCustomer, loading: roleLoading } = useUserRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    if (!user || roleLoading) return;
    
    setLoading(true);
    setError(null);

    try {
      if (isStaff) {
        // Staff sees projects from projects table
        const { data, error: fetchError } = await supabase
          .from('projects')
          .select(`
            *,
            project_customers (
              customer_name,
              customer_email
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        
        setProjects((data || []).map(p => ({
          ...p,
          status: p.status as Project['status'],
          customer_name: p.project_customers?.[0]?.customer_name,
          customer_email: p.project_customers?.[0]?.customer_email,
        })));
      } else if (isCustomer) {
        // Customer sees projects via project_members (unified membership table)
        const { data: memberData, error: memberError } = await supabase
          .from('project_members')
          .select(`
            project:projects (*)
          `)
          .eq('user_id', user.id);

        if (memberError) throw memberError;
        
        // Also check legacy project_customers table for backwards compatibility
        const { data: customerData } = await supabase
          .from('project_customers')
          .select(`
            project:projects (*)
          `)
          .eq('customer_user_id', user.id);

        // Combine and deduplicate projects from both sources
        const memberProjects = (memberData || [])
          .map(pm => pm.project)
          .filter((p): p is NonNullable<typeof p> => p !== null);
        
        const customerProjects = (customerData || [])
          .map(pc => pc.project)
          .filter((p): p is NonNullable<typeof p> => p !== null);

        const allProjects = [...memberProjects, ...customerProjects];
        const uniqueProjects = allProjects.filter((p, index, self) => 
          index === self.findIndex(t => t.id === p.id)
        );
        
        setProjects(uniqueProjects.map(p => ({ ...p, status: p.status as Project['status'] })));
      }
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && user) {
      fetchProjects();
    }
  }, [user, roleLoading, isStaff, isCustomer]);

  return {
    projects,
    loading: loading || roleLoading,
    error,
    refetch: fetchProjects,
  };
}
