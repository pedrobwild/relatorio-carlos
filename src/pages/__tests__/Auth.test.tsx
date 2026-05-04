/**
 * Auth Page Tests
 *
 * Tests for authentication page with validation and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock error logger
vi.mock("@/lib/errorLogger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock toast
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe("Auth Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render login form by default", async () => {
    const Auth = (await import("../Auth")).default;

    const { findByText } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    // Wait for session check to complete and the form to render.
    // The current Auth page surfaces an "Entrar" button as the primary CTA
    // and the login form root carries the data-testid hook.
    const entrar = await findByText("Entrar", { exact: false });
    expect(entrar).toBeInTheDocument();
    expect(document.querySelector('[data-testid="login-form"]')).not.toBeNull();
  });

  it("should show loading state while checking session", async () => {
    // Override getSession to delay
    const { supabase } = await import("@/integrations/supabase/client");
    (supabase.auth.getSession as any).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ data: { session: null }, error: null }),
            100,
          ),
        ),
    );

    const Auth = (await import("../Auth")).default;

    const { getByText } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    expect(getByText("Verificando sessão...")).toBeInTheDocument();
  });

  it("should have email input with correct placeholder", async () => {
    const Auth = (await import("../Auth")).default;

    const { findByPlaceholderText } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    const emailInput = await findByPlaceholderText("seu@email.com");
    expect(emailInput).toBeInTheDocument();
  });

  it("should have password input with correct placeholder", async () => {
    const Auth = (await import("../Auth")).default;

    const { findByPlaceholderText } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    const passwordInput = await findByPlaceholderText("••••••••");
    expect(passwordInput).toBeInTheDocument();
  });

  it("should have submit button for login", async () => {
    const Auth = (await import("../Auth")).default;

    const { findByRole } = render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    const submitButton = await findByRole("button", { name: /entrar/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });
});

describe("Auth validation schemas", () => {
  it("should validate email correctly", async () => {
    const { z } = await import("zod");

    const emailSchema = z
      .string()
      .trim()
      .min(1, "Email obrigatório")
      .email("Email inválido");

    expect(() => emailSchema.parse("valid@email.com")).not.toThrow();
    expect(() => emailSchema.parse("invalid-email")).toThrow();
    expect(() => emailSchema.parse("")).toThrow();
  });

  it("should validate password correctly", async () => {
    const { z } = await import("zod");

    const passwordSchema = z
      .string()
      .min(6, "Senha deve ter no mínimo 6 caracteres");

    expect(() => passwordSchema.parse("123456")).not.toThrow();
    expect(() => passwordSchema.parse("12345")).toThrow();
    expect(() => passwordSchema.parse("")).toThrow();
  });

  it("should validate CPF correctly", async () => {
    const { z } = await import("zod");

    const cpfSchema = z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos");

    expect(() => cpfSchema.parse("12345678901")).not.toThrow();
    expect(() => cpfSchema.parse("1234567890")).toThrow(); // 10 digits
    expect(() => cpfSchema.parse("123456789012")).toThrow(); // 12 digits
    expect(() => cpfSchema.parse("123.456.789-01")).toThrow(); // formatted
  });
});
