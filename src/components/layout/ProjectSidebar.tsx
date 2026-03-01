import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  GanttChartSquare,
  TrendingUp,
  DollarSign,
  FolderOpen,
  ClipboardSignature,
  AlertCircle,
  FileText,
  Box,
  Ruler,
  Map,
  ShoppingCart,
  LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { useProject } from "@/contexts/ProjectContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePendencias } from "@/hooks/usePendencias";

interface SidebarNavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  /** Match also these paths for active state */
  matchPaths?: string[];
  /** Disabled in project phase */
  disabledInProjectPhase?: boolean;
  /** Only show in project phase */
  projectPhaseOnly?: boolean;
  /** Show a badge count */
  badgeKey?: "pendencias";
}

interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
  /** Hide entire group in project phase */
  hideInProjectPhase?: boolean;
}

export function ProjectSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId, paths } = useProjectNavigation();
  const { project } = useProject();
  const { stats: pendenciasStats } = usePendencias({ projectId });

  const isProjectPhase = project?.is_project_phase === true;

  const basePath = `/obra/${projectId}`;

  const groups: SidebarNavGroup[] = [
    {
      label: "Visão Geral",
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          path: basePath,
          matchPaths: [`${basePath}/relatorio`],
        },
      ],
    },
    {
      label: "Execução",
      hideInProjectPhase: false,
      items: [
        {
          label: "Editar Cronograma",
          icon: GanttChartSquare,
          path: paths.cronograma,
          disabledInProjectPhase: true,
        },
        {
          label: "Compras",
          icon: ShoppingCart,
          path: paths.compras,
          disabledInProjectPhase: true,
        },
      ],
    },
    {
      label: "Gestão",
      items: [
        {
          label: "Financeiro",
          icon: DollarSign,
          path: paths.financeiro,
        },
        {
          label: "Documentos",
          icon: FolderOpen,
          path: paths.documentos,
        },
        {
          label: "Formalizações",
          icon: ClipboardSignature,
          path: paths.formalizacoes,
        },
        {
          label: "Pendências",
          icon: AlertCircle,
          path: paths.pendencias,
          badgeKey: "pendencias",
        },
      ],
    },
    {
      label: "Projeto",
      items: [
        {
          label: "Contrato",
          icon: FileText,
          path: paths.contrato,
        },
        {
          label: "Projeto 3D",
          icon: Box,
          path: paths.projeto3D,
        },
        {
          label: "Executivo",
          icon: Ruler,
          path: paths.executivo,
        },
      ],
    },
    {
      label: "Jornada",
      items: [
        {
          label: "Jornada do Projeto",
          icon: Map,
          path: paths.jornada,
          projectPhaseOnly: false, // Always visible but contextual
        },
      ],
    },
  ];

  const isActive = (item: SidebarNavItem) => {
    const currentPath = location.pathname;
    if (currentPath === item.path) return true;
    if (item.matchPaths?.some((p) => currentPath === p)) return true;
    // For sub-routes like /formalizacoes/nova
    if (currentPath.startsWith(item.path + "/")) return true;
    return false;
  };

  const getBadgeCount = (key?: string) => {
    if (key === "pendencias") return pendenciasStats.total;
    return 0;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-2">
        {groups.map((group) => {
          // Filter items
          const visibleItems = group.items.filter((item) => {
            if (item.projectPhaseOnly && !isProjectPhase) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          // Check if all items are disabled
          const allDisabled =
            isProjectPhase &&
            visibleItems.every((item) => item.disabledInProjectPhase);

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    const disabled =
                      isProjectPhase && item.disabledInProjectPhase;
                    const badgeCount = getBadgeCount(item.badgeKey);

                    const button = (
                      <SidebarMenuButton
                        asChild={!disabled}
                        isActive={active}
                        className={cn(
                          disabled && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {disabled ? (
                          <div className="flex items-center gap-2 w-full">
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </div>
                        ) : (
                          <NavLink
                            to={item.path}
                            className="flex items-center gap-2 w-full"
                            activeClassName=""
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="truncate flex-1">
                                  {item.label}
                                </span>
                                {badgeCount > 0 && (
                                  <Badge
                                    variant={
                                      pendenciasStats.overdueCount > 0
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className="min-w-5 h-5 px-1.5 text-xs font-bold"
                                  >
                                    {badgeCount}
                                  </Badge>
                                )}
                              </>
                            )}
                          </NavLink>
                        )}
                      </SidebarMenuButton>
                    );

                    return (
                      <SidebarMenuItem key={item.path}>
                        {disabled ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{button}</TooltipTrigger>
                            <TooltipContent side="right">
                              Disponível quando a obra estiver em execução
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          button
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
