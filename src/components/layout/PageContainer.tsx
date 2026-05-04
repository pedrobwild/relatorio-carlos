import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Max width variant */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Remove default padding */
  noPadding?: boolean;
}

const maxWidthMap = {
  sm: "max-w-2xl", // 672px - compact lists (MinhasObras)
  md: "max-w-4xl", // 896px - forms (Cronograma)
  lg: "max-w-5xl", // 1024px - standard pages
  xl: "max-w-6xl", // 1152px - wide pages (Pendencias, Formalizacoes)
  full: "max-w-7xl", // 1280px - full-width (Compras)
};

/**
 * PageContainer — standard wrapper for all pages.
 * Provides consistent max-width, centering, and responsive padding (8pt grid).
 *
 * Gutters: 16px mobile / 24px tablet / 32px desktop
 */
export function PageContainer({
  children,
  className,
  maxWidth = "lg",
  noPadding = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full overflow-x-hidden",
        maxWidthMap[maxWidth],
        !noPadding && "px-4 sm:px-6 md:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ReadingContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ReadingContainer — for long-form text content (reports, descriptions).
 * Max width 720–840px with comfortable line-height for readability.
 */
export function ReadingContainer({
  children,
  className,
}: ReadingContainerProps) {
  return (
    <div
      className={cn(
        "max-w-[780px] mx-auto",
        "[&_p]:leading-relaxed [&_li]:leading-relaxed",
        "[&>*+*]:mt-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
