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
 * AppShell — unified layout entry point.
 *
 * Internally delegates to the correct shell based on `variant`:
 * - `project`   → ProjectShell (staff sidebar+slim header / client slim+banner)
 * - `portfolio` → GestaoShell (staff sidebar + bottom nav)
 * - `public`    → legacy AppHeader (auth, recovery, signature pages)
 *
 * Pages should never decide which header/sidebar to render — they only
 * declare the variant via their route wrapper in App.tsx.
 */
export function AppShell({ variant, children }: AppShellProps) {
  if (variant === "portfolio") {
    return <GestaoShell>{children}</GestaoShell>;
  }

  if (variant === "public") {
    return (
      <>
        <AppHeader />
        {children}
      </>
    );
  }

  return <ProjectShell>{children}</ProjectShell>;
}
