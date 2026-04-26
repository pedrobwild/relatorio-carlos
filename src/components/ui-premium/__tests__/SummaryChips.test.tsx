import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryChips, type SummaryChip } from '../SummaryChips';

const chips: SummaryChip[] = [
  { id: 'a', label: 'Atrasadas', count: 3, accent: 'destructive' },
  { id: 'b', label: 'Hoje', count: 2, accent: 'warning' },
  { id: 'c', label: 'Todas', count: 16, accent: 'primary' },
];

describe('SummaryChips', () => {
  it('renders one button per chip when interactive', () => {
    render(<SummaryChips chips={chips} activeId={null} onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('marks the active chip with aria-selected', () => {
    render(<SummaryChips chips={chips} activeId="b" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Hoje/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /Atrasadas/ })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('emits null when the active chip is tapped (clears the filter)', () => {
    const onChange = vi.fn();
    render(<SummaryChips chips={chips} activeId="b" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Hoje/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('emits the chip id when an inactive chip is tapped', () => {
    const onChange = vi.fn();
    render(<SummaryChips chips={chips} activeId="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Hoje/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders read-only spans (no buttons) when onChange is omitted', () => {
    render(<SummaryChips chips={chips} />);
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Atrasadas')).toBeInTheDocument();
  });

  it('shows the count next to each label', () => {
    render(<SummaryChips chips={chips} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
  });
});
