import { useLocation } from "react-router-dom";
import {
  Building2,
  Plus,
  FolderOpen,
  CalendarDays,
  Settings,
  LayoutDashboard,
  Truck,
  Receipt,
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
import { useUserRole } from "@/hooks/useUserRole";

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
  const { isAdmin } = useUserRole();

  const groups: NavGroup[] = [
    {
      label: "Obras",
      items: [
        {
          label: "Painel de Obras",
          icon: LayoutDashboard,
          path: "/gestao",
        },
        {
          label: "Nova Obra",
          icon: Plus,
          path: "/gestao/nova-obra",
        },
      ],
    },
    {
      label: "Ferramentas",
      items: [
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
          label: "Calendário de Compras",
          icon: CalendarDays,
          path: "/gestao/calendario-compras",
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
    if (item.path === "/gestao") {
      return currentPath === "/gestao" || currentPath.startsWith("/gestao/obra/");
    }
    if (currentPath === item.path) return true;
    if (item.matchPaths?.some((p) => currentPath.startsWith(p))) return true;
    return false;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="pt-2">
        {groups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.adminOnly || isAdmin
          );
          if (visibleItems.length === 0) return null;

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
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild isActive={active}>
                          <NavLink
                            to={item.path}
                            className="flex items-center gap-2 w-full"
                            activeClassName=""
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <span className="truncate">{item.label}</span>
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
