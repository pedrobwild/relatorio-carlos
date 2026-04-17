import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestaoSidebar } from "@/components/layout/GestaoSidebar";
import { GestaoBottomNav } from "@/components/mobile/GestaoBottomNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";

interface GestaoShellProps {
  children: ReactNode;
}

/**
 * GestaoShell — layout wrapper for all /gestao routes.
 * Renders a sidebar with management tools + the page content.
 * On mobile, renders a slim header with sidebar trigger + bottom nav.
 */
export function GestaoShell({ children }: GestaoShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <GestaoSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile/tablet header with sidebar trigger */}
          <header className="h-12 border-b border-border bg-card/95 backdrop-blur-sm flex items-center px-3 gap-2 shrink-0 z-40 md:hidden">
            <SidebarTrigger className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]" />
            <span className="text-sm font-bold text-foreground truncate flex-1">Gestão</span>
            <GlobalSearchDialog />
            <NotificationBell />
            <UserMenu />
          </header>
          <div className="pb-bottom-nav">{children}</div>
        </div>
      </div>
      <GestaoBottomNav />
    </SidebarProvider>
  );
}
