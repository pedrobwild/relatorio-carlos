import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObraBreadcrumbs } from "@/hooks/useObraBreadcrumbs";

interface ShellBreadcrumbsProps {
  className?: string;
}

/**
 * ShellBreadcrumbs — auto-rendered breadcrumb strip for AppShell.
 *
 * Pulls the trail from `useObraBreadcrumbs` (URL-derived). Renders nothing for
 * routes that have no breadcrumb (e.g. `/auth`, `/`).
 *
 * The strip sits between the slim header and the main content, so it's
 * present on 100% of `/obra/:id/*` and `/gestao/*` pages without each page
 * having to re-declare its breadcrumbs.
 */
export function ShellBreadcrumbs({ className }: ShellBreadcrumbsProps) {
  const breadcrumbs = useObraBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 px-3 sm:px-4 md:px-6 py-1.5 text-xs text-muted-foreground",
        "border-b border-border-subtle bg-background/60 backdrop-blur-sm overflow-x-auto scrollbar-hide",
        className,
      )}
    >
      {breadcrumbs.map((crumb, i) => (
        <span key={`${i}-${crumb.label}`} className="flex items-center gap-1 shrink-0">
          {i > 0 && (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden />
          )}
          {crumb.href ? (
            <Link
              to={crumb.href}
              className="hover:text-foreground transition-colors truncate max-w-[180px]"
            >
              {crumb.label}
            </Link>
          ) : (
            <span
              className="text-foreground font-medium truncate max-w-[200px]"
              aria-current="page"
            >
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
