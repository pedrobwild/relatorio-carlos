import { useEffect, useState } from 'react';

/**
 * useVisualViewport — observa a `window.visualViewport` e devolve o estado
 * do teclado virtual em mobile.
 *
 * Quando o teclado abre, `visualViewport.height` encolhe e `offsetTop`
 * deslocaliza. A diferença entre `window.innerHeight` e `visualViewport.height`
 * indica a altura ocupada pelo teclado — útil para padding-bottom dinâmico
 * em formulários longos (RDO, Medição).
 *
 * Em browsers sem suporte (raro), retorna estado neutro (`isKeyboardOpen=false`).
 */
export interface VisualViewportState {
  /** Altura visível atual da viewport (em CSS px). */
  height: number;
  /** Largura visível atual da viewport. */
  width: number;
  /** Offset vertical (top) da viewport — > 0 quando teclado/barra cobre o topo. */
  offsetTop: number;
  /** Altura estimada do teclado virtual (0 quando fechado). */
  keyboardHeight: number;
  /** Heurística: teclado considerado aberto quando comprime > 100px. */
  isKeyboardOpen: boolean;
}

const KEYBOARD_THRESHOLD_PX = 100;

function readViewport(): VisualViewportState {
  if (typeof window === 'undefined') {
    return { height: 0, width: 0, offsetTop: 0, keyboardHeight: 0, isKeyboardOpen: false };
  }

  const vv = window.visualViewport;
  const innerHeight = window.innerHeight;
  const innerWidth = window.innerWidth;

  if (!vv) {
    return {
      height: innerHeight,
      width: innerWidth,
      offsetTop: 0,
      keyboardHeight: 0,
      isKeyboardOpen: false,
    };
  }

  const keyboardHeight = Math.max(0, innerHeight - vv.height);
  return {
    height: vv.height,
    width: vv.width,
    offsetTop: vv.offsetTop,
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > KEYBOARD_THRESHOLD_PX,
  };
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => readViewport());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setState(readViewport());

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('orientationchange', update);

    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return state;
}
