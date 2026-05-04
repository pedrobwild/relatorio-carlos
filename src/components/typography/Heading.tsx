/**
 * Heading — Componente de tipografia hierárquica do design system.
 *
 * Encapsula a escala definida em `src/index.css`:
 *  - level="page"    → text-page-title (16/18px, semibold-bold)
 *  - level="section" → text-section-title (16/18px, semibold)
 *  - level="card"    → text-card-label   (14/15px, semibold)
 *  - level="value"   → text-card-value   (20/24px, bold tabular)
 *
 * Substitui ad-hoc `text-h1/h2/h3` e `text-3xl/4xl/5xl` espalhados pelo
 * código. Para tamanhos de hero/landing além da escala, use `level="page"`
 * com `as="h1"` — a escala é intencionalmente conservadora.
 *
 * Bloco 3 (Design System): única fonte de verdade para títulos.
 */
import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type HeadingLevel = 'page' | 'section' | 'card' | 'value';

const levelClass: Record<HeadingLevel, string> = {
  page: 'text-page-title',
  section: 'text-section-title',
  card: 'text-card-label',
  value: 'text-card-value',
};

const defaultTagByLevel: Record<HeadingLevel, ElementType> = {
  page: 'h1',
  section: 'h2',
  card: 'h3',
  value: 'p',
};

interface HeadingProps extends HTMLAttributes<HTMLElement> {
  level?: HeadingLevel;
  as?: ElementType;
  children: ReactNode;
}

export const Heading = forwardRef<HTMLElement, HeadingProps>(function Heading(
  { level = 'section', as, className, children, ...rest },
  ref,
) {
  const Tag = (as ?? defaultTagByLevel[level]) as ElementType;
  return (
    <Tag ref={ref} className={cn(levelClass[level], className)} {...rest}>
      {children}
    </Tag>
  );
});
