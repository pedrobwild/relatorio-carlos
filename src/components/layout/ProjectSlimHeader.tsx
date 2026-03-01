import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ChevronsUpDown, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/layout/UserMenu";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { usePendencias } from "@/hooks/usePendencias";
import bwildLogo from "@/assets/bwild-logo-dark.png";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ProjectSlimHeader() {
  const navigate = useNavigate();
  const { project } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { data: projects = [] } = useProjectsQuery();
  const { stats: pendenciasStats } = usePendencias({ projectId });

  const otherProjects = useMemo(
    () => projects.filter((p) => p.id !== projectId),
    [projects, projectId]
  );

  const handleProjectSwitch = (targetId: string) => {
    navigate(`/obra/${targetId}`);
  };

  const phaseBadge = project?.is_project_phase ? (
    <Badge
      variant="secondary"
      className="bg-primary/10 text-primary border-primary/20 text-xs font-medium shrink-0"
    >
      Em Projeto
    </Badge>
  ) : (
    <Badge
      variant="secondary"
      className="bg-success/10 text-success border-success/20 text-xs font-medium shrink-0"
    >
      Em Execução
    </Badge>
  );

  return (
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 z-40">
      {/* Sidebar trigger */}
      <SidebarTrigger className="shrink-0" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Project selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors group min-w-0">
            <img src={bwildLogo} alt="Bwild" className="h-6 w-auto shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {project?.name}
                  {project?.unit_name && ` – ${project.unit_name}`}
                </span>
              </div>
              {project?.customer_name && (
                <p className="text-xs text-muted-foreground truncate hidden sm:block">
                  {project.customer_name}
                </p>
              )}
            </div>
            {otherProjects.length > 0 && (
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            )}
          </button>
        </DropdownMenuTrigger>
        {otherProjects.length > 0 && (
          <DropdownMenuContent align="start" className="w-72 bg-popover">
            <DropdownMenuLabel className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Trocar de Obra
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {otherProjects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleProjectSwitch(p.id)}
                className="flex flex-col items-start gap-0.5 cursor-pointer"
              >
                <span className="font-medium">
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

      {/* Phase badge */}
      <div className="hidden sm:block">{phaseBadge}</div>

      {/* Spacer */}
      <div className="flex-1" />

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

      {/* User menu */}
      <UserMenu />
    </header>
  );
}
