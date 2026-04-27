import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronRight, ChevronsUpDown, Bell, Check, Search } from "lucide-react";
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
import { usePendingCountsByProject } from "@/hooks/usePendingCountsByProject";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/searchNormalize";
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
import { Input } from "@/components/ui/input";

function useCurrentPageLabel(projectId: string | undefined, isStaff: boolean): string | null {
  const location = useLocation();
  if (!projectId) return null;
  const prefix = `/obra/${projectId}`;
  const sub = location.pathname.replace(prefix, "").replace(/^\//, "").split("/")[0];
  if (!sub) return isStaff ? "Dashboard" : "Início";
  return getNavLabel("breadcrumb", sub, isStaff);
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunhos",
  active: "Obras Ativas",
  paused: "Obras Pausadas",
  completed: "Concluídas",
  cancelled: "Canceladas",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-600 border-slate-400/25",
  active: "bg-primary/15 text-primary border-primary/25",
  paused: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25",
  completed: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const STATUS_SHORT_LABELS: Record<string, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const STATUS_ORDER = ["draft", "active", "paused", "completed", "cancelled"];

export function ProjectSlimHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useProject();
  const { projectId, paths } = useProjectNavigation();
  const { data: projects = [] } = useProjectsQuery();
  const { stats: pendenciasStats } = usePendencias({ projectId });
  const { data: pendingByProject } = usePendingCountsByProject();
  const { isStaff } = useUserRole();
  const [searchQuery, setSearchQuery] = useState("");

  const currentPageLabel = useCurrentPageLabel(projectId, isStaff);

  const otherProjects = useMemo(
    () => projects.filter((p) => p.id !== projectId),
    [projects, projectId]
  );

  /** Group other projects by status, filtered by search */
  const groupedProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? otherProjects.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.unit_name?.toLowerCase().includes(q) ||
            p.customer_name?.toLowerCase().includes(q)
        )
      : otherProjects;

    const groups: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      const status = p.status || "active";
      if (!groups[status]) groups[status] = [];
      groups[status].push(p);
    }

    return STATUS_ORDER
      .filter((s) => groups[s]?.length)
      .map((s) => ({ status: s, label: STATUS_LABELS[s] || s, projects: groups[s] }));
  }, [otherProjects, searchQuery]);

  const hasMultipleGroups = groupedProjects.length > 1;

  /** Switch project preserving the current sub-route */
  const handleProjectSwitch = (targetId: string) => {
    setSearchQuery("");
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
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur-sm items-center px-3 gap-2 shrink-0 z-40 hidden md:flex">
      {/* Sidebar trigger */}
      <SidebarTrigger className="shrink-0" />

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Breadcrumb with project switcher */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0 overflow-hidden">
        {/* Level 1: Minhas Obras */}
        <Link
          to={isStaff ? "/gestao" : "/minhas-obras"}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 hidden sm:inline"
        >
          {isStaff ? "Painel de Obras" : "Minhas Obras"}
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 hidden sm:block" />

        {/* Level 2: Project name as dropdown switcher — prominent with status badge */}
        <DropdownMenu onOpenChange={(open) => { if (!open) setSearchQuery(""); }}>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 text-left hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors group min-w-0 border border-transparent hover:border-border">
              {project?.status && (
                <span className={cn(
                  "shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide",
                  STATUS_BADGE_STYLES[project.status] || STATUS_BADGE_STYLES.active
                )}>
                  {STATUS_SHORT_LABELS[project.status] || project.status}
                </span>
              )}
              <div className="min-w-0">
                <span className="text-sm font-bold text-foreground truncate max-w-[220px] block group-hover:text-primary transition-colors leading-tight">
                  {projectDisplayName}
                </span>
                {project?.customer_name && (
                  <span className="text-[10px] text-muted-foreground truncate block leading-tight">
                    {project.customer_name}
                  </span>
                )}
              </div>
              {otherProjects.length > 0 && (
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          {otherProjects.length > 0 && (
            <DropdownMenuContent align="start" className="w-80 bg-popover max-h-[420px] overflow-hidden flex flex-col">
              <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Trocar de Obra
              </DropdownMenuLabel>

              {/* Search input */}
              {otherProjects.length > 4 && (
                <div className="px-2 py-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                     <Input
                      placeholder="🔍 Buscar ou selecionar obra…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-sm"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              )}

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

              {/* Grouped project list */}
              <div className="overflow-y-auto flex-1">
                {groupedProjects.length === 0 && searchQuery && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Nenhuma obra encontrada
                  </div>
                )}
                {groupedProjects.map((group, gi) => (
                  <div key={group.status}>
                    {(hasMultipleGroups || searchQuery) && (
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold py-1">
                        {group.label}
                      </DropdownMenuLabel>
                    )}
                    {group.projects.map((p) => {
                      const pendingCount = pendingByProject instanceof Map
                        ? (pendingByProject.get(p.id) ?? 0)
                        : (pendingByProject?.[p.id] ?? 0);
                      return (
                        <DropdownMenuItem
                          key={p.id}
                          onClick={() => handleProjectSwitch(p.id)}
                          className="flex items-start gap-2 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-sm block">
                              {p.name} {p.unit_name && `– ${p.unit_name}`}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {p.customer_name && (
                                <span className="text-xs text-muted-foreground">
                                  {p.customer_name}
                                </span>
                              )}
                              {isStaff && (p as any).engineer_name && (
                                <>
                                  <span className="text-xs text-muted-foreground/50">·</span>
                                  <span className="text-xs text-muted-foreground/70">
                                    {(p as any).engineer_name}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          {pendingCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="shrink-0 min-w-5 h-5 px-1.5 text-[10px] font-bold mt-0.5"
                            >
                              {pendingCount}
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                    {gi < groupedProjects.length - 1 && <DropdownMenuSeparator />}
                  </div>
                ))}
              </div>
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

      {/* Pendencias badge — shows critical count (overdue + urgent) prominently */}
      {(() => {
        const criticalCount = pendenciasStats.overdueCount + pendenciasStats.urgentCount;
        const hasCritical = criticalCount > 0;
        return (
          <Link
            to={hasCritical ? `${paths.pendencias}?filtro=criticas` : paths.pendencias}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all text-sm font-medium border",
              "hover:shadow-sm active:scale-[0.97]",
              pendenciasStats.overdueCount > 0
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : pendenciasStats.urgentCount > 0
                  ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20"
                  : "bg-secondary text-muted-foreground border-border"
            )}
            aria-label={hasCritical ? `${criticalCount} pendências críticas` : `${pendenciasStats.total} pendências`}
          >
            {pendenciasStats.overdueCount > 0 ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
            ) : pendenciasStats.urgentCount > 0 ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--warning))] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--warning))]" />
              </span>
            ) : null}
            <Bell className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">
              {hasCritical ? "Críticas" : "Pendências"}
            </span>
            <Badge
              variant={pendenciasStats.overdueCount > 0 ? "destructive" : "secondary"}
              className="min-w-4 h-4 px-1 text-[10px] font-bold"
            >
              {hasCritical ? criticalCount : pendenciasStats.total}
            </Badge>
          </Link>
        );
      })()}

      {/* Notifications */}
      <NotificationBell />

      {/* User menu */}
      <UserMenu />
    </header>
  );
}