import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, GanttChartSquare, DollarSign, FolderOpen, ClipboardSignature, AlertCircle, FileText, Box, Ruler, Map, Package, ClipboardCheck, ChevronDown, LucideIcon, Building2, UserCircle, ListChecks, Receipt, Bot } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePendencias } from "@/hooks/usePendencias";
import { useUserRole } from "@/hooks/useUserRole";
import { useCan } from "@/hooks/useCan";
import type { Feature } from "@/config/permissions";
import { navigationLabels } from "@/constants/navigationLabels";

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
  badgeKey?: "pendencias" | "formalizacoes" | "financeiro";
  /** Only visible to staff users */
  staffOnly?: boolean;
  /** Only visible when current user has this feature permission */
  feature?: Feature;
  /** For clients, hide under a collapsible "Mais" section */
  clientSecondary?: boolean;
}

interface SidebarNavGroup {
  label: string;
  items: SidebarNavItem[];
  /** Hide entire group in project phase */
  hideInProjectPhase?: boolean;
  /** For clients, collapse this entire group under "Mais" */
  clientCollapsible?: boolean;
}

export function ProjectSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const _navigate = useNavigate();
  const { projectId, paths } = useProjectNavigation();
  const { project } = useProject();
  const { stats: pendenciasStats } = usePendencias({ projectId });
  const { isStaff } = useUserRole();
  const { can } = useCan();

  const isProjectPhase = project?.is_project_phase === true;

  /** Pick label based on role */
  const L = (key: string) => {
    const entry = navigationLabels.sidebar[key];
    if (!entry) return key;
    return isStaff ? entry.staff : entry.client;
  };

  const basePath = `/obra/${projectId}`;

  // Define all groups, then reorder based on role
  const allGroups: SidebarNavGroup[] = [
    {
      label: "Visão Geral",
      items: [
        {
          label: L("dashboard"),
          icon: LayoutDashboard,
          path: isStaff ? "/gestao" : basePath,
          matchPaths: isStaff ? [] : [`${basePath}/relatorio`],
        },
        {
          label: L("jornada"),
          icon: Map,
          path: paths.jornada,
        },
        {
          label: L("obra"),
          icon: Building2,
          path: paths.relatorio,
          staffOnly: true,
          disabledInProjectPhase: true,
        },
      ],
    },
    {
      label: "Projeto",
      clientCollapsible: true,
      items: [
        {
          label: L("contrato"),
          icon: FileText,
          path: paths.contrato,
        },
        {
          label: L("projeto3D"),
          icon: Box,
          path: paths.projeto3D,
        },
        {
          label: L("executivo"),
          icon: Ruler,
          path: paths.executivo,
        },
        {
          label: L("documentos"),
          icon: FolderOpen,
          path: paths.documentos,
        },
      ],
    },
    {
      label: "Dia a Dia",
      items: [
        {
          label: L("cronograma"),
          icon: GanttChartSquare,
          path: paths.cronograma,
          disabledInProjectPhase: true,
        },
        {
          label: "Compras",
          icon: Package,
          path: paths.compras,
          disabledInProjectPhase: true,
        },
        {
          label: L("vistorias"),
          icon: ClipboardCheck,
          path: paths.vistorias,
          disabledInProjectPhase: true,
          staffOnly: true,
        },
        {
          label: "Não Conformidades",
          icon: AlertCircle,
          path: paths.naoConformidades,
          disabledInProjectPhase: true,
          staffOnly: true,
        },
        {
          label: L("atividades"),
          icon: ListChecks,
          path: paths.atividades,
          staffOnly: true,
        },
        {
          label: L("assessor"),
          icon: Bot,
          path: paths.assessor,
          staffOnly: true,
          feature: "assessor:use",
        },
        {
          label: L("pendencias"),
          icon: AlertCircle,
          path: paths.pendencias,
          badgeKey: "pendencias",
        },
      ],
    },
    {
      label: "Gestão",
      items: [
        {
          label: L("financeiro"),
          icon: DollarSign,
          path: paths.financeiro,
          badgeKey: "financeiro",
        },
        {
          label: L("formalizacoes"),
          icon: ClipboardSignature,
          path: paths.formalizacoes,
          badgeKey: "formalizacoes",
        },
        {
          label: L("dadosCliente"),
          icon: UserCircle,
          path: paths.dadosCliente,
          staffOnly: true,
        },
        {
          label: L("orcamento"),
          icon: Receipt,
          path: paths.orcamento,
          staffOnly: true,
        },
      ],
    },
  ];

  // For staff: promote "Dia a Dia" (with Pendências/Cronograma) above "Projeto"
  // For clients: keep Visão Geral first (Jornada is prominent)
  const groups = isStaff
    ? [allGroups[0], allGroups[2], allGroups[1], allGroups[3]] // Visão Geral, Dia a Dia, Projeto, Gestão
    : allGroups;

  const isActive = (item: SidebarNavItem) => {
    const currentPath = location.pathname;
    if (currentPath === item.path) return true;
    if (item.matchPaths?.some((p) => currentPath === p)) return true;
    // For sub-routes like /formalizacoes/nova
    if (currentPath.startsWith(item.path + "/")) return true;
    return false;
  };

  const getBadgeCount = (key?: string): number => {
    if (key === "pendencias") return pendenciasStats.total;
    if (key === "formalizacoes") return pendenciasStats.byType.signature;
    if (key === "financeiro") return pendenciasStats.byType.invoice;
    return 0;
  };

  const isBadgeUrgent = (key?: string): boolean => {
    if (key === "pendencias") return pendenciasStats.overdueCount > 0;
    if (key === "formalizacoes" || key === "financeiro") {
      // Any pending item of this type is urgent enough to warrant attention
      return getBadgeCount(key) > 0;
    }
    return false;
  };

  // Track open state for client-collapsible groups
  const [clientGroupOpen, setClientGroupOpen] = useState<
    Record<string, boolean>
  >({});

  /** Render a single nav item */
  const renderNavItem = (item: SidebarNavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    const disabled = isProjectPhase && item.disabledInProjectPhase;
    const badgeCount = getBadgeCount(item.badgeKey);

    const button = (
      <SidebarMenuButton
        asChild={!disabled}
        isActive={active}
        className={cn(disabled && "opacity-50 cursor-not-allowed")}
      >
        {disabled ? (
          <div className="flex items-center gap-2 w-full">
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
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
                <span className="truncate flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <Badge
                    variant={
                      isBadgeUrgent(item.badgeKey) ? "destructive" : "secondary"
                    }
                    className={cn(
                      "min-w-5 h-5 px-1.5 text-xs font-bold",
                      isBadgeUrgent(item.badgeKey) &&
                        item.badgeKey !== "pendencias" &&
                        "animate-pulse",
                    )}
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
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-2">
        {groups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.projectPhaseOnly && !isProjectPhase) return false;
            if (item.staffOnly && !isStaff) return false;
            if (item.feature && !can(item.feature)) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          // For clients, collapse secondary groups under a "Mais" toggle
          const shouldCollapse =
            !isStaff && group.clientCollapsible && !collapsed;
          // Auto-open if any item in the group is active
          const hasActiveItem = visibleItems.some(isActive);

          if (shouldCollapse) {
            const isOpen = clientGroupOpen[group.label] ?? hasActiveItem;
            return (
              <SidebarGroup key={group.label}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) =>
                    setClientGroupOpen((prev) => ({
                      ...prev,
                      [group.label]: open,
                    }))
                  }
                >
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider flex items-center justify-between cursor-pointer hover:text-sidebar-foreground/80 transition-colors">
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {visibleItems.map(renderNavItem)}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs font-semibold uppercase tracking-wider">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{visibleItems.map(renderNavItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
