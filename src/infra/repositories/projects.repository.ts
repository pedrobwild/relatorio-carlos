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
  engineer_name?: string;
  engineer_user_id?: string;
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
    // Fetch projects with customers
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select(`
        *,
        project_customers (
          customer_name,
          customer_email
        )
      `)
      .order('created_at', { ascending: false });

    if (projectsError) return { data: null, error: projectsError };

    // Fetch all project engineers with their profile names
    const { data: engineersData, error: engineersError } = await supabase
      .from('project_engineers')
      .select('project_id, engineer_user_id, is_primary');

    if (engineersError) return { data: null, error: engineersError };

    // Get unique engineer user IDs and fetch their profiles
    const engineerUserIds = [...new Set(engineersData?.map(e => e.engineer_user_id) ?? [])];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', engineerUserIds);

    // Create a map of user_id -> display_name
    const profileMap = new Map(profilesData?.map(p => [p.user_id, p.display_name]) ?? []);

    // Create a map of project_id -> primary engineer info
    const projectEngineerMap = new Map<string, { engineer_user_id: string; engineer_name: string | null }>();
    
    for (const engineer of (engineersData ?? [])) {
      const existing = projectEngineerMap.get(engineer.project_id);
      // Only set if we don't have one yet or this one is primary
      if (!existing || engineer.is_primary) {
        projectEngineerMap.set(engineer.project_id, {
          engineer_user_id: engineer.engineer_user_id,
          engineer_name: profileMap.get(engineer.engineer_user_id) ?? null,
        });
      }
    }

    return {
      data: (projectsData ?? []).map(p => {
        const engineerInfo = projectEngineerMap.get(p.id);
        return {
          ...p,
          status: p.status as ProjectStatus,
          customer_name: p.project_customers?.[0]?.customer_name,
          customer_email: p.project_customers?.[0]?.customer_email,
          engineer_name: engineerInfo?.engineer_name ?? undefined,
          engineer_user_id: engineerInfo?.engineer_user_id ?? undefined,
        };
      }),
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
