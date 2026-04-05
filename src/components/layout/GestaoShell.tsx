import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestaoSidebar } from "@/components/layout/GestaoSidebar";
import { AppHeader } from "@/components/AppHeader";
import { GestaoBottomNav } from "@/components/mobile/GestaoBottomNav";

interface GestaoShellProps {
  children: ReactNode;
}

/**
 * GestaoShell — layout wrapper for all /gestao routes.
 * Renders a sidebar with management tools + the page content.
 * On mobile, renders a bottom nav with FAB for quick access.
 */
export function GestaoShell({ children }: GestaoShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <GestaoSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <div className="pb-bottom-nav">{children}</div>
        </div>
      </div>
      <GestaoBottomNav />
    </SidebarProvider>
  );
}
