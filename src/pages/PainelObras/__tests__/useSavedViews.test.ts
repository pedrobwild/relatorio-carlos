import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSavedViews } from '../useSavedViews';

interface F {
  search: string;
  status?: string;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('useSavedViews', () => {
  it('starts empty when no defaults and nothing in storage', () => {
    const { result } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u1' }),
    );
    expect(result.current.views).toHaveLength(0);
    expect(result.current.userViews).toHaveLength(0);
  });

  it('exposes defaults but does not persist them', () => {
    const { result } = renderHook(() =>
      useSavedViews<F>({
        pageKey: 'painelObras',
        userId: 'u1',
        defaults: [{ id: 'all', name: 'Todas', filters: { search: '' } }],
      }),
    );
    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe('Todas');
    expect(window.localStorage.getItem('painelObras.views.u1')).toBeNull();
  });

  it('persists user-saved views to localStorage scoped by user', () => {
    const { result } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u1' }),
    );

    act(() => {
      result.current.saveView({ name: 'Críticas', filters: { search: '', status: 'critical' } });
    });

    expect(result.current.userViews).toHaveLength(1);
    const stored = JSON.parse(window.localStorage.getItem('painelObras.views.u1') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Críticas');
  });

  it('isolates views per userId', () => {
    const { result: r1 } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u1' }),
    );
    act(() => {
      r1.current.saveView({ name: 'View A', filters: { search: 'a' } });
    });

    const { result: r2 } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u2' }),
    );
    expect(r2.current.userViews).toHaveLength(0);
  });

  it('updates a view by id', () => {
    const { result } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u1' }),
    );
    let id = '';
    act(() => {
      id = result.current.saveView({ name: 'Old', filters: { search: '' } }).id;
    });
    act(() => {
      result.current.updateView(id, { name: 'New' });
    });
    expect(result.current.userViews[0].name).toBe('New');
  });

  it('deletes a view by id', () => {
    const { result } = renderHook(() =>
      useSavedViews<F>({ pageKey: 'painelObras', userId: 'u1' }),
    );
    let id = '';
    act(() => {
      id = result.current.saveView({ name: 'X', filters: { search: '' } }).id;
    });
    act(() => {
      result.current.deleteView(id);
    });
    expect(result.current.userViews).toHaveLength(0);
  });
});
