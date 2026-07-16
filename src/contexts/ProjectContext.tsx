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

export type ProjectStatus =
  | "idle"
  | "loading"
  | "linking"
  | "ready"
  | "not-found"
  | "error";

export type ProjectErrorKind =
  | "not-found"
  | "link-failed"
  | "network"
  | "unknown";

interface ProjectContextType {
  project: (Project & { is_project_phase?: boolean }) | null;
  loading: boolean;
  /** True while we're re-linking the customer and retrying the fetch. */
  linking: boolean;
  status: ProjectStatus;
  error: string | null;
  errorKind: ProjectErrorKind | null;
  setProject: (
    project: (Project & { is_project_phase?: boolean }) | null,
  ) => void;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

function classifyError(err: unknown): {
  kind: ProjectErrorKind;
  message: string;
} {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const lower = raw.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("timeout") ||
    lower.includes("offline")
  ) {
    return {
      kind: "network",
      message:
        "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
    };
  }

  return {
    kind: "unknown",
    message: raw || "Erro inesperado ao carregar a obra. Tente novamente.",
  };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<
    (Project & { is_project_phase?: boolean }) | null
  >(null);
  const [status, setStatus] = useState<ProjectStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ProjectErrorKind | null>(null);

  // Guarda a última chamada para o refetch manual, e para invalidar respostas
  // antigas quando o projectId muda no meio do voo.
  const requestIdRef = useRef(0);

  const fetchProject = useCallback(async () => {
    if (!projectId || !user) {
      setStatus("idle");
      return;
    }

    const requestId = ++requestIdRef.current;

    setProject(null);
    setStatus("loading");
    setError(null);
    setErrorKind(null);

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
        setStatus("linking");
        let linkFailed = false;
        try {
          await ensureCustomerProjectLink(user, { force: true });
        } catch (linkErr) {
          console.warn("ensureCustomerProjectLink falhou:", linkErr);
          linkFailed = true;
        }
        if (requestId !== requestIdRef.current) return;

        try {
          const retry = await projectsRepo.getProjectWithCustomer(projectId);
          if (requestId !== requestIdRef.current) return;
          if (retry.error) throw retry.error;
          data = retry.data;
        } catch (retryErr) {
          if (requestId !== requestIdRef.current) return;
          console.error("Retry fetch after re-link failed:", retryErr);
          const { kind, message } = classifyError(retryErr);
          setErrorKind(linkFailed ? "link-failed" : kind);
          setError(
            linkFailed
              ? "Não foi possível vincular seu acesso a esta obra. Tente novamente em instantes ou fale com o responsável."
              : message,
          );
          setStatus("error");
          return;
        }

        if (!data && linkFailed) {
          setErrorKind("link-failed");
          setError(
            "Não foi possível vincular seu acesso a esta obra. Tente novamente em instantes ou fale com o responsável.",
          );
          setStatus("error");
          return;
        }
      }

      if (!data) {
        setErrorKind("not-found");
        setError("Projeto não encontrado");
        setProject(null);
        setStatus("not-found");
      } else {
        setProject(data);
        setStatus("ready");
        trackAmplitude("Project Opened", {
          project_id: data.id,
          project_name: data.name,
          status: data.status ?? null,
        });
      }
    } catch (err: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error fetching project:", err);
      const { kind, message } = classifyError(err);
      setErrorKind(kind);
      setError(message);
      setStatus("error");
    }
  }, [projectId, user]);

  useEffect(() => {
    void fetchProject();
  }, [fetchProject]);

  const loading = status === "loading" || status === "linking";
  const linking = status === "linking";

  return (
    <ProjectContext.Provider
      value={{
        project,
        loading,
        linking,
        status,
        error,
        errorKind,
        setProject,
        refetch: fetchProject,
      }}
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
