import { useReducedMotion } from "framer-motion";

/**
 * Wrapper sobre `useReducedMotion()` do framer-motion que **nunca retorna `null`**.
 *
 * - Em ambientes onde `matchMedia` está ausente (ex.: SSR antigo), framer pode
 *   devolver `null`. Aqui normalizamos para `false` (animação habilitada por
 *   padrão) e respeitamos `prefers-reduced-motion: reduce` quando disponível.
 * - O CSS global (`src/index.css` → `@media (prefers-reduced-motion)`) já
 *   neutraliza animações CSS; este hook cobre `framer-motion` (que ignora a
 *   media query do CSS porque controla animações via JS).
 *
 * Use em qualquer componente com `motion.*`:
 *
 * @example
 *   const reduced = useReducedMotionSafe();
 *   <motion.div
 *     initial={reduced ? false : { opacity: 0, y: 8 }}
 *     animate={{ opacity: 1, y: 0 }}
 *     transition={reduced ? { duration: 0 } : { duration: 0.2 }}
 *   />
 */
export function useReducedMotionSafe(): boolean {
  const reduced = useReducedMotion();
  return reduced === true;
}
