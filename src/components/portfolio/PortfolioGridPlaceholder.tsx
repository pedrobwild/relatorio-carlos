import { ReactNode } from 'react';

interface PortfolioGridPlaceholderProps {
  children: ReactNode;
}

/**
 * Container wrapper for the main project grid/list/table.
 * Provides consistent spacing and an empty-state fallback zone.
 */
export function PortfolioGridPlaceholder({ children }: PortfolioGridPlaceholderProps) {
  return (
    <section className="min-h-[400px]" aria-label="Lista de obras">
      {children}
    </section>
  );
}
