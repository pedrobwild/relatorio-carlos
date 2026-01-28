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
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  contract_value: number | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  org_id: string | null;
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
 */
export async function getCustomerProjects(userId: string): Promise<RepositoryListResult<Project>> {
  return executeListQuery(async () => {
    const { data, error } = await supabase
      .from('project_customers')
      .select(`
        project:projects (*)
      `)
      .eq('customer_user_id', userId);

    if (error) return { data: null, error };

    return {
      data: (data ?? [])
        .map(pc => pc.project)
        .filter((p): p is NonNullable<typeof p> => p !== null)
        .map(p => ({ ...p, status: p.status as ProjectStatus })),
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
