import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVisualViewport } from '../useVisualViewport';

interface MockVisualViewport {
  height: number;
  width: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

let mockVV: MockVisualViewport | null;

const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'visualViewport');
const originalInnerHeight = window.innerHeight;

function setVisualViewport(vv: MockVisualViewport | null) {
  mockVV = vv;
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    get: () => mockVV,
  });
}

function setInnerHeight(value: number) {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value,
  });
}

beforeEach(() => {
  setInnerHeight(800);
});

afterEach(() => {
  if (originalDescriptor) {
    Object.defineProperty(window, 'visualViewport', originalDescriptor);
  } else {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport;
  }
  setInnerHeight(originalInnerHeight);
});

describe('useVisualViewport', () => {
  it('returns neutral state when visualViewport is unavailable', () => {
    setVisualViewport(null);
    const { result } = renderHook(() => useVisualViewport());

    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
    expect(result.current.height).toBe(800);
  });

  it('reports keyboard closed when viewport height matches innerHeight', () => {
    setVisualViewport({
      height: 800,
      width: 375,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useVisualViewport());

    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('detects keyboard open when viewport height shrinks > 100px', () => {
    setVisualViewport({
      height: 500,
      width: 375,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useVisualViewport());

    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.keyboardHeight).toBe(300);
  });

  it('subscribes to resize and scroll events on mount and cleans up on unmount', () => {
    const add = vi.fn();
    const remove = vi.fn();
    setVisualViewport({
      height: 800,
      width: 375,
      offsetTop: 0,
      addEventListener: add,
      removeEventListener: remove,
    });

    const { unmount } = renderHook(() => useVisualViewport());

    expect(add).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(add).toHaveBeenCalledWith('scroll', expect.any(Function));

    unmount();

    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('updates state when the resize listener fires', () => {
    let resizeListener: (() => void) | null = null;
    const add = vi.fn((event: string, listener: () => void) => {
      if (event === 'resize') resizeListener = listener;
    });
    const vv = {
      height: 800,
      width: 375,
      offsetTop: 0,
      addEventListener: add,
      removeEventListener: vi.fn(),
    };
    setVisualViewport(vv);

    const { result } = renderHook(() => useVisualViewport());
    expect(result.current.isKeyboardOpen).toBe(false);

    act(() => {
      vv.height = 400;
      resizeListener?.();
    });

    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.keyboardHeight).toBe(400);
  });
});
