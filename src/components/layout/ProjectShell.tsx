import { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { ProjectSlimHeader } from "@/components/layout/ProjectSlimHeader";
import { ProjectLayoutProvider } from "@/components/layout/ProjectLayoutContext";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { FloatingApprovalBanner } from "@/components/pendencias/FloatingApprovalBanner";
import { useUserRole } from "@/hooks/useUserRole";

interface ProjectShellProps {
  children: ReactNode;
}

/**
 * ProjectShell — wraps all project pages.
 * For staff: renders sidebar + slim header + content.
 * For clients: renders children directly (no sidebar).
 */
export function ProjectShell({ children }: ProjectShellProps) {
  const { isStaff, loading } = useUserRole();
  const { projectId } = useParams();

  // While loading, don't render shell to avoid layout flash
  if (loading) {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        {children}
      </ProjectLayoutProvider>
    );
  }

  // Clients get the existing experience + mobile bottom nav + floating approval banner
  if (!isStaff) {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        {children}
        <MobileBottomNav />
        <FloatingApprovalBanner projectId={projectId} />
      </ProjectLayoutProvider>
    );
  }

  // Staff gets sidebar + slim header
  return (
    <ProjectLayoutProvider value={{ hasShell: true }}>
      <SidebarProvider>
        <div className="min-h-[100dvh] flex w-full">
          <TooltipProvider>
            <ProjectSidebar />
          </TooltipProvider>
          <div className="flex-1 flex flex-col min-w-0">
            <ProjectSlimHeader />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </SidebarProvider>
      <FloatingApprovalBanner projectId={projectId} />
    </ProjectLayoutProvider>
  );
}
