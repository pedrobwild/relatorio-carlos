import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useProjectNavigation } from '@/hooks/useProjectNavigation';
import { usePendencias } from '@/hooks/usePendencias';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import {
  CLIENT_NAV,
  STAFF_NAV,
  PROFILE_SLOT,
  type MobileNavSlot,
} from '@/config/mobileNav';
import { MobileProfileSheet } from './MobileProfileSheet';
import { MobileNotificationsSheet } from './MobileNotificationsSheet';

/**
 * MobileBottomNav — universal mobile bottom navigation. Renders 4 role-aware
 * tabs plus a Profile slot. Used in both ProjectShell (client + project-scoped
 * staff) and GestaoShell (staff out-of-project).
 */
export function MobileBottomNav() {
  const { paths, projectId } = useProjectNavigation();
  const { stats } = usePendencias({ projectId });
  const { unreadCount } = useNotifications();
  const { isStaff } = useUserRole();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navItems = isStaff ? STAFF_NAV : CLIENT_NAV;
  const criticalPendencias = stats.overdueCount + stats.urgentCount;

  const resolvedItems = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        href: item.to(paths),
        badgeCount: resolveBadge(item, criticalPendencias, unreadCount),
      })),
    [navItems, paths, criticalPendencias, unreadCount]
  );

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-xl backdrop-saturate-150 pb-safe md:hidden"
        aria-label="Navegação principal"
      >
        <div className="flex items-stretch justify-around h-16">
          {resolvedItems.map((item) => (
            <NavTab
              key={item.id}
              item={item}
              isActive={isPathActive(location.pathname, item.href)}
            />
          ))}

          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 min-h-[48px] text-[11px] font-medium transition-colors',
              'active:scale-[0.95]',
              profileOpen ? 'text-primary' : 'text-muted-foreground'
            )}
            aria-label={PROFILE_SLOT.label}
            aria-expanded={profileOpen}
          >
            <span className="relative">
              <PROFILE_SLOT.icon className="h-5 w-5" aria-hidden="true" />
              {!isStaff && unreadCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
                  aria-label={`${unreadCount} notificações não lidas`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            <span className="truncate">{PROFILE_SLOT.label}</span>
          </button>
        </div>
      </nav>

      <MobileProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <MobileNotificationsSheet
        open={notificationsOpen}
        onOpenChange={setNotificationsOpen}
      />
    </>
  );
}

interface NavTabProps {
  item: MobileNavSlot & { href: string; badgeCount: number };
  isActive: boolean;
}

function NavTab({ item, isActive }: NavTabProps) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.href}
      end={item.id === 'inicio'}
      aria-label={item.label}
      className={() =>
        cn(
          'relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 min-h-[48px] text-[11px] font-medium transition-colors',
          'active:scale-[0.95]',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )
      }
    >
      {isActive && (
        <span
          className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
      <span className="relative">
        <Icon className="h-5 w-5" aria-hidden="true" />
        {item.badgeCount > 0 && (
          <span
            className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
            aria-label={`${item.badgeCount} pendências`}
          >
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>
        )}
      </span>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function resolveBadge(
  item: MobileNavSlot,
  criticalPendencias: number,
  unreadCount: number
): number {
  switch (item.badge) {
    case 'criticalPendencias':
      return criticalPendencias;
    case 'unreadNotifications':
      return unreadCount;
    case 'none':
    default:
      return 0;
  }
}

function isPathActive(currentPath: string, target: string): boolean {
  if (target === '/' || target === '/gestao') return currentPath === target;
  return currentPath === target || currentPath.startsWith(target + '/');
}
