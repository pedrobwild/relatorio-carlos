import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, ChevronsUpDown, Search, Check } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProjectsQuery } from "@/hooks/useProjectsQuery";
import { useUserRole } from "@/hooks/useUserRole";
import { usePendingCountsByProject } from "@/hooks/usePendingCountsByProject";
import { matchesSearch } from "@/lib/searchNormalize";
import { getSectionLabel } from "@/config/sectionLabels";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunhos",
  active: "Ativas",
  paused: "Pausadas",
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

const STATUS_ORDER = ["draft", "active", "paused", "completed", "cancelled"];

/**
 * ProjectMobileHeader — slim mobile-only header for project pages.
 *
 * Provides parity with ProjectSlimHeader (desktop) on mobile:
 * - Sidebar trigger to access full project nav (staff)
 * - Project switcher with search and grouping by status
 * - Notification bell
 * - User menu
 *
 * Renders only on mobile (<md). Desktop continues to use ProjectSlimHeader.
 */
export function ProjectMobileHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { project } = useProject();
  const { projectId } = useProjectNavigation();
  const { data: projects = [] } = useProjectsQuery();
  const { isStaff } = useUserRole();
  const { data: pendingByProject } = usePendingCountsByProject();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const otherProjects = useMemo(
    () => projects.filter((p) => p.id !== projectId),
    [projects, projectId],
  );

  const groupedProjects = useMemo(() => {
    const filtered = searchQuery.trim()
      ? otherProjects.filter((p) =>
          matchesSearch(searchQuery, [p.name, p.unit_name, p.customer_name]),
        )
      : otherProjects;

    const groups: Record<string, typeof filtered> = {};
    for (const p of filtered) {
      const status = p.status || "active";
      (groups[status] ??= []).push(p);
    }

    return STATUS_ORDER
      .filter((s) => groups[s]?.length)
      .map((s) => ({ status: s, label: STATUS_LABELS[s] || s, projects: groups[s] }));
  }, [otherProjects, searchQuery]);

  const handleProjectSwitch = (targetId: string) => {
    setOpen(false);
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

  const sectionLabel = getSectionLabel(location.pathname);
  const hasOthers = otherProjects.length > 0;

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-shell h-12 shrink-0",
        "border-b border-border-subtle surface-glass",
        "flex items-center px-2 gap-1 pt-safe",
      )}
      aria-label="Cabeçalho da obra"
    >
      {/* Sidebar trigger — staff only (clients have no sidebar on mobile) */}
      {isStaff && (
        <SidebarTrigger
          aria-label="Abrir menu da obra"
          className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]"
        />
      )}

      {/* Project switcher */}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearchQuery("");
        }}
      >
        <SheetTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left",
              "hover:bg-accent/50 active:bg-accent transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
            )}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Obra atual: ${projectDisplayName}. Toque para trocar de obra.`}
          >
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-foreground truncate leading-tight">
                {projectDisplayName}
              </span>
              {sectionLabel ? (
                <span className="block text-[11px] text-muted-foreground truncate leading-tight">
                  <span aria-hidden="true">›</span> {sectionLabel}
                </span>
              ) : (
                project?.customer_name && (
                  <span className="block text-[10px] text-muted-foreground truncate leading-tight">
                    {project.customer_name}
                  </span>
                )
              )}
            </span>
            {hasOthers && (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
        </SheetTrigger>

        {hasOthers && (
          <SheetContent
            side="bottom"
            className="rounded-t-3xl pb-safe max-h-[88dvh] flex flex-col p-0"
          >
            <SheetHeader className="px-5 pt-4 pb-2 shrink-0 text-left">
              <SheetTitle className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4" aria-hidden="true" />
                Trocar de Obra
              </SheetTitle>
            </SheetHeader>

            {otherProjects.length > 4 && (
              <div className="px-5 pb-3 shrink-0 border-b border-border-subtle">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar obra…"
                    className="pl-9 h-11"
                    aria-label="Buscar obra"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {/* Current project */}
              <div className="px-3 py-2.5 rounded-xl bg-primary/5 mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate">{projectDisplayName}</p>
                  {project?.customer_name && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {project.customer_name}
                    </p>
                  )}
                </div>
              </div>

              {groupedProjects.length === 0 && searchQuery && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma obra encontrada
                </p>
              )}

              {groupedProjects.map((group) => (
                <div key={group.status} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 px-2 mb-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5",
                        STATUS_BADGE_STYLES[group.status],
                      )}
                    >
                      {group.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {group.projects.length}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {group.projects.map((p) => {
                      const pendingCount =
                        pendingByProject instanceof Map
                          ? pendingByProject.get(p.id) ?? 0
                          : (pendingByProject as Record<string, number> | undefined)?.[p.id] ?? 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProjectSwitch(p.id)}
                          className={cn(
                            "flex items-start gap-2 w-full px-3 py-3 rounded-xl text-left",
                            "min-h-[56px] transition-all active:scale-[0.98]",
                            "hover:bg-muted/60 active:bg-muted",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="block text-[13px] font-semibold text-foreground truncate">
                              {p.name}
                              {p.unit_name && ` – ${p.unit_name}`}
                            </span>
                            <span className="flex items-center gap-1.5 mt-0.5">
                              {p.customer_name && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {p.customer_name}
                                </span>
                              )}
                              {isStaff && (p as { engineer_name?: string }).engineer_name && (
                                <>
                                  <span className="text-[11px] text-muted-foreground/50">·</span>
                                  <span className="text-[11px] text-muted-foreground/70 truncate">
                                    {(p as { engineer_name?: string }).engineer_name}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          {pendingCount > 0 && (
                            <Badge
                              variant="destructive"
                              className="shrink-0 min-w-5 h-5 px-1.5 text-[10px] font-bold mt-0.5"
                              aria-label={`${pendingCount} pendências`}
                            >
                              {pendingCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SheetContent>
        )}
      </Sheet>

      <Link
        to="/"
        className="sr-only"
        aria-label="Ir para a página inicial"
      >
        Início
      </Link>

      <NotificationBell />
      <UserMenu />
    </header>
  );
}
