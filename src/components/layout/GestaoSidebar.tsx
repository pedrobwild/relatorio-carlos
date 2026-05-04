import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  FolderOpen,
  CalendarDays,
  Settings,
  Truck,
  Receipt,
  AlertTriangle,
  ClipboardList,
  Table2,
  Headset,
  BarChart3,
  Sparkles,
  Search,
  Package,
  Trash2,
  Building2,
  ClipboardEdit,
  LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useUserRole } from "@/hooks/useUserRole";
import { useScheduleAlertsSummary } from "@/hooks/useScheduleAlerts";
import { useScheduleAlertPrefs } from "@/hooks/useScheduleAlertPrefs";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
  matchPaths?: string[];
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function GestaoSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { total: alertsTotal } = useScheduleAlertsSummary();
  const { prefs: alertPrefs } = useScheduleAlertPrefs();
  const showAlertsBadge = alertPrefs.showBadge && alertsTotal > 0;

  const currentFase =
    new URLSearchParams(location.search).get("fase") === "projetos"
      ? "projetos"
      : "obras";

  const switchFase = (fase: "obras" | "projetos") => {
    const params = new URLSearchParams(location.search);
    if (fase === "projetos") params.set("fase", "projetos");
    else params.delete("fase");
    const qs = params.toString();
    navigate(`/gestao/painel-obras${qs ? `?${qs}` : ""}`);
  };

  const groups: NavGroup[] = [
    {
      label: "Obras",
      items: [
        {
          label: "Painel de Obras",
          icon: Table2,
          path: "/gestao/painel-obras",
          matchPaths: ["/gestao/obra/"],
        },
        {
          label: "Painel de Projetos",
          icon: Table2,
          path: "/gestao/painel-obras?fase=projetos",
        },
        {
          label: "Alertas de Cronograma",
          icon: AlertTriangle,
          path: "/gestao/alertas-cronograma",
        },
        {
          label: "Nova Obra",
          icon: Plus,
          path: "/gestao/nova-obra",
        },
        {
          label: "Lixeira",
          icon: Trash2,
          path: "/gestao/lixeira",
        },
      ],
    },
    {
      label: "Ferramentas",
      items: [
        {
          label: "Assistente IA",
          icon: Sparkles,
          path: "/gestao/assistente",
        },
        {
          label: "Consultas do Assistente",
          icon: Search,
          path: "/gestao/assistente/consultas",
        },
        {
          label: "Atividades",
          icon: ClipboardList,
          path: "/gestao/atividades",
        },
        {
          label: "CS — Operacional",
          icon: Headset,
          path: "/gestao/cs/operacional",
        },
        {
          label: "CS — Analytics",
          icon: BarChart3,
          path: "/gestao/cs/analytics",
        },
        {
          label: "Não Conformidades",
          icon: AlertTriangle,
          path: "/gestao/nao-conformidades",
        },
        {
          label: "Orçamentos",
          icon: Receipt,
          path: "/gestao/orcamentos",
        },
        {
          label: "Fornecedores",
          icon: Truck,
          path: "/gestao/fornecedores",
        },
        {
          label: "Calendário de Obras",
          icon: CalendarDays,
          path: "/gestao/calendario-obras",
        },
        {
          label: "Calendário de Compras",
          icon: CalendarDays,
          path: "/gestao/calendario-compras",
        },
        {
          label: "Estoque",
          icon: Package,
          path: "/gestao/estoque",
        },
        {
          label: "Arquivos",
          icon: FolderOpen,
          path: "/gestao/arquivos",
        },
      ],
    },
    {
      label: "Administração",
      items: [
        {
          label: "Logs do Assistente",
          icon: BarChart3,
          path: "/gestao/assistente/logs",
          adminOnly: true,
        },
        {
          label: "Config. Fornecedores",
          icon: Truck,
          path: "/gestao/fornecedores/admin",
          adminOnly: true,
        },
        {
          label: "Configurações",
          icon: Settings,
          path: "/admin",
          adminOnly: true,
        },
      ],
    },
  ];

  const isActive = (item: NavItem) => {
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const currentFase = new URLSearchParams(currentSearch).get("fase");

    // Painel de Obras (execução): ativo só quando a URL não está em ?fase=projetos
    if (item.path === "/gestao/painel-obras") {
      const onPainel =
        currentPath === "/gestao/painel-obras" ||
        currentPath === "/gestao" ||
        currentPath.startsWith("/gestao/obra/");
      return onPainel && currentFase !== "projetos";
    }
    // Painel de Projetos: ativo só quando ?fase=projetos
    if (item.path === "/gestao/painel-obras?fase=projetos") {
      return (
        currentPath === "/gestao/painel-obras" && currentFase === "projetos"
      );
    }
    if (item.path === "/gestao/cs/operacional") {
      if (currentPath === "/gestao/cs/operacional") return true;
      if (
        currentPath.startsWith("/gestao/cs/") &&
        currentPath !== "/gestao/cs/analytics"
      ) {
        return true;
      }
      return false;
    }
    if (currentPath === item.path) return true;
    if (item.matchPaths?.some((p) => currentPath.startsWith(p))) return true;
    return false;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border-subtle">
      <SidebarContent className="pt-3 px-1 gap-1">
        {/* Atalho rápido: alternar entre Obras e Projetos */}
        <div className="px-2 pb-2">
          {collapsed ? (
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                size="icon"
                variant={currentFase === "obras" ? "default" : "ghost"}
                onClick={() => switchFase("obras")}
                aria-label="Ver Obras"
                aria-pressed={currentFase === "obras"}
                className="h-8 w-8"
              >
                <Building2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={currentFase === "projetos" ? "default" : "ghost"}
                onClick={() => switchFase("projetos")}
                aria-label="Ver Projetos"
                aria-pressed={currentFase === "projetos"}
                className="h-8 w-8"
              >
                <ClipboardEdit className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              role="tablist"
              aria-label="Alternar entre Obras e Projetos"
              className="grid grid-cols-2 gap-1 p-1 bg-sidebar-accent/40 rounded-md"
            >
              <button
                type="button"
                role="tab"
                aria-selected={currentFase === "obras"}
                onClick={() => switchFase("obras")}
                className={cn(
                  "flex items-center justify-center gap-1.5 h-7 rounded text-[12px] font-medium transition-colors",
                  currentFase === "obras"
                    ? "bg-background text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Obras
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={currentFase === "projetos"}
                onClick={() => switchFase("projetos")}
                className={cn(
                  "flex items-center justify-center gap-1.5 h-7 rounded text-[12px] font-medium transition-colors",
                  currentFase === "projetos"
                    ? "bg-background text-sidebar-primary shadow-sm"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                )}
              >
                <ClipboardEdit className="h-3.5 w-3.5" />
                Projetos
              </button>
            </div>
          )}
        </div>

        {groups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || isAdmin,
          );
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label} className="px-1">
              {!collapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/55 text-[10px] font-semibold uppercase tracking-[0.08em] px-2 mb-1">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);
                    const isAlertsItem =
                      item.path === "/gestao/alertas-cronograma";
                    const showBadge = isAlertsItem && showAlertsBadge;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          className="h-8 rounded-md text-[13px] data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-primary data-[active=true]:font-semibold"
                        >
                          <NavLink
                            to={item.path}
                            className="flex items-center gap-2.5 w-full"
                            activeClassName=""
                          >
                            <span className="relative shrink-0">
                              <Icon
                                className={cn(
                                  "h-[15px] w-[15px]",
                                  active
                                    ? "text-sidebar-primary"
                                    : "text-sidebar-foreground/70",
                                )}
                              />
                              {showBadge && collapsed && (
                                <span
                                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            {!collapsed && (
                              <>
                                <span className="truncate flex-1">
                                  {item.label}
                                </span>
                                {showBadge && (
                                  <Badge
                                    variant="destructive"
                                    className="h-4 min-w-[18px] px-1 text-[10px] font-semibold tabular-nums"
                                    aria-label={`${alertsTotal} ${alertsTotal === 1 ? "alerta" : "alertas"} de cronograma`}
                                  >
                                    {alertsTotal > 99 ? "99+" : alertsTotal}
                                  </Badge>
                                )}
                              </>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
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
