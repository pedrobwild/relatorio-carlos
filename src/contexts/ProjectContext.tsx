import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { projectsRepo, type ProjectWithCustomer } from "@/infra/repositories";
import { ensureCustomerProjectLink } from "@/hooks/useLinkCustomerOnLogin";
import { trackAmplitude } from "@/lib/amplitude";

// Re-export for backwards compatibility
export type Project = ProjectWithCustomer;

// Extended project type with is_project_phase
export interface ProjectExtended extends Omit<
  ProjectWithCustomer,
  "is_project_phase"
> {
  is_project_phase?: boolean;
}

interface ProjectContextType {
  project: (Project & { is_project_phase?: boolean }) | null;
  loading: boolean;
  error: string | null;
  setProject: (
    project: (Project & { is_project_phase?: boolean }) | null,
  ) => void;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<
    (Project & { is_project_phase?: boolean }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guarda a última chamada para o refetch manual, e para invalidar respostas
  // antigas quando o projectId muda no meio do voo.
  const requestIdRef = useRef(0);

  const fetchProject = useCallback(async () => {
    if (!projectId || !user) {
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    setProject(null);
    setLoading(true);
    setError(null);

    try {
      const first = await projectsRepo.getProjectWithCustomer(projectId);
      if (requestId !== requestIdRef.current) return;

      if (first.error) throw first.error;

      let data = first.data;

      // "Projeto não encontrado" para cliente costuma significar vínculo
      // pendente: a obra existe mas o customer_user_id ainda é NULL, então
      // o RLS esconde. Forçamos o re-link (ignorando a flag de sessão) e
      // refazemos a busca uma vez antes de mostrar erro.
      if (!data) {
        try {
          await ensureCustomerProjectLink(user, { force: true });
        } catch (linkErr) {
          console.warn("ensureCustomerProjectLink falhou:", linkErr);
        }
        if (requestId !== requestIdRef.current) return;

        const retry = await projectsRepo.getProjectWithCustomer(projectId);
        if (requestId !== requestIdRef.current) return;
        if (retry.error) throw retry.error;
        data = retry.data;
      }

      if (!data) {
        setError("Projeto não encontrado");
        setProject(null);
      } else {
        setProject(data);
        trackAmplitude("Project Opened", {
          project_id: data.id,
          project_name: data.name,
          status: data.status ?? null,
        });
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error fetching project:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro desconhecido ao carregar projeto",
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [projectId, user]);

  useEffect(() => {
    void fetchProject();
  }, [fetchProject]);

  return (
    <ProjectContext.Provider
      value={{ project, loading, error, setProject, refetch: fetchProject }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

/** Like `useProject`, but returns null instead of throwing when called outside
 * a `ProjectProvider`. Use in shared chrome (breadcrumbs, headers) that may
 * render in both project and non-project routes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useProjectOptional() {
  return useContext(ProjectContext) ?? null;
}
