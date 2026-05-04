/**
 * Supplier Create/Edit Modal — Taxonomy Tests
 *
 * Covers the two-level taxonomy (supplier_type + supplier_subcategory)
 * in the create and edit dialog inside Fornecedores.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Fornecedores from "../Fornecedores";
import {
  SUPPLIER_SUBCATEGORIES_BY_TYPE,
  SUPPLIER_TYPE_LABELS,
} from "@/constants/supplierCategories";

// ── Mocks ────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function createMockChain(data: any[] = []) {
  const chain: any = {
    select: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue({ data, error: null }),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: mockInsert,
    update: vi.fn((payload: any) => {
      mockUpdate(payload);
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }),
    delete: vi.fn(() => {
      mockDelete();
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    }),
  };
  return chain;
}

const mockFrom = vi.fn((_table: string) => createMockChain());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: (table: string) => mockFrom(table),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...(actual as any), useNavigate: () => vi.fn() };
});

// ── Helpers ──────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

async function openNewDialog(user: ReturnType<typeof userEvent.setup>) {
  const btn = await screen.findByRole("button", { name: /novo fornecedor/i });
  await user.click(btn);
  return screen.findByRole("dialog");
}

// ── Existing supplier fixtures ───────────────────────────────

const classifiedSupplier = {
  id: "sup-1",
  nome: "Marcenaria Bela",
  razao_social: null,
  cnpj_cpf: null,
  categoria: "mao_de_obra",
  supplier_type: "prestadores",
  supplier_subcategory: "Marcenaria",
  telefone: "11999999999",
  email: "marc@test.com",
  site: null,
  cidade: "São Paulo",
  estado: "SP",
  cep: null,
  endereco: null,
  produtos_servicos: "Móveis sob medida",
  condicoes_pagamento: null,
  prazo_entrega_dias: 30,
  nota_avaliacao: 4.5,
  observacoes: null,
  status: "ativo",
  created_at: "2025-01-01T00:00:00Z",
};

const legacySupplier = {
  ...classifiedSupplier,
  id: "sup-legacy",
  nome: "Fornecedor Antigo",
  categoria: "materiais",
  supplier_type: null,
  supplier_subcategory: null,
  telefone: null,
  email: null,
  cidade: null,
  estado: null,
  produtos_servicos: null,
  prazo_entrega_dias: null,
  nota_avaliacao: null,
  created_at: "2024-01-01T00:00:00Z",
};

// ── Tests ────────────────────────────────────────────────────

describe("Supplier Modal — Create", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => createMockChain([]));
  });

  it("renders Categoria and Subcategoria fields", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Categoria *")).toBeInTheDocument();
    expect(within(dialog).getByText("Subcategoria *")).toBeInTheDocument();
  });

  it("subcategoria select starts disabled", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");
    // Subcategory is the second combobox in the form (after categoria, skipping filter selects)
    // Find the one with "Escolha a categoria primeiro" placeholder
    const subTrigger = triggers.find((t) =>
      t.textContent?.includes("Escolha a categoria"),
    );
    expect(subTrigger).toBeTruthy();
    expect(subTrigger).toHaveAttribute("data-disabled", "");
  });

  it("shows only Prestadores subcategories when Prestadores is selected", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");

    // Find the Categoria combobox (contains "Selecione...")
    const catTrigger = triggers.find((t) =>
      t.textContent?.includes("Selecione"),
    );
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.prestadores,
      }),
    );

    // Now open subcategory
    const updatedTriggers = within(dialog).getAllByRole("combobox");
    const subTrigger = updatedTriggers.find(
      (t) =>
        t.textContent?.includes("Selecione") &&
        !t.hasAttribute("data-disabled"),
    );
    await user.click(subTrigger!);

    // Should show Prestadores subcategories
    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores.slice(0, 3)) {
      expect(
        await screen.findByRole("option", { name: sub }),
      ).toBeInTheDocument();
    }
    // Should NOT show Produtos subcategories
    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos.slice(0, 2)) {
      expect(
        screen.queryByRole("option", { name: sub }),
      ).not.toBeInTheDocument();
    }
  });

  it("shows only Produtos subcategories when Produtos is selected", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");

    const catTrigger = triggers.find((t) =>
      t.textContent?.includes("Selecione"),
    );
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.produtos,
      }),
    );

    const updatedTriggers = within(dialog).getAllByRole("combobox");
    const subTrigger = updatedTriggers.find(
      (t) =>
        t.textContent?.includes("Selecione") &&
        !t.hasAttribute("data-disabled"),
    );
    await user.click(subTrigger!);

    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos.slice(0, 3)) {
      expect(
        await screen.findByRole("option", { name: sub }),
      ).toBeInTheDocument();
    }
  });

  it("blocks submit when Categoria is empty", async () => {
    const { toast } = await import("@/hooks/use-toast");
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");

    const inputs = within(dialog).getAllByRole("textbox");
    await user.type(inputs[0], "Fornecedor Teste");

    await user.click(
      within(dialog).getByRole("button", { name: /cadastrar/i }),
    );

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Categoria é obrigatória" }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("blocks submit when Subcategoria is empty", async () => {
    const { toast } = await import("@/hooks/use-toast");
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");

    const inputs = within(dialog).getAllByRole("textbox");
    await user.type(inputs[0], "Fornecedor Teste");

    // Select category only
    const catTrigger = within(dialog)
      .getAllByRole("combobox")
      .find((t) => t.textContent?.includes("Selecione"));
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.prestadores,
      }),
    );

    await user.click(
      within(dialog).getByRole("button", { name: /cadastrar/i }),
    );

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Subcategoria é obrigatória" }),
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("submits successfully with valid Categoria + Subcategoria", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");

    // Fill name
    const inputs = within(dialog).getAllByRole("textbox");
    await user.type(inputs[0], "Marceneiro Top");

    // Select Prestadores
    const catTrigger = within(dialog)
      .getAllByRole("combobox")
      .find((t) => t.textContent?.includes("Selecione"));
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.prestadores,
      }),
    );

    // Select Marcenaria
    const subTrigger = within(dialog)
      .getAllByRole("combobox")
      .find(
        (t) =>
          t.textContent?.includes("Selecione") &&
          !t.hasAttribute("data-disabled"),
      );
    await user.click(subTrigger!);
    await user.click(await screen.findByRole("option", { name: "Marcenaria" }));

    await user.click(
      within(dialog).getByRole("button", { name: /cadastrar/i }),
    );

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "Marceneiro Top",
          supplier_type: "prestadores",
          supplier_subcategory: "Marcenaria",
        }),
      );
    });
  });
});

describe("Supplier Modal — Dependent Reset", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => createMockChain([]));
  });

  it("resets subcategoria when switching from Prestadores to Produtos", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");

    // Select Prestadores
    let catTrigger = within(dialog)
      .getAllByRole("combobox")
      .find((t) => t.textContent?.includes("Selecione"));
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.prestadores,
      }),
    );

    // Select Marcenaria
    const subTrigger = within(dialog)
      .getAllByRole("combobox")
      .find(
        (t) =>
          t.textContent?.includes("Selecione") &&
          !t.hasAttribute("data-disabled"),
      );
    await user.click(subTrigger!);
    await user.click(await screen.findByRole("option", { name: "Marcenaria" }));

    // Verify Marcenaria is shown
    let triggers = within(dialog).getAllByRole("combobox");
    const marcenariaShown = triggers.some((t) =>
      t.textContent?.includes("Marcenaria"),
    );
    expect(marcenariaShown).toBe(true);

    // Switch to Produtos
    catTrigger = triggers.find((t) =>
      t.textContent?.includes(SUPPLIER_TYPE_LABELS.prestadores),
    );
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.produtos,
      }),
    );

    // Marcenaria should be gone
    triggers = within(dialog).getAllByRole("combobox");
    const stillShowsMarcenaria = triggers.some((t) =>
      t.textContent?.includes("Marcenaria"),
    );
    expect(stillShowsMarcenaria).toBe(false);
  });

  it("switching back does not leave inconsistent state", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");

    // Select Produtos > Eletrodomésticos
    let catTrigger = within(dialog)
      .getAllByRole("combobox")
      .find((t) => t.textContent?.includes("Selecione"));
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.produtos,
      }),
    );

    let subTrigger = within(dialog)
      .getAllByRole("combobox")
      .find(
        (t) =>
          t.textContent?.includes("Selecione") &&
          !t.hasAttribute("data-disabled"),
      );
    await user.click(subTrigger!);
    await user.click(
      await screen.findByRole("option", { name: "Eletrodomésticos" }),
    );

    // Switch to Prestadores
    let triggers = within(dialog).getAllByRole("combobox");
    catTrigger = triggers.find((t) =>
      t.textContent?.includes(SUPPLIER_TYPE_LABELS.produtos),
    );
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.prestadores,
      }),
    );

    // Eletrodomésticos should be cleared
    triggers = within(dialog).getAllByRole("combobox");
    expect(
      triggers.some((t) => t.textContent?.includes("Eletrodomésticos")),
    ).toBe(false);

    // Should be able to submit with new valid subcategory
    subTrigger = triggers.find(
      (t) =>
        t.textContent?.includes("Selecione") &&
        !t.hasAttribute("data-disabled"),
    );
    expect(subTrigger).toBeTruthy();
  });
});

describe("Supplier Modal — Edit", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => createMockChain([classifiedSupplier]));
  });

  it("loads saved supplier_type and supplier_subcategory", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole("row");
    const supplierRow = rows.find((r) =>
      r.textContent?.includes("Marcenaria Bela"),
    );
    expect(supplierRow).toBeTruthy();

    const editButton = within(supplierRow!).getAllByRole("button")[0];
    await user.click(editButton);

    const dialog = await screen.findByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");

    expect(
      triggers.some((t) =>
        t.textContent?.includes(SUPPLIER_TYPE_LABELS.prestadores),
      ),
    ).toBe(true);
    expect(triggers.some((t) => t.textContent?.includes("Marcenaria"))).toBe(
      true,
    );
  });

  it("submits updated values correctly", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole("row");
    const supplierRow = rows.find((r) =>
      r.textContent?.includes("Marcenaria Bela"),
    );
    await user.click(within(supplierRow!).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog");

    // Change to Produtos
    const catTrigger = within(dialog)
      .getAllByRole("combobox")
      .find((t) => t.textContent?.includes(SUPPLIER_TYPE_LABELS.prestadores));
    await user.click(catTrigger!);
    await user.click(
      await screen.findByRole("option", {
        name: SUPPLIER_TYPE_LABELS.produtos,
      }),
    );

    // Select Eletrodomésticos
    const subTrigger = within(dialog)
      .getAllByRole("combobox")
      .find(
        (t) =>
          t.textContent?.includes("Selecione") &&
          !t.hasAttribute("data-disabled"),
      );
    await user.click(subTrigger!);
    await user.click(
      await screen.findByRole("option", { name: "Eletrodomésticos" }),
    );

    await user.click(within(dialog).getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier_type: "produtos",
          supplier_subcategory: "Eletrodomésticos",
        }),
      );
    });
  });
});

describe("Supplier Modal — Legacy Compatibility", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => createMockChain([legacySupplier]));
  });

  it("renders legacy supplier without crashing", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    expect(await screen.findByText("Fornecedor Antigo")).toBeInTheDocument();
  });

  it("opens edit for legacy supplier and shows empty taxonomy", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole("row");
    const legacyRow = rows.find((r) =>
      r.textContent?.includes("Fornecedor Antigo"),
    );
    await user.click(within(legacyRow!).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");
    expect(triggers.some((t) => t.textContent?.includes("Selecione"))).toBe(
      true,
    );
  });

  it("requires taxonomy before saving legacy supplier", async () => {
    const { toast } = await import("@/hooks/use-toast");
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole("row");
    const legacyRow = rows.find((r) =>
      r.textContent?.includes("Fornecedor Antigo"),
    );
    await user.click(within(legacyRow!).getAllByRole("button")[0]);

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /salvar/i }));

    // The legacy `categoria: 'materiais'` infers supplier_type='produtos',
    // so only the subcategory remains missing — that's the gate the user
    // hits when saving an unclassified legacy supplier.
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Subcategoria é obrigatória" }),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("Supplier Modal — Accessibility", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => createMockChain([]));
  });

  it("has associated labels", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Categoria *")).toBeInTheDocument();
    expect(within(dialog).getByText("Subcategoria *")).toBeInTheDocument();
    expect(within(dialog).getByText("Nome *")).toBeInTheDocument();
  });

  it("comboboxes have correct role", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = screen.getByRole("dialog");
    const triggers = within(dialog).getAllByRole("combobox");
    // Should have at least 3 comboboxes: categoria, subcategoria, status
    expect(triggers.length).toBeGreaterThanOrEqual(3);
  });

  it("dialog has proper heading", async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    expect(
      within(screen.getByRole("dialog")).getByText("Novo Fornecedor"),
    ).toBeInTheDocument();
  });
});
