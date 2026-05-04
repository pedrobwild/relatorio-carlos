import { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { ProjectSlimHeader } from "@/components/layout/ProjectSlimHeader";
import { ProjectMobileHeader } from "@/components/layout/ProjectMobileHeader";
import { ProjectLayoutProvider } from "@/components/layout/ProjectLayoutContext";
import { ShellBreadcrumbs } from "@/components/layout/ShellBreadcrumbs";
import { GestaoSidebar } from "@/components/layout/GestaoSidebar";
import { UserMenu } from "@/components/layout/UserMenu";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";
import { GestaoBottomNav } from "@/components/mobile/GestaoBottomNav";
import { FloatingApprovalBanner } from "@/components/pendencias/FloatingApprovalBanner";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchDialog } from "@/components/search/GlobalSearchDialog";
import { AssistantFab } from "@/components/assistant/AssistantFab";
import { useUserRole } from "@/hooks/useUserRole";
import { useProject } from "@/contexts/ProjectContext";

export type AppShellVariant = "project" | "portfolio" | "public";

interface AppShellProps {
  variant: AppShellVariant;
  children: ReactNode;
}

/**
 * AppShell — single layout wrapper that decides which chrome to render based on
 * variant + the current user role:
 *
 *   - `project`  + staff:    ProjectSidebar + ProjectSlimHeader + breadcrumb bar
 *                            + MobileBottomNav + FloatingApprovalBanner
 *   - `project`  + client:   ProjectMobileHeader + breadcrumb bar
 *                            + MobileBottomNav + FloatingApprovalBanner
 *   - `portfolio`:           GestaoSidebar + slim portfolio header
 *                            + breadcrumb bar + GestaoBottomNav
 *   - `public`:              children only — public routes own their own header
 *
 * Pages should never render their own shell chrome; everything below the title
 * row goes inside `<main>`. Breadcrumbs are auto-derived from the URL via
 * `useObraBreadcrumbs` so every page in `/obra/:id/*` and `/gestao/*` shows one.
 */
export function AppShell({ variant, children }: AppShellProps) {
  if (variant === "public") {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        {children}
      </ProjectLayoutProvider>
    );
  }

  if (variant === "portfolio") {
    return <PortfolioShellInner>{children}</PortfolioShellInner>;
  }

  return <ProjectShellInner>{children}</ProjectShellInner>;
}

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

function ProjectShellInner({ children }: { children: ReactNode }) {
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

  // Clients: slim mobile header + content + bottom nav + floating approval banner.
  if (!isStaff) {
    return (
      <ProjectLayoutProvider value={{ hasShell: false }}>
        <div className="relative min-h-[100dvh]">
          <ProjectMobileHeader />
          <ShellBreadcrumbs />
          {isSwitching && <ProjectSwitchOverlay />}
          <div className="pb-bottom-nav">{children}</div>
        </div>
        <MobileBottomNav />
        <FloatingApprovalBanner projectId={projectId} />
      </ProjectLayoutProvider>
    );
  }

  // Staff: sidebar + slim header (desktop) / mobile header + breadcrumb bar + bottom nav.
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
            <ShellBreadcrumbs />
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

function PortfolioShellInner({ children }: { children: ReactNode }) {
  return (
    <ProjectLayoutProvider value={{ hasShell: true }}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full surface-canvas">
          <GestaoSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            {/* Mobile/tablet header — slim */}
            <header className="h-12 border-b border-border-subtle surface-glass flex items-center px-3 gap-2 shrink-0 z-40 md:hidden">
              <SidebarTrigger className="shrink-0 h-10 w-10 min-h-[44px] min-w-[44px]" />
              <span className="text-sm font-bold text-foreground truncate flex-1">Gestão</span>
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

            <ShellBreadcrumbs />

            <div className="pb-bottom-nav">{children}</div>
          </div>
        </div>
      </SidebarProvider>
      <GestaoBottomNav />
      <AssistantFab />
    </ProjectLayoutProvider>
  );
}
