import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from '../useFormDraft';
import { RESTORE_DRAFT_EVENT } from '@/components/TabDiscardDetector';

type DraftShape = {
  title: string;
  body: string;
} & Record<string, unknown>;

const initial: DraftShape = { title: '', body: '' };

describe('useFormDraft', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it('persists draft to localStorage after debounce', () => {
    const { result } = renderHook(() =>
      useFormDraft<DraftShape>({ key: 'test-1', initialValues: initial, debounceMs: 50 }),
    );

    act(() => result.current.updateField('title', 'New title'));

    act(() => {
      vi.advanceTimersByTime(60);
    });

    const stored = localStorage.getItem('bwild-draft-test-1');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).title).toBe('New title');
  });

  it('rehydrates from localStorage on the RESTORE_DRAFT_EVENT', () => {
    localStorage.setItem(
      'bwild-draft-test-2',
      JSON.stringify({ title: 'restored', body: '' }),
    );

    const { result } = renderHook(() =>
      useFormDraft<DraftShape>({ key: 'test-2', initialValues: initial }),
    );

    expect(result.current.values.title).toBe('restored');

    // Simulate user clearing in-memory state, then a tab restore event arrives.
    act(() => result.current.setValues(initial));
    expect(result.current.values.title).toBe('');

    localStorage.setItem(
      'bwild-draft-test-2',
      JSON.stringify({ title: 'restored-again', body: '' }),
    );

    act(() => {
      window.dispatchEvent(new Event(RESTORE_DRAFT_EVENT));
    });

    expect(result.current.values.title).toBe('restored-again');
  });

  it('clearDraft removes the draft and resets values', () => {
    const { result } = renderHook(() =>
      useFormDraft<DraftShape>({ key: 'test-3', initialValues: initial, debounceMs: 50 }),
    );

    act(() => result.current.updateField('title', 'something'));
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(localStorage.getItem('bwild-draft-test-3')).not.toBeNull();

    act(() => result.current.clearDraft());

    expect(localStorage.getItem('bwild-draft-test-3')).toBeNull();
    expect(result.current.values).toEqual(initial);
    expect(result.current.hasDraft).toBe(false);
  });
});
