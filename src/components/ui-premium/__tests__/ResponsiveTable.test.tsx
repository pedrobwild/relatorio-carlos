import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResponsiveTable } from '../ResponsiveTable';

type Row = { id: string; label: string };

const rows: Row[] = [
  { id: '1', label: 'Alpha' },
  { id: '2', label: 'Beta' },
];

describe('ResponsiveTable', () => {
  it('renders the desktop slot when forced to desktop layout', () => {
    render(
      <ResponsiveTable
        rows={rows}
        getRowKey={(r) => r.id}
        forceLayout="desktop"
        desktop={(items) => (
          <table>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        mobileRender={(r) => <div data-testid="card">{r.label}</div>}
      />
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByTestId('card')).not.toBeInTheDocument();
  });

  it('renders mobile cards when forced to mobile layout', () => {
    render(
      <ResponsiveTable
        rows={rows}
        getRowKey={(r) => r.id}
        forceLayout="mobile"
        desktop={() => <table />}
        mobileRender={(r) => <div data-testid="card">{r.label}</div>}
      />
    );

    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('wraps mobile cards in a button when onRowClick is provided', () => {
    const onRowClick = vi.fn();
    render(
      <ResponsiveTable
        rows={rows}
        getRowKey={(r) => r.id}
        forceLayout="mobile"
        onRowClick={onRowClick}
        desktop={() => null}
        mobileRender={(r) => <span>{r.label}</span>}
      />
    );

    const buttons = screen.getAllByRole('listitem');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it('does not wrap rows in buttons when onRowClick is omitted', () => {
    render(
      <ResponsiveTable
        rows={rows}
        getRowKey={(r) => r.id}
        forceLayout="mobile"
        desktop={() => null}
        mobileRender={(r) => <span>{r.label}</span>}
      />
    );

    const items = screen.getAllByRole('listitem');
    items.forEach((node) => {
      expect(node.tagName).not.toBe('BUTTON');
    });
  });

  it('renders the emptyState when rows is empty and emptyState is provided', () => {
    render(
      <ResponsiveTable
        rows={[]}
        getRowKey={(r) => (r as Row).id}
        forceLayout="mobile"
        desktop={() => null}
        mobileRender={() => null}
        emptyState={<p>Nada por aqui</p>}
      />
    );

    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
  });
});
