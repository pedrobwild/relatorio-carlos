import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrefetchLink } from '../PrefetchLink';

function renderWithRouter(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PrefetchLink', () => {
  it('triggers prefetch on mouseenter and only once per mount', () => {
    const prefetch = vi.fn();
    renderWithRouter(
      <PrefetchLink to="/foo" prefetch={prefetch}>
        target
      </PrefetchLink>,
    );

    const link = screen.getByRole('link', { name: 'target' });
    fireEvent.mouseEnter(link);
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('triggers prefetch on focus', () => {
    const prefetch = vi.fn();
    renderWithRouter(<PrefetchLink to="/a" prefetch={prefetch}>a</PrefetchLink>);
    fireEvent.focus(screen.getByRole('link', { name: 'a' }));
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('triggers prefetch on touchstart', () => {
    const prefetch = vi.fn();
    renderWithRouter(<PrefetchLink to="/b" prefetch={prefetch}>b</PrefetchLink>);
    fireEvent.touchStart(screen.getByRole('link', { name: 'b' }));
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('forwards user-supplied event handlers', () => {
    const prefetch = vi.fn();
    const onMouseEnter = vi.fn();
    const onFocus = vi.fn();
    renderWithRouter(
      <PrefetchLink
        to="/x"
        prefetch={prefetch}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
      >
        x
      </PrefetchLink>,
    );

    const link = screen.getByRole('link', { name: 'x' });
    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledTimes(1);
  });

  it('swallows rejected prefetch promises without throwing', () => {
    const prefetch = vi.fn().mockReturnValue(Promise.reject(new Error('boom')));
    renderWithRouter(
      <PrefetchLink to="/y" prefetch={prefetch}>y</PrefetchLink>,
    );

    expect(() =>
      fireEvent.mouseEnter(screen.getByRole('link', { name: 'y' })),
    ).not.toThrow();
    expect(prefetch).toHaveBeenCalledTimes(1);
  });
});
