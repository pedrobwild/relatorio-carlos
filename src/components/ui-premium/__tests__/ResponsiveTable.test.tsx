import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponsiveTable, type ResponsiveTableMobileItem } from "../ResponsiveTable";

interface Row {
  id: number;
  name: string;
  status: string;
}

const sample: Row[] = [
  { id: 1, name: "Compra A", status: "pendente" },
  { id: 2, name: "Compra B", status: "aprovada" },
];

const toItem = (row: Row): ResponsiveTableMobileItem => ({
  id: row.id,
  title: row.name,
  subtitle: row.status,
});

describe("ResponsiveTable", () => {
  it("renders the desktop table when forced to desktop", () => {
    render(
      <ResponsiveTable
        data={sample}
        mobileItem={toItem}
        forceMode="desktop"
        renderDesktop={(rows) => (
          <table>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="desktop-row">
                  <td>{r.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />,
    );

    expect(screen.getAllByTestId("desktop-row")).toHaveLength(2);
    expect(document.querySelector('[data-component="responsive-table-mobile"]')).toBeNull();
  });

  it("renders the mobile list when forced to mobile", () => {
    render(
      <ResponsiveTable
        data={sample}
        mobileItem={toItem}
        forceMode="mobile"
        renderDesktop={() => <div data-testid="desktop">desktop</div>}
      />,
    );

    expect(document.querySelector('[data-component="responsive-table-mobile"]')).not.toBeNull();
    expect(screen.getByText("Compra A")).toBeInTheDocument();
    expect(screen.getByText("Compra B")).toBeInTheDocument();
    expect(screen.queryByTestId("desktop")).toBeNull();
  });

  it("renders the empty state when data is empty", () => {
    render(
      <ResponsiveTable
        data={[]}
        mobileItem={toItem}
        forceMode="desktop"
        renderDesktop={() => <div>desktop</div>}
        emptyState={<div data-testid="empty">Nada por aqui</div>}
      />,
    );

    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("forwards onClick from mobile item config", () => {
    const onClick = vi.fn();
    render(
      <ResponsiveTable
        data={[sample[0]]}
        mobileItem={(row) => ({ ...toItem(row), onClick })}
        forceMode="mobile"
        renderDesktop={() => null}
      />,
    );

    screen.getByRole("button", { name: /Compra A/i }).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
