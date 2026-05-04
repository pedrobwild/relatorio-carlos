import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  /** Max visible lines before truncation (default 4) */
  lines?: number;
  children: React.ReactNode;
  className?: string;
  /** Label for expand button */
  expandLabel?: string;
  /** Label for collapse button */
  collapseLabel?: string;
}

/**
 * Clamps children to N lines on mobile with a "Ler mais" toggle.
 * On ≥md screens, shows full content by default.
 */
export function ExpandableText({
  lines = 4,
  children,
  className,
  expandLabel = "Ler mais",
  collapseLabel = "Ler menos",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsClamp, setNeedsClamp] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const check = () => {
      // lineHeight * lines = threshold
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      const threshold = lineHeight * lines + 4; // +4 tolerance
      setNeedsClamp(el.scrollHeight > threshold);
    };

    check();
    // Re-check on resize (font may change)
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lines, children]);

  const clampClass =
    !expanded && needsClamp ? "line-clamp-[var(--clamp-lines)]" : "";

  return (
    <div className={cn("relative", className)}>
      <div
        ref={contentRef}
        className={cn(clampClass, "md:line-clamp-none")}
        style={{ "--clamp-lines": lines } as React.CSSProperties}
      >
        {children}
      </div>

      {needsClamp && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 h-8 px-2 text-xs text-primary hover:text-primary/80 gap-1 md:hidden"
        >
          {expanded ? collapseLabel : expandLabel}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </Button>
      )}
    </div>
  );
}
