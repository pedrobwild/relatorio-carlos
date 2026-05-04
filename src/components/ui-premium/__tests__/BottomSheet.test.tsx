import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Edit, Trash2 } from 'lucide-react';
import { BottomSheet, BottomSheetItem, BottomSheetSeparator } from '../BottomSheet';

describe('BottomSheet', () => {
  it('renders title and items when open', () => {
    render(
      <BottomSheet open onOpenChange={vi.fn()} title="Ações da compra">
        <BottomSheetItem icon={Edit} onClick={vi.fn()}>
          Editar
        </BottomSheetItem>
        <BottomSheetSeparator />
        <BottomSheetItem icon={Trash2} onClick={vi.fn()} destructive>
          Excluir
        </BottomSheetItem>
      </BottomSheet>,
    );

    expect(screen.getByText('Ações da compra')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /excluir/i })).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <BottomSheet open={false} onOpenChange={vi.fn()} title="Hidden">
        <BottomSheetItem onClick={vi.fn()}>X</BottomSheetItem>
      </BottomSheet>,
    );
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('calls onClick when item is selected', async () => {
    const onEdit = vi.fn();
    render(
      <BottomSheet open onOpenChange={vi.fn()}>
        <BottomSheetItem onClick={onEdit}>Editar</BottomSheetItem>
      </BottomSheet>,
    );

    await userEvent.click(screen.getByRole('menuitem', { name: /editar/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('marks destructive items with destructive color', () => {
    render(
      <BottomSheet open onOpenChange={vi.fn()}>
        <BottomSheetItem destructive onClick={vi.fn()}>
          Excluir
        </BottomSheetItem>
      </BottomSheet>,
    );
    const item = screen.getByRole('menuitem', { name: /excluir/i });
    expect(item.className).toContain('text-destructive');
  });

  it('disables items with disabled prop', async () => {
    const onClick = vi.fn();
    render(
      <BottomSheet open onOpenChange={vi.fn()}>
        <BottomSheetItem disabled onClick={onClick}>
          Indisponível
        </BottomSheetItem>
      </BottomSheet>,
    );
    const item = screen.getByRole('menuitem', { name: /indisponível/i });
    expect(item).toBeDisabled();
    await userEvent.click(item);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('items have minimum 48px touch target', () => {
    render(
      <BottomSheet open onOpenChange={vi.fn()}>
        <BottomSheetItem onClick={vi.fn()}>Ok</BottomSheetItem>
      </BottomSheet>,
    );
    const item = screen.getByRole('menuitem', { name: /ok/i });
    expect(item.className).toContain('min-h-[48px]');
  });
});
