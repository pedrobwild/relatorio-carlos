import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef, type RefObject } from "react";
import { useScopedSwipe, type ScopedSwipeOptions } from "@/hooks/useScopedSwipe";

type Touch = { clientX: number; clientY: number };

function makeTouchEvent(
  type: "touchstart" | "touchend" | "touchcancel",
  touches: Touch[],
  target?: EventTarget,
  timeStamp = performance.now(),
): TouchEvent {
  const event = new Event(type, { bubbles: true }) as TouchEvent & {
    timeStamp: number;
  };
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : touches,
  });
  Object.defineProperty(event, "changedTouches", { value: touches });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  if (target) {
    Object.defineProperty(event, "target", { value: target });
  }
  return event;
}

function setup(
  options: Omit<ScopedSwipeOptions, "ref"> & { mountNode?: HTMLElement } = {},
) {
  const node = options.mountNode ?? document.createElement("div");
  document.body.appendChild(node);

  const renderResult = renderHook(() => {
    const ref = useRef<HTMLElement | null>(node);
    useScopedSwipe({ ref: ref as RefObject<HTMLElement>, ...options });
    return ref;
  });

  return {
    node,
    cleanup: () => {
      renderResult.unmount();
      node.remove();
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", { writable: true, value: 400 });
});

describe("useScopedSwipe", () => {
  it("calls onSwipeLeft when distance and velocity exceed thresholds", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { node, cleanup } = setup({ onSwipeLeft, onSwipeRight });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 300, clientY: 100 }], node, 0));
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 100, clientY: 110 }], node, 200));
    });

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not fire when distance is below threshold", () => {
    const onSwipeLeft = vi.fn();
    const { node, cleanup } = setup({ onSwipeLeft, threshold: 120 });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 200, clientY: 100 }], node, 0));
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 130, clientY: 105 }], node, 100));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    cleanup();
  });

  it("does not fire when velocity is below minimum", () => {
    const onSwipeLeft = vi.fn();
    const { node, cleanup } = setup({ onSwipeLeft, minVelocity: 0.4 });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 300, clientY: 100 }], node, 0));
      // 200px in 2000ms = 0.1 px/ms, below the 0.4 threshold
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 100, clientY: 105 }], node, 2000));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    cleanup();
  });

  it("ignores gestures starting in the edge zone", () => {
    const onSwipeRight = vi.fn();
    const { node, cleanup } = setup({ onSwipeRight, edgeIgnore: 24 });

    act(() => {
      // Start at x=10, well inside the 24px edge buffer
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 10, clientY: 100 }], node, 0));
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 220, clientY: 105 }], node, 200));
    });

    expect(onSwipeRight).not.toHaveBeenCalled();
    cleanup();
  });

  it("respects [data-no-swipe] ancestors", () => {
    const onSwipeLeft = vi.fn();
    const node = document.createElement("div");
    document.body.appendChild(node);

    const inner = document.createElement("div");
    inner.setAttribute("data-no-swipe", "");
    const target = document.createElement("span");
    inner.appendChild(target);
    node.appendChild(inner);

    const { cleanup } = setup({ onSwipeLeft, mountNode: node });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 300, clientY: 100 }], target, 0));
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 100, clientY: 105 }], target, 200));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    cleanup();
  });

  it("short-circuits when disableWhen returns true", () => {
    const onSwipeLeft = vi.fn();
    const disableWhen = vi.fn().mockReturnValue(true);
    const { node, cleanup } = setup({ onSwipeLeft, disableWhen });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 300, clientY: 100 }], node, 0));
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 100, clientY: 105 }], node, 200));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(disableWhen).toHaveBeenCalled();
    cleanup();
  });

  it("ignores gestures with dominant vertical motion", () => {
    const onSwipeLeft = vi.fn();
    const { node, cleanup } = setup({ onSwipeLeft });

    act(() => {
      node.dispatchEvent(makeTouchEvent("touchstart", [{ clientX: 300, clientY: 100 }], node, 0));
      // dx=-200, dy=200 → ratio above the default 0.6
      node.dispatchEvent(makeTouchEvent("touchend", [{ clientX: 100, clientY: 300 }], node, 200));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    cleanup();
  });
});
