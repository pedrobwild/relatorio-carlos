import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { Map, DollarSign, AlertCircle, Bell } from "lucide-react";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useNotifications } from "@/hooks/useNotifications";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { cn } from "@/lib/utils";

/**
 * MobileBottomNav — fixed bottom navigation for mobile client users.
 * Shows 4 primary actions with ergonomic thumb-zone positioning.
 * Supports horizontal swipe gestures to navigate between tabs.
 * Only rendered for non-staff (client) users on mobile viewports.
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();

  const criticalPendencias = stats.overdueCount + stats.urgentCount;

  const navItems = [
    { label: "Jornada", icon: Map, to: paths.jornada, badge: 0 },
    { label: "Financeiro", icon: DollarSign, to: paths.financeiro, badge: 0 },
    { label: "Pendências", icon: AlertCircle, to: paths.pendencias, badge: criticalPendencias },
    { label: "Avisos", icon: Bell, to: "#notifications", badge: unreadCount },
  ];

  // Enable swipe between the navigable tabs (exclude #notifications)
  const swipeRoutes = useMemo(
    () => navItems.filter((i) => !i.to.startsWith("#")).map((i) => i.to),
    [paths]
  );

  useSwipeNavigation(swipeRoutes);

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur-md pb-safe md:hidden"
      aria-label="Navegação principal"
    >
      <div className="flex items-stretch justify-around h-14">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors",
                "active:scale-[0.95]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )
            }
          >
            <span className="relative">
              <item.icon className="h-5 w-5" />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </span>
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
