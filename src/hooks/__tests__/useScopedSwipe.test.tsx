import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useScopedSwipe, ScopedSwipeOptions } from '@/hooks/useScopedSwipe';

type TouchInit = { clientX: number; clientY: number };

function makeTouch({ clientX, clientY }: TouchInit): Touch {
  // Touch is not constructable in jsdom, so we cast a plain object.
  return { clientX, clientY, identifier: 0, target: document.body } as unknown as Touch;
}

function dispatchTouch(
  el: HTMLElement,
  type: 'touchstart' | 'touchend' | 'touchcancel',
  point: TouchInit,
  timeStamp: number,
  target?: EventTarget
) {
  // Drive the hook's clock through Date.now so we can assert duration / velocity
  // deterministically. jsdom sets event.timeStamp at dispatch time, so the hook
  // falls back to Date.now() when timeStamp is 0 — we mock it here.
  vi.spyOn(Date, 'now').mockReturnValue(timeStamp);

  const touch = makeTouch(point);
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' ? [] : [touch],
  });
  Object.defineProperty(event, 'changedTouches', { value: [touch] });
  Object.defineProperty(event, 'timeStamp', { value: 0, configurable: true });
  if (target) {
    Object.defineProperty(event, 'target', { value: target });
  }
  el.dispatchEvent(event);
}

function renderSwipeOnElement(
  element: HTMLElement,
  options: Omit<ScopedSwipeOptions, 'ref'>
) {
  return renderHook(() => {
    const ref = useRef<HTMLElement>(element);
    useScopedSwipe({ ref, ...options });
  });
}

describe('useScopedSwipe', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
  });

  afterEach(() => {
    document.body.removeChild(host);
    vi.restoreAllMocks();
  });

  it('fires onSwipeLeft when horizontal delta exceeds threshold', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 50, clientY: 110 }, 200);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('fires onSwipeRight on inverse direction', () => {
    const onSwipeRight = vi.fn();
    renderSwipeOnElement(host, { onSwipeRight });

    dispatchTouch(host, 'touchstart', { clientX: 100, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 260, clientY: 100 }, 200);

    expect(onSwipeRight).toHaveBeenCalledTimes(1);
  });

  it('does not fire below threshold', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft, threshold: 120 });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 120, clientY: 100 }, 200); // 80px

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('does not fire below minimum velocity', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft, minVelocity: 0.4 });

    // 150px over 1000ms = 0.15 px/ms — too slow
    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 50, clientY: 100 }, 1000);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores gestures starting near the left edge (iOS edge-swipe area)', () => {
    const onSwipeRight = vi.fn();
    renderSwipeOnElement(host, { onSwipeRight, edgeIgnore: 24 });

    dispatchTouch(host, 'touchstart', { clientX: 10, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 200, clientY: 100 }, 200);

    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('ignores gestures starting near the right edge', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft, edgeIgnore: 24 });

    dispatchTouch(host, 'touchstart', { clientX: 395, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 50, clientY: 100 }, 200);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('ignores gestures with too much vertical drift', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft, maxVerticalDrift: 60 });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 30, clientY: 200 }, 200); // 100px vertical

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('respects disableWhen callback', () => {
    const onSwipeLeft = vi.fn();
    const isDialogOpen = vi.fn().mockReturnValue(true);
    renderSwipeOnElement(host, { onSwipeLeft, disableWhen: isDialogOpen });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 50, clientY: 100 }, 200);

    expect(isDialogOpen).toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('bails out if the touchstart target has data-no-swipe', () => {
    const onSwipeLeft = vi.fn();
    const blocked = document.createElement('div');
    blocked.setAttribute('data-no-swipe', '');
    host.appendChild(blocked);

    renderSwipeOnElement(host, { onSwipeLeft });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0, blocked);
    dispatchTouch(host, 'touchend', { clientX: 30, clientY: 100 }, 200, blocked);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('bails out if any ancestor has data-no-swipe', () => {
    const onSwipeLeft = vi.fn();
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-no-swipe', '');
    const inner = document.createElement('span');
    wrapper.appendChild(inner);
    host.appendChild(wrapper);

    renderSwipeOnElement(host, { onSwipeLeft });

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0, inner);
    dispatchTouch(host, 'touchend', { clientX: 30, clientY: 100 }, 200, inner);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('attaches listeners only to the scoped element, not document', () => {
    const onSwipeLeft = vi.fn();
    renderSwipeOnElement(host, { onSwipeLeft });

    // Touchstart on document outside the scope should not arm the gesture
    dispatchTouch(document.body, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(document.body, 'touchend', { clientX: 30, clientY: 100 }, 200);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('cleans up listeners on unmount', () => {
    const onSwipeLeft = vi.fn();
    const { unmount } = renderSwipeOnElement(host, { onSwipeLeft });
    unmount();

    dispatchTouch(host, 'touchstart', { clientX: 200, clientY: 100 }, 0);
    dispatchTouch(host, 'touchend', { clientX: 30, clientY: 100 }, 200);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
