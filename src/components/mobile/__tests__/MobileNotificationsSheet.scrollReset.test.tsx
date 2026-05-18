/**
 * Garante que ao abrir o MobileNotificationsSheet o container de scroll
 * (`[data-notif-scroll]`) sempre começa em `scrollTop = 0`, mesmo que
 * tenha rolado em uma abertura anterior.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Notification } from "@/infra/repositories/notifications.repository";

// --- Mocks ----------------------------------------------------------------

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigateMock };
});

const baseNotifs: Notification[] = Array.from({ length: 30 }, (_, i) => ({
  id: `n-${i}`,
  user_id: "u1",
  type: "general",
  title: `Notificação ${i}`,
  body: "Lorem ipsum dolor sit amet consectetur.",
  action_url: null,
  read_at: null,
  created_at: new Date(Date.now() - i * 60_000).toISOString(),
  // campos opcionais que o tipo possa ter — mantidos como any para o teste:
}) as unknown as Notification);

vi.mock("@/hooks/useNotificationsInfinite", () => ({
  useNotificationsInfinite: () => ({
    notifications: baseNotifs,
    unreadCount: baseNotifs.length,
    isLoading: false,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

// react-virtual lê clientHeight do scroll element; jsdom retorna 0.
// Forçamos um valor estável para que linhas sejam virtualizadas.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      if ((this as HTMLElement).hasAttribute("data-notif-scroll")) return 600;
      return 0;
    },
  });
});

// Polyfill rAF para um flush determinístico
function flushRaf() {
  return act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
}

import { MobileNotificationsSheet } from "../MobileNotificationsSheet";

function renderSheet(open: boolean) {
  const onOpenChange = vi.fn();
  const utils = render(
    <MemoryRouter>
      <MobileNotificationsSheet open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return { ...utils, onOpenChange };
}

describe("MobileNotificationsSheet — scroll reset ao abrir", () => {
  it("zera o scrollTop do [data-notif-scroll] quando o sheet abre", async () => {
    const { rerender } = renderSheet(true);
    await flushRaf();

    const scroller = document.querySelector<HTMLElement>("[data-notif-scroll]");
    expect(scroller).not.toBeNull();

    // Simula usuário rolando a lista
    scroller!.scrollTop = 420;
    expect(scroller!.scrollTop).toBe(420);

    // Fecha o sheet
    rerender(
      <MemoryRouter>
        <MobileNotificationsSheet open={false} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    await flushRaf();

    // Reabre o sheet
    rerender(
      <MemoryRouter>
        <MobileNotificationsSheet open={true} onOpenChange={() => {}} />
      </MemoryRouter>,
    );
    await flushRaf();

    const reopened = document.querySelector<HTMLElement>("[data-notif-scroll]");
    expect(reopened).not.toBeNull();
    expect(reopened!.scrollTop).toBe(0);
  });

  it("também zera o scrollTop na primeira abertura", async () => {
    renderSheet(true);
    await flushRaf();
    const scroller = document.querySelector<HTMLElement>("[data-notif-scroll]");
    expect(scroller).not.toBeNull();
    expect(scroller!.scrollTop).toBe(0);
  });
});
