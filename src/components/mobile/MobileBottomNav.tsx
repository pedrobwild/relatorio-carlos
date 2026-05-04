import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useProjectNavigation } from "@/hooks/useProjectNavigation";
import { usePendencias } from "@/hooks/usePendencias";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import {
  CLIENT_NAV,
  STAFF_NAV,
  PROFILE_SLOT,
  type MobileNavSlot,
} from "@/config/mobileNav";
import { MobileProfileSheet } from "./MobileProfileSheet";

/**
 * Universal mobile bottom navigation — 4 tabs + Profile.
 *
 * Renders the same shape for cliente and staff; the contents are driven by
 * `src/config/mobileNav.ts`. The fifth slot is always the profile sheet
 * (never a "more tools" catalog).
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();
  const { isStaff } = useUserRole();
  const [profileOpen, setProfileOpen] = useState(false);

  const criticalPendencias = stats.overdueCount + stats.urgentCount;
  const hasProject = !!projectId;

  const navItems = useMemo<MobileNavSlot[]>(
    () => (isStaff ? STAFF_NAV : CLIENT_NAV),
    [isStaff],
  );

  const resolveBadge = (slot: MobileNavSlot): number => {
    if (slot.badge === "criticalPendencias") return criticalPendencias;
    if (slot.badge === "unreadNotifications") return unreadCount;
    return 0;
  };

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
          {navItems.map((slot) => {
            const to = slot.to({ paths, hasProject });
            const badge = resolveBadge(slot);
            const Icon = slot.icon;
            return (
              <NavLink
                key={slot.id}
                to={to}
                end={slot.id === "inicio"}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5",
                    "min-h-[56px] transition-all active:scale-[0.94]",
                    "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
                    isActive ? "text-primary" : "text-foreground-muted",
                  )
                }
                aria-label={
                  badge > 0 ? `${slot.label} — ${badge} críticas` : slot.label
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
                        isActive ? "bg-primary/12" : "bg-transparent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[22px] w-[22px] transition-colors",
                          isActive ? "text-primary" : "text-foreground-muted",
                        )}
                        strokeWidth={isActive ? 2.25 : 2}
                      />
                      {badge > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                          aria-hidden="true"
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] leading-none truncate max-w-full",
                        isActive ? "font-semibold text-primary" : "font-medium",
                      )}
                    >
                      {slot.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Profile slot — opens sheet, never navigates */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1.5",
              "min-h-[56px] transition-all active:scale-[0.94]",
              "focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary rounded-lg",
              profileOpen ? "text-primary" : "text-foreground-muted",
            )}
            aria-label={
              unreadCount > 0
                ? `${PROFILE_SLOT.label} — ${unreadCount} avisos não lidos`
                : PROFILE_SLOT.label
            }
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
          >
            {profileOpen && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                "relative flex items-center justify-center w-11 h-7 rounded-full transition-all duration-200",
                profileOpen ? "bg-primary/12" : "bg-transparent",
              )}
            >
              <PROFILE_SLOT.icon
                className={cn(
                  "h-[22px] w-[22px] transition-colors",
                  profileOpen ? "text-primary" : "text-foreground-muted",
                )}
                strokeWidth={profileOpen ? 2.25 : 2}
              />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card"
                  aria-hidden="true"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <span
              className={cn(
                "text-[11px] leading-none truncate max-w-full",
                profileOpen ? "font-semibold text-primary" : "font-medium",
              )}
            >
              {PROFILE_SLOT.label}
            </span>
          </button>
        </div>
      </nav>

      <MobileProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
