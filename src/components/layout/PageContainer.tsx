import { cn } from "@/lib/utils";
import { ElementType, ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Max width variant */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full" | "screen";
  /** Remove default padding */
  noPadding?: boolean;
  /** Render as a different element (e.g. `main`, `section`). Defaults to `div`. */
  as?: ElementType;
}

const maxWidthMap = {
  sm: "max-w-2xl", // 672px - compact lists (MinhasObras)
  md: "max-w-4xl", // 896px - forms (Cronograma)
  lg: "max-w-5xl", // 1024px - standard pages
  xl: "max-w-6xl", // 1152px - wide pages (Pendencias, Formalizacoes)
  full: "max-w-7xl", // 1280px - full-width (Compras)
  screen: "max-w-none", // sem cap — usa toda a largura disponível (cockpits/tabelas densas)
};

/**
 * PageContainer — wrapper único de páginas (mobile + desktop).
 *
 * Centraliza gutters horizontais com `px-safe-4 sm:px-safe-6 md:px-8`
 * (16px mobile / 24px tablet / 32px desktop, sempre respeitando safe-area).
 * Todas as páginas devem usar este wrapper em vez de `max-w-* mx-auto px-4`
 * para garantir consistência visual e evitar texto colado nas bordas.
 */
export function PageContainer({
  children,
  className,
  maxWidth = "lg",
  noPadding = false,
  as,
  ...rest
}: PageContainerProps & React.HTMLAttributes<HTMLElement>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      className={cn(
        "mx-auto w-full overflow-x-hidden",
        maxWidthMap[maxWidth],
        !noPadding && "px-safe-4 sm:px-safe-6 md:px-8",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
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
