import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BUILTIN_VIEWS, loadViews, persistViews, storageKey, useSavedViews } from '../useSavedViews';
import { EMPTY_FILTERS, type SavedView } from '../types';

const sample = (id: string, name: string): SavedView => ({
  id,
  name,
  filters: { ...EMPTY_FILTERS },
});

describe('storageKey', () => {
  it('escopa por userId', () => {
    expect(storageKey('user-1')).toBe('painelObras.views.user-1');
  });

  it('cai em "anonymous" quando userId não vem', () => {
    expect(storageKey(null)).toBe('painelObras.views.anonymous');
    expect(storageKey(undefined)).toBe('painelObras.views.anonymous');
  });
});

describe('persistViews / loadViews', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips uma lista de views custom', () => {
    const views = [sample('v1', 'Custom 1'), sample('v2', 'Custom 2')];
    persistViews('me', views);
    expect(loadViews('me')).toEqual(views);
  });

  it('descarta entradas inválidas (json corrompido)', () => {
    window.localStorage.setItem(storageKey('me'), '{"not":"array"}');
    expect(loadViews('me')).toEqual([]);
  });

  it('descarta entradas que não atendem ao schema mínimo', () => {
    window.localStorage.setItem(storageKey('me'), JSON.stringify([{ id: 1 }, sample('ok', 'Ok')]));
    expect(loadViews('me')).toHaveLength(1);
    expect(loadViews('me')[0].id).toBe('ok');
  });
});

describe('useSavedViews', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('expõe builtin + custom mesclados', () => {
    const { result } = renderHook(() => useSavedViews('me'));
    expect(result.current.views.length).toBe(BUILTIN_VIEWS.length);

    act(() => {
      result.current.upsertView(sample('v1', 'Minha view'));
    });

    expect(result.current.views.length).toBe(BUILTIN_VIEWS.length + 1);
    expect(result.current.customViews).toHaveLength(1);
  });

  it('persiste no localStorage ao adicionar', () => {
    const { result } = renderHook(() => useSavedViews('me'));
    act(() => {
      result.current.upsertView(sample('v1', 'Persistida'));
    });
    expect(loadViews('me')).toHaveLength(1);
    expect(loadViews('me')[0].name).toBe('Persistida');
  });

  it('upsertView substitui quando o id já existe', () => {
    const { result } = renderHook(() => useSavedViews('me'));
    act(() => {
      result.current.upsertView(sample('v1', 'Antiga'));
      result.current.upsertView({ ...sample('v1', 'Nova') });
    });
    expect(result.current.customViews).toHaveLength(1);
    expect(result.current.customViews[0].name).toBe('Nova');
  });

  it('removeView só remove custom views', () => {
    const { result } = renderHook(() => useSavedViews('me'));
    act(() => {
      result.current.upsertView(sample('v1', 'Custom'));
      result.current.removeView('v1');
    });
    expect(result.current.customViews).toHaveLength(0);

    act(() => {
      result.current.removeView('todas'); // builtin
    });
    expect(result.current.views.find((v) => v.id === 'todas')).toBeDefined();
  });

  it('upsertView ignora views marcadas como builtin', () => {
    const { result } = renderHook(() => useSavedViews('me'));
    act(() => {
      result.current.upsertView({ ...sample('hack', 'Tentativa'), builtin: true });
    });
    expect(result.current.customViews).toHaveLength(0);
  });
});
