import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Mocka o `useReducedMotion` do framer-motion: ele lê `matchMedia` no module
// load (lazy init), então mudar `window.matchMedia` por teste não afeta o
// estado já capturado. Mocando o hook diretamente permitimos exercitar todas
// as ramificações de `useReducedMotionSafe` (true | false | null).
const reducedMotionMock = vi.fn<() => boolean | null>();

vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotionMock(),
}));

import { useReducedMotionSafe } from "../useReducedMotionSafe";

describe("useReducedMotionSafe", () => {
  beforeEach(() => {
    reducedMotionMock.mockReset();
  });

  it("retorna false quando o usuário não tem preferência (false do framer)", () => {
    reducedMotionMock.mockReturnValue(false);
    const { result } = renderHook(() => useReducedMotionSafe());
    expect(result.current).toBe(false);
  });

  it("retorna true quando prefers-reduced-motion: reduce está ativo", () => {
    reducedMotionMock.mockReturnValue(true);
    const { result } = renderHook(() => useReducedMotionSafe());
    expect(result.current).toBe(true);
  });

  it("normaliza null do framer para false (nunca retorna null)", () => {
    reducedMotionMock.mockReturnValue(null);
    const { result } = renderHook(() => useReducedMotionSafe());
    expect(result.current).not.toBeNull();
    expect(typeof result.current).toBe("boolean");
    expect(result.current).toBe(false);
  });
});
