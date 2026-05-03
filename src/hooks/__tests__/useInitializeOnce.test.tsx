import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { useInitializeOnce } from '../useInitializeOnce';

/**
 * Guarantee that the initialization effect used by Cronograma (and other
 * forms that hydrate local state from the server) runs ONCE and never
 * overwrites later user edits — even when the upstream query refetches,
 * realtime invalidates, or the parent re-renders with a new array
 * reference for the same data.
 */
describe('useInitializeOnce', () => {
  function Harness({
    serverData,
    ready,
    onChange,
  }: {
    serverData: string[];
    ready: boolean;
    onChange?: (next: string[]) => void;
  }) {
    const [local, setLocal] = useState<string[]>([]);

    useInitializeOnce(ready, () => {
      setLocal([...serverData]);
    });

    onChange?.(local);

    return (
      <button
        data-testid="edit"
        onClick={() => setLocal((prev) => [...prev, 'user-edit'])}
      >
        edit
      </button>
    );
  }

  it('runs the initializer once when ready becomes true', () => {
    const initializer = vi.fn();

    function HookProbe({ ready }: { ready: boolean }) {
      useInitializeOnce(ready, initializer);
      return null;
    }

    const { rerender } = render(<HookProbe ready={false} />);
    expect(initializer).not.toHaveBeenCalled();

    rerender(<HookProbe ready={true} />);
    expect(initializer).toHaveBeenCalledTimes(1);

    // Subsequent renders, even toggling ready, must not re-run it.
    rerender(<HookProbe ready={false} />);
    rerender(<HookProbe ready={true} />);
    expect(initializer).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite local edits when upstream data refetches', () => {
    let captured: string[] = [];
    const onChange = (next: string[]) => {
      captured = next;
    };

    const initial = ['A', 'B', 'C'];
    const { rerender, getByTestId } = render(
      <Harness serverData={initial} ready={true} onChange={onChange} />,
    );

    // Hydrated from server.
    expect(captured).toEqual(['A', 'B', 'C']);

    // User edits locally (e.g. cascade of dates).
    act(() => {
      getByTestId('edit').click();
    });
    expect(captured).toEqual(['A', 'B', 'C', 'user-edit']);

    // Upstream query refetches and returns a NEW array reference with
    // different contents (simulating realtime invalidation).
    rerender(
      <Harness
        serverData={['X', 'Y']}
        ready={true}
        onChange={onChange}
      />,
    );

    // Local edits MUST be preserved — initializer must not run again.
    expect(captured).toEqual(['A', 'B', 'C', 'user-edit']);
  });

  it('waits for ready before initializing', () => {
    let captured: string[] = [];
    const onChange = (next: string[]) => {
      captured = next;
    };

    const { rerender } = render(
      <Harness serverData={['A']} ready={false} onChange={onChange} />,
    );
    expect(captured).toEqual([]);

    rerender(<Harness serverData={['A']} ready={true} onChange={onChange} />);
    expect(captured).toEqual(['A']);
  });
});
