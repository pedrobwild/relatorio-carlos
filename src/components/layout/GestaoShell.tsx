import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestaoSidebar } from "@/components/layout/GestaoSidebar";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";
import { AssistantFab } from "@/components/assistant/AssistantFab";

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
      <div className="min-h-screen flex w-full surface-canvas">
        <GestaoSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile/tablet header — slim */}
          <header className="h-12 border-b border-border-subtle surface-glass flex items-center px-3 gap-2 shrink-0 z-40 md:hidden">
            <SidebarTrigger className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]" />
            <span className="text-sm font-bold text-foreground truncate flex-1">
              Gestão
            </span>
            <GlobalSearchDialog />
            <NotificationBell />
            <UserMenu />
          </header>

          {/* Desktop header — premium, sticky, blur */}
          <header className="hidden md:flex h-[60px] border-b border-border-subtle surface-glass items-center px-6 gap-3 shrink-0 sticky top-0 z-40">
            <SidebarTrigger className="shrink-0 h-9 w-9" />
            <div className="h-5 w-px bg-border-subtle" aria-hidden />
            <div className="flex-1 max-w-md">
              <GlobalSearchDialog />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <div className="h-5 w-px bg-border-subtle mx-1" aria-hidden />
              <UserMenu />
            </div>
          </header>

          <main id="main-content" className="pb-bottom-nav">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <AssistantFab />
    </SidebarProvider>
  );
}
