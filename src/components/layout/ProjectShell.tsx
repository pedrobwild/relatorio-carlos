import { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { ProjectSlimHeader } from "@/components/layout/ProjectSlimHeader";
import { ProjectMobileHeader } from "@/components/layout/ProjectMobileHeader";
import { ProjectLayoutProvider } from "@/components/layout/ProjectLayoutContext";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { FloatingApprovalBanner } from "@/components/pendencias/FloatingApprovalBanner";
import { useUserRole } from "@/hooks/useUserRole";
import { useProject } from "@/contexts/ProjectContext";
import { Skeleton } from "@/components/ui/skeleton";

function ProjectSwitchOverlay() {
  return (
    <div className="absolute inset-0 z-30 bg-background/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-4 w-full max-w-md px-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded" />
        <div className="w-full space-y-3 mt-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

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
  const { loading: projectLoading, project } = useProject();

  // Show transition overlay when switching projects (project cleared but loading new one)
  const isSwitching = projectLoading && !project && !!projectId;

  // While loading role, don't render shell to avoid layout flash
  if (loading) {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        {children}
      </ProjectLayoutProvider>
    );
  }

  // Clients get the existing experience + mobile bottom nav + floating approval banner.
  // On mobile, also render a slim project header so they can switch between obras.
  if (!isStaff) {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        <div className="relative min-h-[100dvh]">
          <ProjectMobileHeader />
          {isSwitching && <ProjectSwitchOverlay />}
          <div className="pb-bottom-nav">{children}</div>
        </div>
        <MobileBottomNav />
        <FloatingApprovalBanner projectId={projectId} />
      </ProjectLayoutProvider>
    );
  }

  // Staff gets sidebar + slim header (desktop) / mobile header + mobile bottom nav
  return (
    <ProjectLayoutProvider value={{ hasShell: true }}>
      <SidebarProvider>
        <div className="min-h-[100dvh] flex w-full">
          <TooltipProvider>
            <ProjectSidebar />
          </TooltipProvider>
          <div className="flex-1 flex flex-col min-w-0 relative">
            <ProjectMobileHeader />
            <ProjectSlimHeader />
            {isSwitching && <ProjectSwitchOverlay />}
            <main className="flex-1 overflow-y-auto pb-bottom-nav">{children}</main>
          </div>
        </div>
      </SidebarProvider>
      <MobileBottomNav />
      <FloatingApprovalBanner projectId={projectId} />
    </ProjectLayoutProvider>
  );
}
