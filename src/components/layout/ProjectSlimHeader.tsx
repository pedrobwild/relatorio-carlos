import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronRight, ChevronsUpDown, Bell, Check } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { usePendencias } from "@/hooks/usePendencias";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import { getNavLabel } from "@/constants/navigationLabels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function useCurrentPageLabel(projectId: string | undefined, isStaff: boolean): string | null {
  const location = useLocation();
  if (!projectId) return null;
  const prefix = `/obra/${projectId}`;
  const sub = location.pathname.replace(prefix, "").replace(/^\//, "").split("/")[0];
  if (!sub) return isStaff ? "Dashboard" : "Início";
  return getNavLabel("breadcrumb", sub, isStaff);
}

export function ProjectSlimHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { data: projects = [] } = useProjectsQuery();
  const { stats: pendenciasStats } = usePendencias({ projectId });
  const { isStaff } = useUserRole();

  const currentPageLabel = useCurrentPageLabel(projectId, isStaff);

  const otherProjects = useMemo(
    () => projects.filter((p) => p.id !== projectId),
    [projects, projectId]
  );

  /** Switch project preserving the current sub-route */
  const handleProjectSwitch = (targetId: string) => {
    if (!projectId) {
      navigate(`/obra/${targetId}`);
      return;
    }
    const currentSub = location.pathname.replace(`/obra/${projectId}`, "");
    navigate(`/obra/${targetId}${currentSub}`);
  };

  const projectDisplayName = project
    ? `${project.name}${project.unit_name ? ` – ${project.unit_name}` : ""}`
    : "Carregando…";

  return (
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 z-40">
      {/* Sidebar trigger */}
      <SidebarTrigger className="shrink-0" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Breadcrumb with project switcher */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 overflow-hidden">
        {/* Level 1: Minhas Obras */}
        <Link
          to="/minhas-obras"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 hidden sm:inline"
        >
          Minhas Obras
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 hidden sm:block" />

        {/* Level 2: Project name as dropdown switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 text-left hover:bg-accent rounded-md px-2 py-1 transition-colors group min-w-0">
              <span className="text-sm font-semibold text-foreground truncate max-w-[200px] group-hover:text-primary transition-colors">
                {projectDisplayName}
              </span>
              {otherProjects.length > 0 && (
                <ChevronsUpDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          {otherProjects.length > 0 && (
            <DropdownMenuContent align="start" className="w-72 bg-popover">
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Trocar de Obra
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {/* Current project (checked) */}
              <DropdownMenuItem disabled className="flex items-center gap-2 opacity-70">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="font-medium text-sm truncate block">{projectDisplayName}</span>
                  {project?.customer_name && (
                    <span className="text-xs text-muted-foreground">{project.customer_name}</span>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {otherProjects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleProjectSwitch(p.id)}
                  className="flex flex-col items-start gap-0.5 cursor-pointer"
                >
                  <span className="font-medium text-sm">
                    {p.name} {p.unit_name && `– ${p.unit_name}`}
                  </span>
                  {p.customer_name && (
                    <span className="text-xs text-muted-foreground">
                      {p.customer_name}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>

        {/* Level 3: Current page */}
        {currentPageLabel && (
          <>
            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate shrink-0">
              {currentPageLabel}
            </span>
          </>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search */}
      <GlobalSearchDialog />

      {/* Pendencias badge */}
      <Link
        to={paths.pendencias}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-sm font-medium border",
          "hover:shadow-sm active:scale-[0.97]",
          pendenciasStats.overdueCount > 0
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : pendenciasStats.urgentCount > 0
              ? "bg-warning/10 text-warning border-warning/20"
              : "bg-secondary text-muted-foreground border-border"
        )}
        aria-label={`${pendenciasStats.total} pendências`}
      >
        <Bell className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-xs">Pendências</span>
        <Badge
          variant={
            pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"
          }
          className="min-w-4 h-4 px-1 text-[10px] font-bold"
        >
          {pendenciasStats.total}
        </Badge>
      </Link>

      {/* Notifications */}
      <NotificationBell />

      {/* User menu */}
      <UserMenu />
    </header>
  );
}
