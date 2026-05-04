import { NavLink } from "@/components/NavLink";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { useProjectLayout } from "@/components/layout/ProjectLayoutContext";
import { cn } from "@/lib/utils";
import { Map } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  /** Only show for staff roles */
  staffOnly?: boolean;
  /** Only show when project is in project phase */
  projectPhaseOnly?: boolean;
}

interface ProjectSubNavProps {
  className?: string;
  /** Show staff-only items */
  showStaffItems?: boolean;
}

/**
 * ProjectSubNav — horizontal sub-navigation for obra internal pages.
 * Shows only secondary sections (Contrato, Projeto 3D, Executivo, Jornada).
 * Primary sections are now tabs in the main content area.
 */
export function ProjectSubNav({
  className,
  showStaffItems = false,
}: ProjectSubNavProps) {
  const { paths, projectId } = useProjectNavigation();
  const { project } = useProject();
  const { hasShell } = useProjectLayout();

  // When sidebar shell is active, sub-nav is redundant
  if (hasShell) return null;

  if (!projectId) return null;

  const isProjectPhase = project?.is_project_phase === true;

  const navItems: NavItem[] = [
    {
      label: "Jornada",
      path: paths.jornada,
      icon: Map,
      projectPhaseOnly: true,
    },
  ];

  const visibleItems = navItems
    .filter((item) => showStaffItems || !item.staffOnly)
    .filter((item) => !item.projectPhaseOnly || isProjectPhase);

  return (
    <div
      className={cn(
        "sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border",
        className,
      )}
    >
      <div className="max-w-5xl mx-auto">
        <ScrollArea className="w-full">
          <nav
            className="flex items-center gap-1 px-4 sm:px-6 md:px-8 py-1.5"
            aria-label="Navegação do projeto"
          >
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === paths.relatorio}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  activeClassName="text-primary font-medium bg-primary/10 hover:bg-primary/10 hover:text-primary"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </div>
    </div>
  );
}
