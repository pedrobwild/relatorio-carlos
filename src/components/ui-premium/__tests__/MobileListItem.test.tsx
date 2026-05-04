import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileListItem, MobileList } from '../MobileListItem';

describe('MobileListItem', () => {
  it('renders title and description', () => {
    render(
      <MobileListItem
        title="Compra de cimento"
        description="Fornecedor: Votorantim"
      />,
    );
    expect(screen.getByText('Compra de cimento')).toBeInTheDocument();
    expect(screen.getByText(/Votorantim/)).toBeInTheDocument();
  });

  it('renders eyebrow and status slots', () => {
    render(
      <MobileListItem
        eyebrow="OC-0042"
        title="Material elétrico"
        status={<span>Aprovada</span>}
      />,
    );
    expect(screen.getByText('OC-0042')).toBeInTheDocument();
    expect(screen.getByText('Aprovada')).toBeInTheDocument();
  });

  it('is interactive when onClick is provided', async () => {
    const onClick = vi.fn();
    render(<MobileListItem title="Linha 1" onClick={onClick} />);

    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as div when no onClick provided', () => {
    render(<MobileListItem title="Read-only" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows chevron only when interactive by default', () => {
    const { rerender } = render(<MobileListItem title="A" onClick={vi.fn()} />);
    // chevron icon is svg with aria-hidden — count svg children
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0);

    rerender(<MobileListItem title="B" />);
    expect(document.querySelectorAll('svg').length).toBe(0);
  });

  it('renders custom trailing slot when provided', () => {
    render(
      <MobileListItem
        title="Item"
        onClick={vi.fn()}
        trailing={<span data-testid="trail">›</span>}
      />,
    );
    expect(screen.getByTestId('trail')).toBeInTheDocument();
  });

  it('has minimum touch target height of 56px', () => {
    render(<MobileListItem title="X" onClick={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[56px]');
  });
});

describe('MobileList', () => {
  it('wraps children as semantic list items', () => {
    render(
      <MobileList ariaLabel="Compras">
        <MobileListItem title="A" />
        <MobileListItem title="B" />
      </MobileList>,
    );

    const list = screen.getByRole('list', { name: /compras/i });
    expect(list).toBeInTheDocument();
    expect(list.tagName).toBe('UL');
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });
});
