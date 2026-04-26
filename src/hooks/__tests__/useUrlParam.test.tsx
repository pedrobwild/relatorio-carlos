import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useUrlParam, useNullableUrlParam } from '@/hooks/useUrlParam';

type Color = 'red' | 'green' | 'blue';
const isColor = (v: string): v is Color => v === 'red' || v === 'green' || v === 'blue';

function createWrapper(initialEntry = '/') {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

describe('useUrlParam', () => {
  it('returns the default value when the param is absent', () => {
    const { result } = renderHook(() => useUrlParam<Color>('color', 'red', isColor), {
      wrapper: createWrapper('/'),
    });
    expect(result.current[0]).toBe('red');
  });

  it('reads an existing value from the URL', () => {
    const { result } = renderHook(() => useUrlParam<Color>('color', 'red', isColor), {
      wrapper: createWrapper('/?color=green'),
    });
    expect(result.current[0]).toBe('green');
  });

  it('falls back to the default for values rejected by isValid', () => {
    const { result } = renderHook(() => useUrlParam<Color>('color', 'red', isColor), {
      wrapper: createWrapper('/?color=neon'),
    });
    expect(result.current[0]).toBe('red');
  });

  it('writes the value to the URL when set', () => {
    const probe: { search: string } = { search: '' };
    function Probe({ children }: { children: ReactNode }) {
      const loc = useLocation();
      probe.search = loc.search;
      return <>{children}</>;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<Probe>{children}</Probe>} />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useUrlParam<Color>('color', 'red', isColor), { wrapper });
    act(() => result.current[1]('blue'));
    expect(probe.search).toBe('?color=blue');
    expect(result.current[0]).toBe('blue');
  });

  it('strips the param from the URL when set back to the default', () => {
    const probe: { search: string } = { search: '' };
    function Probe({ children }: { children: ReactNode }) {
      const loc = useLocation();
      probe.search = loc.search;
      return <>{children}</>;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/?color=blue']}>
        <Routes>
          <Route path="*" element={<Probe>{children}</Probe>} />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useUrlParam<Color>('color', 'red', isColor), { wrapper });
    expect(result.current[0]).toBe('blue');
    act(() => result.current[1]('red'));
    expect(probe.search).toBe('');
    expect(result.current[0]).toBe('red');
  });
});

describe('useNullableUrlParam', () => {
  it('returns null when the param is absent', () => {
    const { result } = renderHook(() => useNullableUrlParam<Color>('color', isColor), {
      wrapper: createWrapper('/'),
    });
    expect(result.current[0]).toBeNull();
  });

  it('writes a value and clears it when set to null', () => {
    const probe: { search: string } = { search: '' };
    function Probe({ children }: { children: ReactNode }) {
      const loc = useLocation();
      probe.search = loc.search;
      return <>{children}</>;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={<Probe>{children}</Probe>} />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(() => useNullableUrlParam<Color>('color', isColor), { wrapper });
    act(() => result.current[1]('green'));
    expect(probe.search).toBe('?color=green');
    expect(result.current[0]).toBe('green');

    act(() => result.current[1](null));
    expect(probe.search).toBe('');
    expect(result.current[0]).toBeNull();
  });

  it('rejects invalid values from the URL and treats them as absent', () => {
    const { result } = renderHook(() => useNullableUrlParam<Color>('color', isColor), {
      wrapper: createWrapper('/?color=mauve'),
    });
    expect(result.current[0]).toBeNull();
  });
});
