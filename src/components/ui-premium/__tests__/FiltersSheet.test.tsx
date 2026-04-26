import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltersSheet } from '../FiltersSheet';

describe('FiltersSheet', () => {
  it('renders an inactive trigger when activeCount is 0', () => {
    render(
      <FiltersSheet activeCount={0} onClear={() => {}}>
        <div>filters</div>
      </FiltersSheet>
    );
    const trigger = screen.getByRole('button', { name: /Filtros/ });
    expect(trigger).toHaveAccessibleName(/nenhum ativo/i);
  });

  it('shows the active count badge on the trigger when activeCount > 0', () => {
    render(
      <FiltersSheet activeCount={3} onClear={() => {}}>
        <div>filters</div>
      </FiltersSheet>
    );
    expect(screen.getByRole('button', { name: /3 ativos/ })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens the sheet, surfaces children, and exposes Limpar / Aplicar actions', () => {
    const onClear = vi.fn();
    const onApply = vi.fn();
    render(
      <FiltersSheet activeCount={2} onClear={onClear} onApply={onApply}>
        <div data-testid="filter-body">body</div>
      </FiltersSheet>
    );

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));

    expect(screen.getByTestId('filter-body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/ }));
    expect(onClear).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Aplicar/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('disables Limpar filtros when activeCount is 0', () => {
    render(
      <FiltersSheet activeCount={0} onClear={() => {}}>
        <div>body</div>
      </FiltersSheet>
    );
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByRole('button', { name: /Limpar filtros/ })).toBeDisabled();
  });
});
