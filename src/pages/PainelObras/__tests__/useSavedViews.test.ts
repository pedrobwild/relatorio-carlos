import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSavedViews } from '../useSavedViews';

const USER_A = 'user-a';
const USER_B = 'user-b';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useSavedViews', () => {
  it('starts empty for a new user', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));
    expect(result.current.views).toEqual([]);
  });

  it('persists a saved view to localStorage scoped by user', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));

    act(() => {
      result.current.saveView({
        id: 'crit',
        name: 'Críticas',
        filters: { status: 'critical' },
        columns: ['name', 'engineer'],
      });
    });

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe('Críticas');
    expect(result.current.views[0].updatedAt).toBeDefined();

    const stored = JSON.parse(
      window.localStorage.getItem('painelObras.views.user-a') ?? '[]',
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('crit');
  });

  it('does not leak views across users', () => {
    const { result: a } = renderHook(() => useSavedViews(USER_A));
    act(() => {
      a.current.saveView({
        id: 'v1',
        name: 'View A',
        filters: {},
        columns: [],
      });
    });

    const { result: b } = renderHook(() => useSavedViews(USER_B));
    expect(b.current.views).toEqual([]);
  });

  it('updates an existing view in place when the id matches', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));

    act(() => {
      result.current.saveView({
        id: 'v1',
        name: 'Inicial',
        filters: { stage: 'a' },
        columns: ['name'],
      });
    });
    act(() => {
      result.current.saveView({
        id: 'v1',
        name: 'Atualizada',
        filters: { stage: 'b' },
        columns: ['name', 'progress'],
      });
    });

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views[0].name).toBe('Atualizada');
    expect(result.current.views[0].filters).toEqual({ stage: 'b' });
  });

  it('deletes a view but keeps builtin views', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));

    act(() => {
      result.current.saveView({
        id: 'builtin',
        name: 'Críticas',
        filters: {},
        columns: [],
        builtin: true,
      });
      result.current.saveView({
        id: 'custom',
        name: 'Minha view',
        filters: {},
        columns: [],
      });
    });
    act(() => {
      result.current.deleteView('builtin');
      result.current.deleteView('custom');
    });

    expect(result.current.views.map((v) => v.id)).toEqual(['builtin']);
  });

  it('renames a view but ignores rename on builtin views', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));

    act(() => {
      result.current.saveView({
        id: 'builtin',
        name: 'Críticas',
        filters: {},
        columns: [],
        builtin: true,
      });
      result.current.saveView({
        id: 'custom',
        name: 'Antigo',
        filters: {},
        columns: [],
      });
    });
    act(() => {
      result.current.renameView('builtin', 'Renomeada');
      result.current.renameView('custom', 'Novo');
    });

    expect(result.current.views.find((v) => v.id === 'builtin')?.name).toBe(
      'Críticas',
    );
    expect(result.current.views.find((v) => v.id === 'custom')?.name).toBe(
      'Novo',
    );
  });

  it('reset clears all views', () => {
    const { result } = renderHook(() => useSavedViews(USER_A));
    act(() => {
      result.current.saveView({
        id: 'v1',
        name: 'A',
        filters: {},
        columns: [],
      });
    });
    act(() => result.current.reset());
    expect(result.current.views).toEqual([]);
    expect(
      window.localStorage.getItem('painelObras.views.user-a'),
    ).toBe('[]');
  });

  it('returns empty when userId is null', () => {
    const { result } = renderHook(() => useSavedViews(null));
    expect(result.current.views).toEqual([]);
    act(() => {
      result.current.saveView({
        id: 'v1',
        name: 'A',
        filters: {},
        columns: [],
      });
    });
    // Without a userId we still keep state in memory but never write to storage.
    expect(window.localStorage.length).toBe(0);
  });

  it('tolerates corrupt JSON in storage and starts empty', () => {
    window.localStorage.setItem(
      'painelObras.views.user-a',
      '{ this is not valid json',
    );
    const { result } = renderHook(() => useSavedViews(USER_A));
    expect(result.current.views).toEqual([]);
  });
});
