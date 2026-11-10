/**
 * /obra/:projectId — escolhe o hub da obra.
 *
 * - Equipe no celular (abaixo de `md`), obra em execução: o hub enxuto
 *   (`StaffObraHubMobile`).
 * - Cliente, desktop e obra em fase de projeto: a `Index` de sempre, sem
 *   nenhuma mudança (ela continua cuidando de carregamento, erros e do
 *   redirecionamento para a Jornada).
 *
 * A largura é lida de forma síncrona: `useIsMobile` começa em `false` e
 * montaria a `Index` por um instante, disparando os redirecionamentos dela.
 */
import { lazy, useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/contexts/ProjectContext";
import { useUserRole } from "@/hooks/useUserRole";

const Index = lazy(() => import("@/pages/Index"));
const StaffObraHubMobile = lazy(() =>
  import("@/components/obra/mobile/StaffObraHubMobile").then((m) => ({ default: m.StaffObraHubMobile })),
);

const MOBILE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Mesmo corte do `useIsMobile` (md = 768px), já certo no primeiro render. */
function useIsMobileSync(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth < 768,
    () => false,
  );
}

export default function ObraHubEntry() {
  const { isStaff } = useUserRole();
  const isMobile = useIsMobileSync();
  const { project, loading, error } = useProject();

  if (!isStaff || !isMobile || error) return <Index />;
  if (loading && !project) {
    return (
      <div className="space-y-3 px-4 py-4" aria-busy="true" aria-label="Carregando obra">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    );
  }
  if (!project || project.is_project_phase) return <Index />;
  return <StaffObraHubMobile />;
}
