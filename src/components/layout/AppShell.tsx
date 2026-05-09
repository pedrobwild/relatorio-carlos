import { ReactNode } from "react";
import { ProjectShell } from "@/components/layout/ProjectShell";
import { GestaoShell } from "@/components/layout/GestaoShell";
import { AppHeader } from "@/components/AppHeader";

export type AppShellVariant = "project" | "portfolio" | "public";

interface AppShellProps {
  variant: AppShellVariant;
  children: ReactNode;
}

/**
 * AppShell — single entry point for application chrome.
 *
 * - `project`: routes under `/obra/:projectId/*`. Renders sidebar + slim header
 *   for staff or mobile header + bottom nav for clients (delegates to ProjectShell).
 * - `portfolio`: staff routes under `/gestao/*`. Renders GestaoSidebar + bottom
 *   nav (delegates to GestaoShell).
 * - `public`: surfaces visible to unauthenticated users (e.g. `/auth`,
 *   `/recuperar-senha`). Renders the legacy AppHeader.
 */
export function AppShell({ variant, children }: AppShellProps) {
  if (variant === "project") {
    return <ProjectShell>{children}</ProjectShell>;
  }
  if (variant === "portfolio") {
    return <GestaoShell>{children}</GestaoShell>;
  }
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
