import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { Map, DollarSign, AlertCircle, Bell, GanttChartSquare, Ruler } from "lucide-react";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useNotifications } from "@/hooks/useNotifications";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MobileNotificationsSheet } from "./MobileNotificationsSheet";

/**
 * MobileBottomNav — fixed bottom navigation for mobile users.
 * Shows role-appropriate tabs:
 * - Client: Jornada, Financeiro, Pendências, Avisos (opens notification sheet)
 * - Staff: Pendências, Cronograma, Executivo, Financeiro, + Mais (sheet)
 * Only rendered on mobile viewports.
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();
  const { isStaff } = useUserRole();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const criticalPendencias = stats.overdueCount + stats.urgentCount;

  const navItems = useMemo(() => {
    if (isStaff) {
      return [
        { label: "Pendências", icon: AlertCircle, to: paths.pendencias, badge: criticalPendencias },
        { label: "Cronograma", icon: GanttChartSquare, to: paths.cronograma, badge: 0 },
        { label: "Executivo", icon: Ruler, to: paths.executivo, badge: 0 },
        { label: "Financeiro", icon: DollarSign, to: paths.financeiro, badge: 0 },
      ];
    }
    return [
      { label: "Jornada", icon: Map, to: paths.jornada, badge: 0 },
      { label: "Financeiro", icon: DollarSign, to: paths.financeiro, badge: 0 },
      { label: "Pendências", icon: AlertCircle, to: paths.pendencias, badge: criticalPendencias },
    ];
  }, [isStaff, paths, criticalPendencias]);

  // Enable swipe between the navigable tabs
  const swipeRoutes = useMemo(
    () => navItems.map((i) => i.to),
    [navItems]
  );

  useSwipeNavigation(swipeRoutes);

  return (
    <>
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
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center" aria-label={`${item.badge} pendências`}>
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}

          {/* Client: Notifications button (opens sheet) */}
          {!isStaff && (
            <button
              onClick={() => setNotificationsOpen(true)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 text-[10px] font-medium transition-colors active:scale-[0.95]",
                notificationsOpen ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center" aria-label={`${unreadCount} notificações não lidas`}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="truncate">Avisos</span>
            </button>
          )}

          {/* Staff: More sheet */}
          {isStaff && <MobileMoreSheet />}
        </div>
      </nav>

      {/* Notifications sheet (client only) */}
      {!isStaff && (
        <MobileNotificationsSheet
          open={notificationsOpen}
          onOpenChange={setNotificationsOpen}
        />
      )}
    </>
  );
}
