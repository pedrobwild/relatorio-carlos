import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Map,
  DollarSign,
  AlertCircle,
  Bell,
  GanttChartSquare,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useNotifications } from "@/hooks/useNotifications";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useHiddenSectionsBadge } from "@/hooks/useHiddenSectionsBadge";
import { cn } from "@/lib/utils";
import { MobileMoreSheet } from "./MobileMoreSheet";
import { MobileNotificationsSheet } from "./MobileNotificationsSheet";

/**
 * MobileBottomNav — fixed bottom navigation for mobile users.
 *
 * UX guarantees:
 * - 44×44px minimum touch target per tab (WCAG 2.5.5).
 * - Pill-style active state with high-contrast color (matches GestaoBottomNav).
 * - Truncated labels remain legible at 11px / weight 600 with explicit foreground tone.
 * - Keyboard-aware: hides itself when an input is focused on mobile so the
 *   on-screen keyboard never overlaps form fields.
 * - Tap feedback via active:scale.
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();
  const { isStaff } = useUserRole();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const criticalPendencias = stats.overdueCount + stats.urgentCount;

  const navItems = useMemo<
    Array<{ label: string; icon: LucideIcon; to: string; badge: number }>
  >(() => {
    if (isStaff) {
      return [
        { label: "Pendências", icon: AlertCircle, to: paths.pendencias, badge: criticalPendencias },
        { label: "Cronograma", icon: GanttChartSquare, to: paths.cronograma, badge: 0 },
        { label: "Atividades", icon: CheckSquare, to: paths.atividades, badge: 0 },
        { label: "Financeiro", icon: DollarSign, to: paths.financeiro, badge: 0 },
      ];
    }
    return [
      { label: "Jornada", icon: Map, to: paths.jornada, badge: 0 },
      { label: "Financeiro", icon: DollarSign, to: paths.financeiro, badge: 0 },
      { label: "Pendências", icon: AlertCircle, to: paths.pendencias, badge: criticalPendencias },
    ];
  }, [isStaff, paths, criticalPendencias]);

  const swipeRoutes = useMemo(() => navItems.map((i) => i.to), [navItems]);
  useSwipeNavigation(swipeRoutes);

  // Sum of pending counts in sections NOT shown in the main bar — surfaces in "Mais".
  const hiddenSectionsBadge = useHiddenSectionsBadge(swipeRoutes);

  return (
    <>
      <nav
        className={cn(
          "fixed bottom-0 inset-x-0 z-shell md:hidden",
          "border-t border-border-subtle bg-card/95 backdrop-blur-xl backdrop-saturate-150",
          "pb-safe pl-safe pr-safe",
          "hide-on-keyboard",
        )}
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-around h-16 px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5",
                  "min-h-[56px] transition-all active:scale-[0.94]",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
                  isActive ? "text-primary" : "text-foreground-muted",
                )
              }
              aria-label={item.badge > 0 ? `${item.label} — ${item.badge} críticas` : item.label}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
                      isActive ? "bg-primary/12" : "bg-transparent",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[22px] w-[22px] transition-colors",
                        isActive ? "text-primary" : "text-foreground-muted",
                      )}
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                    {item.badge > 0 && (
                      <span
                        className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                        aria-hidden="true"
                      >
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-none truncate max-w-full",
                      isActive ? "font-semibold text-primary" : "font-medium",
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* Client: Notifications button */}
          {!isStaff && (
            <button
              type="button"
              onClick={() => setNotificationsOpen(true)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5",
                "min-h-[56px] transition-all active:scale-[0.94]",
                "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
                notificationsOpen ? "text-primary" : "text-foreground-muted",
              )}
              aria-label={unreadCount > 0 ? `Avisos — ${unreadCount} não lidas` : "Avisos"}
              aria-haspopup="dialog"
              aria-expanded={notificationsOpen}
            >
              <span
                className={cn(
                  "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
                  notificationsOpen ? "bg-primary/12" : "bg-transparent",
                )}
              >
                <Bell
                  className={cn(
                    "h-[22px] w-[22px] transition-colors",
                    notificationsOpen ? "text-primary" : "text-foreground-muted",
                  )}
                  strokeWidth={notificationsOpen ? 2.25 : 2}
                />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                    aria-hidden="true"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] leading-none truncate max-w-full",
                  notificationsOpen ? "font-semibold text-primary" : "font-medium",
                )}
              >
                Avisos
              </span>
            </button>
          )}

          {/* Staff: More sheet with ALL tools */}
          {isStaff && <MobileMoreSheet badgeCount={hiddenSectionsBadge} />}
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
