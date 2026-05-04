import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * ResponsiveTabs — wrapper sobre Radix Tabs com lista rolável
 * horizontalmente (sem barra visível) no mobile, evitando que abas com
 * label longo estourem ou quebrem em duas linhas.
 *
 * - Toque confortável: cada trigger tem min-height 44px.
 * - No desktop, comporta-se como uma TabsList tradicional.
 * - Indicador é um underline sob a aba ativa (mobile-first), e cresce
 *   para um pill de contraste no desktop. Mantém compatibilidade visual
 *   com a TabsList do design system existente.
 */

export const Tabs = TabsPrimitive.Root;

interface ResponsiveTabsListProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> {
  ariaLabel?: string;
}

export const ResponsiveTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  ResponsiveTabsListProps
>(({ className, ariaLabel, ...props }, ref) => (
  <div
    role="presentation"
    className={cn(
      "relative w-full overflow-x-auto scrollbar-hide",
      "border-b border-border-subtle",
    )}
  >
    <TabsPrimitive.List
      ref={ref}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-w-full items-stretch gap-1 px-1",
        // No desktop, recolhe em pill como o componente original.
        "md:rounded-md md:bg-muted md:p-1 md:border-0 md:gap-0",
        className,
      )}
      {...props}
    />
  </div>
));
ResponsiveTabsList.displayName = "ResponsiveTabsList";

export const ResponsiveTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
      "px-3 py-2 min-h-[44px] text-[13px] font-medium",
      "text-muted-foreground transition-colors",
      "hover:text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      "disabled:pointer-events-none disabled:opacity-50",
      // Mobile: underline ativo
      "data-[state=active]:text-foreground",
      "after:absolute after:left-2 after:right-2 after:bottom-0 after:h-[2px] after:rounded-full",
      "after:bg-transparent data-[state=active]:after:bg-primary",
      // Desktop: pill ativo (visual original)
      "md:rounded-sm md:px-3 md:py-1.5 md:min-h-0 md:after:hidden md:text-sm",
      "md:data-[state=active]:bg-background md:data-[state=active]:text-foreground md:data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
ResponsiveTabsTrigger.displayName = "ResponsiveTabsTrigger";

export const TabsContent = TabsPrimitive.Content;
