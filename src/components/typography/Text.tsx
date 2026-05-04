/**
 * Text — Componente de tipografia para corpo, legendas e meta.
 *
 * Encapsula a escala definida em `src/index.css`:
 *  - variant="body"    → text-body    (14/15px)
 *  - variant="caption" → text-caption (13/14px, muted)
 *  - variant="meta"    → text-meta    (11/12px, muted)
 *
 * Bloco 3 (Design System): substitui usos soltos de `text-sm/text-xs/text-base`
 * onde a intenção é semântica (corpo de parágrafo, legenda, timestamp).
 */
import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type TextVariant = 'body' | 'caption' | 'meta';

const variantClass: Record<TextVariant, string> = {
  body: 'text-body',
  caption: 'text-caption',
  meta: 'text-meta',
};

interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  as?: ElementType;
  children: ReactNode;
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { variant = 'body', as = 'p', className, children, ...rest },
  ref,
) {
  const Tag = as as ElementType;
  return (
    <Tag ref={ref} className={cn(variantClass[variant], className)} {...rest}>
      {children}
    </Tag>
  );
});
