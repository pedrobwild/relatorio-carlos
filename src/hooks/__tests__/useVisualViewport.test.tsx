import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisualViewport } from "../useVisualViewport";

interface MockVisualViewport {
  height: number;
  width: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

let mockViewport: MockVisualViewport;
let listeners: Record<string, Array<() => void>>;

const fireEvent = (name: string) => {
  (listeners[name] ?? []).forEach((fn) => fn());
};

describe("useVisualViewport", () => {
  beforeEach(() => {
    listeners = { resize: [], scroll: [] };
    mockViewport = {
      height: 800,
      width: 375,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, fn: () => void) => {
        listeners[event] = [...(listeners[event] ?? []), fn];
      }),
      removeEventListener: vi.fn((event: string, fn: () => void) => {
        listeners[event] = (listeners[event] ?? []).filter((cb) => cb !== fn);
      }),
    };

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: mockViewport,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("returns the initial viewport state on mount", () => {
    const { result } = renderHook(() => useVisualViewport());
    expect(result.current.height).toBe(800);
    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardInset).toBe(0);
  });

  it("flags keyboard as open when the viewport shrinks past the threshold", () => {
    const { result } = renderHook(() => useVisualViewport());

    act(() => {
      mockViewport.height = 500;
      mockViewport.offsetTop = 0;
      fireEvent("resize");
    });

    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.keyboardInset).toBe(300);
  });

  it("does not flag the keyboard for small UI shifts", () => {
    const { result } = renderHook(() => useVisualViewport());

    act(() => {
      mockViewport.height = 750;
      fireEvent("resize");
    });

    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardInset).toBe(50);
  });

  it("removes listeners on unmount", () => {
    const { unmount } = renderHook(() => useVisualViewport());
    unmount();
    expect(mockViewport.removeEventListener).toHaveBeenCalled();
  });
});
