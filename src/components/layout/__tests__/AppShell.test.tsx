import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

// Heavy children of AppShell talk to Supabase and TanStack Query — for a
// surface-level test we only exercise the `public` variant which renders
// children verbatim without sidebars or headers.

describe("AppShell — public variant", () => {
  it("renders children verbatim with no shell chrome", () => {
    render(
      <MemoryRouter initialEntries={["/auth"]}>
        <AppShell variant="public">
          <div data-testid="page">Auth content</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("page")).toBeInTheDocument();
    expect(screen.getByText("Auth content")).toBeInTheDocument();
  });
});
