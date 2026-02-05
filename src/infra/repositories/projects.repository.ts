/**
 * Projects Repository
 * 
 * Centralized data access for projects.
 * Handles all Supabase interactions for the projects feature.
 */

import { 
  supabase, 
  executeQuery, 
  executeListQuery,
  type RepositoryResult,
  type RepositoryListResult,
} from './base.repository';

// ============================================================================
// Types
// ============================================================================

export type ProjectStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface Project {
  id: string;
  name: string;
  unit_name: string | null;
  address: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  org_id: string | null;
  is_project_phase?: boolean;
}

export interface ProjectWithCustomer extends Project {
  customer_name?: string;
  customer_email?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  org_id: string | null;
  org_name: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  user_role: string;
  pending_count: number;
  overdue_count: number;
  unsigned_formalizations: number;
  pending_documents: number;
  progress_percentage: number;
  last_activity_at: string | null;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Fetch all projects for staff users
 */
export async function getStaffProjects(): Promise<RepositoryListResult<ProjectWithCustomer>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_customers (
          customer_name,
          customer_email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error };

    return {
      data: (data ?? []).map(p => ({
        ...p,
        status: p.status as ProjectStatus,
        customer_name: p.project_customers?.[0]?.customer_name,
        customer_email: p.project_customers?.[0]?.customer_email,
      })),
      error: null,
    };
  });
}

/**
 * Fetch projects for a specific customer
 * Checks both project_members (unified) and project_customers (legacy) tables
 */
export async function getCustomerProjects(userId: string): Promise<RepositoryListResult<Project>> {
  return executeListQuery(async () => {
    // Fetch from unified membership table
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select(`
        project:projects (*)
      `)
      .eq('user_id', userId);

    if (memberError) return { data: null, error: memberError };

    // Fetch from legacy project_customers table for backwards compatibility
    const { data: customerData, error: customerError } = await supabase
      .from('project_customers')
      .select(`
        project:projects (*)
      `)
      .eq('customer_user_id', userId);

    if (customerError) return { data: null, error: customerError };

    // Combine and deduplicate projects from both sources
    const memberProjects = (memberData ?? [])
      .map(pm => pm.project)
      .filter((p): p is NonNullable<typeof p> => p !== null);
    
    const customerProjects = (customerData ?? [])
      .map(pc => pc.project)
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const allProjects = [...memberProjects, ...customerProjects];
    const uniqueProjects = allProjects.filter((p, index, self) => 
      index === self.findIndex(t => t.id === p.id)
    );

    return {
      data: uniqueProjects.map(p => ({ ...p, status: p.status as ProjectStatus })),
      error: null,
    };
  });
}

/**
 * Fetch a single project by ID
 */
export async function getProjectById(projectId: string): Promise<RepositoryResult<Project>> {
  return executeQuery(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) return { data: null, error };

    return {
      data: data ? { ...data, status: data.status as ProjectStatus } : null,
      error: null,
    };
  });
}

/**
 * Fetch project summary using optimized RPC
 */
export async function getUserProjectsSummary(): Promise<RepositoryListResult<ProjectSummary>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase.rpc('get_user_projects_summary');
    return { data: data ?? null, error };
  });
}

/**
 * Check if user has access to a project
 */
export async function checkProjectAccess(
  userId: string, 
  projectId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_project_access', {
    _user_id: userId,
    _project_id: projectId,
  });

  if (error) {
    console.error('Error checking project access:', error);
    return false;
  }

  return !!data;
}
