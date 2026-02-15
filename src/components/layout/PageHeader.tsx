import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import bwildLogo from "@/assets/bwild-logo.png";

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
  /** Max width of the inner content */
  maxWidth?: "md" | "lg" | "xl" | "full";
  /** Show Bwild logo */
  showLogo?: boolean;
  /** Breadcrumb trail — array of { label, href? } */
  breadcrumbs?: BreadcrumbItem[];
}

const maxWidthMap = {
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
};

/**
 * PageHeader — sticky header with consistent layout across all sub-pages.
 * Includes back button, optional breadcrumb, logo, title, and right-side actions.
 */
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
  const BackWrapper = backTo ? Link : "div";
  const backProps = backTo ? { to: backTo } : {};

  return (
    <div
      className={cn(
        "sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm",
        className
      )}
    >
      <div className={cn("mx-auto px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between gap-3", maxWidthMap[maxWidth])}>
        <div className="flex items-center gap-3 min-w-0">
          {(backTo || onBack) && (
            <BackWrapper {...(backProps as any)}>
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
              <img src={bwildLogo} alt="Bwild" className="h-6 w-auto shrink-0" />
              <span className="text-muted-foreground/40 shrink-0">|</span>
            </>
          )}
          <div className="min-w-0">
            {breadcrumbs && breadcrumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5 overflow-hidden">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="hover:text-foreground transition-colors truncate max-w-[120px]"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate max-w-[120px]">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-page-title truncate">{title}</h1>
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2 shrink-0">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
