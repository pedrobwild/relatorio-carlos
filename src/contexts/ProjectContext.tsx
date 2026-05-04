import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { projectsRepo, type ProjectWithCustomer } from '@/infra/repositories';
import { trackAmplitude } from '@/lib/amplitude';

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

export const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<(Project & { is_project_phase?: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      if (!projectId || !user) {
        setLoading(false);
        return;
      }

      // Clear stale project data immediately on ID change
      setProject(null);
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await projectsRepo.getProjectWithCustomer(projectId);

        if (fetchError) throw fetchError;

        if (!data) {
          setError('Projeto não encontrado');
          setProject(null);
        } else {
          setProject(data);
          trackAmplitude('Project Opened', {
            project_id: data.id,
            project_name: data.name,
            status: data.status ?? null,
          });
        }
      } catch (err: unknown) {
        console.error('Error fetching project:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido ao carregar projeto');
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
