import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ProjectWithCustomer } from '@/infra/repositories';

// Re-export for backwards compatibility
export type Project = ProjectWithCustomer;

// Extended project type with is_project_phase
export interface ProjectExtended extends Omit<ProjectWithCustomer, 'is_project_phase'> {
  is_project_phase?: boolean;
}

interface ProjectContextType {
  project: (Project & { is_project_phase?: boolean }) | null;
  loading: boolean;
  error: string | null;
  setProject: (project: (Project & { is_project_phase?: boolean }) | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<(Project & { is_project_phase?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!projectId || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('projects')
          .select(`
            *,
            project_customers (
              customer_name,
              customer_email
            )
          `)
          .eq('id', projectId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError('Projeto não encontrado');
          setProject(null);
        } else {
          setProject({
            ...data,
            status: data.status as Project['status'],
            customer_name: data.project_customers?.[0]?.customer_name,
            customer_email: data.project_customers?.[0]?.customer_email,
            is_project_phase: data.is_project_phase,
          });
        }
      } catch (err: any) {
        console.error('Error fetching project:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [projectId, user]);

  return (
    <ProjectContext.Provider value={{ project, loading, error, setProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
