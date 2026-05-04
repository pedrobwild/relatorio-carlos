import { useEffect, useState } from "react";

export interface VisualViewportState {
  /** Current viewport height (window.visualViewport.height). */
  height: number;
  /** Current viewport width. */
  width: number;
  /** Vertical offset from the top of the layout viewport. */
  offsetTop: number;
  /** True when the on-screen keyboard is visible (heuristic). */
  isKeyboardOpen: boolean;
  /** Pixels currently obscured at the bottom — useful as padding-bottom. */
  keyboardInset: number;
}

/**
 * Tracks `window.visualViewport` so callers can adapt to the on-screen
 * keyboard. The keyboard heuristic compares viewport height against the
 * layout height — when the gap is over 150px, the IME is assumed visible.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    offsetTop: 0,
    isKeyboardOpen: false,
    keyboardInset: 0,
  }));

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;
    const update = () => {
      const layoutHeight = window.innerHeight;
      const keyboardInset = Math.max(
        0,
        layoutHeight - vv.height - vv.offsetTop,
      );
      setState({
        height: vv.height,
        width: vv.width,
        offsetTop: vv.offsetTop,
        isKeyboardOpen: keyboardInset > 150,
        keyboardInset,
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}
