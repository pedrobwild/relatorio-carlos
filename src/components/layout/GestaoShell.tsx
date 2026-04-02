import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { GestaoSidebar } from "@/components/layout/GestaoSidebar";
import { AppHeader } from "@/components/AppHeader";

interface GestaoShellProps {
  children: ReactNode;
}

/**
 * GestaoShell — layout wrapper for all /gestao routes.
 * Renders a sidebar with management tools + the page content.
 */
export function GestaoShell({ children }: GestaoShellProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <GestaoSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
