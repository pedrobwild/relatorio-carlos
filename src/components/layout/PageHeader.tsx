import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { useProjectLayout } from "@/components/layout/ProjectLayoutContext";
import bwildLogo from "@/assets/bwild-logo-dark.png";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  backTo?: string;
  onBack?: () => void;
  children?: React.ReactNode;
  className?: string;
  maxWidth?: "md" | "lg" | "xl" | "full";
  showLogo?: boolean;
  breadcrumbs?: BreadcrumbItem[];
}

const maxWidthMap = {
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
};

export function PageHeader({
  title,
  backTo,
  onBack,
  children,
  className,
  maxWidth = "lg",
  showLogo = true,
  breadcrumbs,
}: PageHeaderProps) {
  const { hasShell } = useProjectLayout();
  const BackWrapper = backTo ? Link : ("div" as React.ElementType);
  const backProps = backTo ? { to: backTo } : {};

  // When inside ProjectShell (staff sidebar), render simplified inline header
  if (hasShell) {
    return (
      <div
        className={cn(
          "px-4 sm:px-6 md:px-8 py-4 border-b border-border",
          className,
        )}
      >
        <div className={cn("mx-auto", maxWidthMap[maxWidth])}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-xs text-muted-foreground mb-1"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  )}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-page-title truncate">{title}</h1>
            {children && (
              <div className="flex items-center gap-2 shrink-0">{children}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm",
        className,
      )}
    >
      {/* ── Desktop: single row ── */}
      <div
        className={cn(
          "mx-auto px-4 sm:px-6 md:px-8 py-3 hidden sm:flex items-center justify-between gap-3",
          maxWidthMap[maxWidth],
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {(backTo || onBack) && (
            <BackWrapper {...backProps}>
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="shrink-0 h-9 w-9 rounded-full hover:bg-primary/10"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </BackWrapper>
          )}
          {showLogo && (
            <>
              <img
                src={bwildLogo}
                alt="Bwild"
                className="h-8 w-auto shrink-0"
              />
              <span className="text-muted-foreground/40 shrink-0">|</span>
            </>
          )}
          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 overflow-hidden"
              >
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                    )}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="hover:text-foreground transition-colors truncate max-w-[120px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate max-w-[120px]">
                        {crumb.label}
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-page-title truncate">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {children}
          <UserMenu />
        </div>
      </div>

      {/* ── Mobile: two-row layout ── */}
      <div
        className={cn(
          "mx-auto px-3 py-2 sm:hidden space-y-1.5 pl-safe pr-safe",
          maxWidthMap[maxWidth],
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {(backTo || onBack) && (
              <BackWrapper {...backProps}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onBack}
                  className="shrink-0 h-11 w-11 rounded-full hover:bg-primary/10 active:bg-primary/15 active:scale-[0.94] transition-transform"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </BackWrapper>
            )}
            {showLogo && (
              <img
                src={bwildLogo}
                alt="Bwild"
                className="h-6 w-auto shrink-0"
              />
            )}
          </div>
          <div className="flex items-center gap-1 min-w-0 shrink">
            {children && (
              <div className="min-w-0 flex items-center gap-1">{children}</div>
            )}
            <UserMenu />
          </div>
        </div>
        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-[11px] text-muted-foreground mb-0.5 overflow-x-auto scrollbar-hide"
            >
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                  )}
                  {crumb.href ? (
                    <Link
                      to={crumb.href}
                      className="hover:text-foreground transition-colors truncate max-w-[140px]"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="truncate max-w-[140px]">
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-[18px] font-bold text-foreground leading-tight truncate">
            {title}
          </h1>
        </div>
      </div>
    </div>
  );
}
