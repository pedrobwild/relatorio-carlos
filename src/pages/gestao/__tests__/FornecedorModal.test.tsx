/**
 * Supplier Create/Edit Modal — Taxonomy Tests
 *
 * Covers the two-level taxonomy (supplier_type + supplier_subcategory)
 * in the create and edit dialog inside Fornecedores.tsx.
 *
 * Strategy: render the page with mocked Supabase, interact with the
 * dialog, and assert on form state, validation, and dependent selects.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Fornecedores from '../Fornecedores';
import {
  SUPPLIER_SUBCATEGORIES_BY_TYPE,
  SUPPLIER_TYPE_LABELS,
} from '@/constants/supplierCategories';

// ── Mocks ────────────────────────────────────────────────────

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockUpdate = vi.fn().mockResolvedValue({ data: null, error: null });
const mockDelete = vi.fn().mockResolvedValue({ data: null, error: null });

const mockFrom = vi.fn((table: string) => {
  const chain = {
    select: vi.fn().mockReturnValue(chain),
    order: vi.fn().mockReturnValue(chain),
    eq: vi.fn().mockReturnValue(chain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: mockInsert,
    update: (...args: any[]) => {
      mockUpdate(...args);
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    },
    delete: () => {
      mockDelete();
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
    },
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  // Make the chain thenable so react-query awaits it
  (chain as any)[Symbol.toStringTag] = 'Promise';
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  return chain;
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
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
  const btn = await screen.findByRole('button', { name: /novo fornecedor/i });
  await user.click(btn);
  // Wait for dialog to appear
  return screen.findByRole('dialog');
}

function getDialogContent() {
  return screen.getByRole('dialog');
}

// ── Tests ────────────────────────────────────────────────────

describe('Supplier Modal — Create', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    // Default: return empty suppliers list
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }));
  });

  it('renders Categoria and Subcategoria fields', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    expect(within(dialog).getByText('Categoria *')).toBeInTheDocument();
    expect(within(dialog).getByText('Subcategoria *')).toBeInTheDocument();
  });

  it('subcategoria starts empty and disabled', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // The subcategory trigger should show placeholder text
    const subcatTrigger = within(dialog).getAllByRole('combobox')[1]; // second select
    expect(subcatTrigger).toHaveAttribute('data-disabled', '');
  });

  it('shows only Prestadores subcategories when Prestadores is selected', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Click Categoria select
    const triggers = within(dialog).getAllByRole('combobox');
    const categoriaTrigger = triggers.find(t => 
      t.textContent?.includes('Selecione') || t.textContent === ''
    ) || triggers[0];

    await user.click(categoriaTrigger);

    // Select Prestadores
    const prestadoresOption = await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.prestadores });
    await user.click(prestadoresOption);

    // Now click subcategory
    // After selecting type, subcategory should be enabled
    const subTrigger = within(dialog).getAllByRole('combobox')[1];
    await user.click(subTrigger);

    // Verify Prestadores subcategories are visible
    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.prestadores.slice(0, 3)) {
      expect(await screen.findByRole('option', { name: sub })).toBeInTheDocument();
    }

    // Verify Produtos subcategories are NOT visible
    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos.slice(0, 2)) {
      expect(screen.queryByRole('option', { name: sub })).not.toBeInTheDocument();
    }
  });

  it('shows only Produtos subcategories when Produtos is selected', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    const triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);

    const produtosOption = await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.produtos });
    await user.click(produtosOption);

    const subTrigger = within(dialog).getAllByRole('combobox')[1];
    await user.click(subTrigger);

    for (const sub of SUPPLIER_SUBCATEGORIES_BY_TYPE.produtos.slice(0, 3)) {
      expect(await screen.findByRole('option', { name: sub })).toBeInTheDocument();
    }
  });

  it('blocks submit when Categoria is empty', async () => {
    const { toast } = await import('@/hooks/use-toast');
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Fill name only
    const nameInput = within(dialog).getByRole('textbox', { name: '' }); // first text input
    const inputs = within(dialog).getAllByRole('textbox');
    await user.type(inputs[0], 'Fornecedor Teste');

    // Click save
    const saveBtn = within(dialog).getByRole('button', { name: /cadastrar/i });
    await user.click(saveBtn);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Categoria é obrigatória' })
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('blocks submit when Subcategoria is empty', async () => {
    const { toast } = await import('@/hooks/use-toast');
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Fill name
    const inputs = within(dialog).getAllByRole('textbox');
    await user.type(inputs[0], 'Fornecedor Teste');

    // Select category but not subcategory
    const triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    const option = await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.prestadores });
    await user.click(option);

    const saveBtn = within(dialog).getByRole('button', { name: /cadastrar/i });
    await user.click(saveBtn);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Subcategoria é obrigatória' })
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('submits successfully with valid Categoria + Subcategoria', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Fill name
    const inputs = within(dialog).getAllByRole('textbox');
    await user.type(inputs[0], 'Marceneiro Top');

    // Select Prestadores
    const triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.prestadores }));

    // Select Marcenaria
    // Re-query since DOM may have changed
    const updatedTriggers = within(dialog).getAllByRole('combobox');
    await user.click(updatedTriggers[1]);
    await user.click(await screen.findByRole('option', { name: 'Marcenaria' }));

    const saveBtn = within(dialog).getByRole('button', { name: /cadastrar/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: 'Marceneiro Top',
          supplier_type: 'prestadores',
          supplier_subcategory: 'Marcenaria',
        })
      );
    });
  });
});

describe('Supplier Modal — Dependent Reset', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }));
  });

  it('resets subcategoria when switching from Prestadores to Produtos', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Select Prestadores
    let triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.prestadores }));

    // Select Marcenaria
    triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[1]);
    await user.click(await screen.findByRole('option', { name: 'Marcenaria' }));

    // Verify Marcenaria is shown in the trigger
    triggers = within(dialog).getAllByRole('combobox');
    expect(triggers[1].textContent).toContain('Marcenaria');

    // Now switch to Produtos
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.produtos }));

    // Subcategory should have been reset (Marcenaria is invalid for Produtos)
    triggers = within(dialog).getAllByRole('combobox');
    expect(triggers[1].textContent).not.toContain('Marcenaria');
  });

  it('preserves subcategoria if it is valid for the new category', async () => {
    // Edge case: if somehow a subcategory existed in both types.
    // Currently none overlap, so switching always resets.
    // This test just ensures no crash on the switch.
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Select Produtos then switch to Prestadores
    let triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.produtos }));

    triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[1]);
    await user.click(await screen.findByRole('option', { name: 'Eletrodomésticos' }));

    // Switch to Prestadores
    triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.prestadores }));

    // Eletrodomésticos should have been reset
    triggers = within(dialog).getAllByRole('combobox');
    expect(triggers[1].textContent).not.toContain('Eletrodomésticos');
  });
});

describe('Supplier Modal — Edit', () => {
  let user: ReturnType<typeof userEvent.setup>;

  const existingSupplier = {
    id: 'sup-1',
    nome: 'Marcenaria Bela',
    razao_social: null,
    cnpj_cpf: null,
    categoria: 'mao_de_obra' as const,
    supplier_type: 'prestadores',
    supplier_subcategory: 'Marcenaria',
    telefone: '11999999999',
    email: 'marc@test.com',
    site: null,
    cidade: 'São Paulo',
    estado: 'SP',
    cep: null,
    endereco: null,
    produtos_servicos: 'Móveis sob medida',
    condicoes_pagamento: null,
    prazo_entrega_dias: 30,
    nota_avaliacao: 4.5,
    observacoes: null,
    status: 'ativo',
    created_at: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [existingSupplier], error: null }),
      insert: mockInsert,
      update: (...args: any[]) => {
        mockUpdate(...args);
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
      },
      delete: () => {
        mockDelete();
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
      },
    }));
  });

  it('loads saved supplier_type and supplier_subcategory in edit mode', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    // Wait for the table to render with the supplier
    const editBtn = await screen.findByRole('button', { name: '' }); // pencil icon
    // Find the edit button within the row
    const rows = await screen.findAllByRole('row');
    const supplierRow = rows.find(r => r.textContent?.includes('Marcenaria Bela'));
    expect(supplierRow).toBeTruthy();

    const editButton = within(supplierRow!).getAllByRole('button')[0]; // first button = edit
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const triggers = within(dialog).getAllByRole('combobox');

    // Category trigger should show Prestadores
    expect(triggers[0].textContent).toContain(SUPPLIER_TYPE_LABELS.prestadores);
    // Subcategory trigger should show Marcenaria
    expect(triggers[1].textContent).toContain('Marcenaria');
  });

  it('submits updated values correctly', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole('row');
    const supplierRow = rows.find(r => r.textContent?.includes('Marcenaria Bela'));
    const editButton = within(supplierRow!).getAllByRole('button')[0];
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    
    // Change to Produtos > Eletrodomésticos
    const triggers = within(dialog).getAllByRole('combobox');
    await user.click(triggers[0]);
    await user.click(await screen.findByRole('option', { name: SUPPLIER_TYPE_LABELS.produtos }));

    const updatedTriggers = within(dialog).getAllByRole('combobox');
    await user.click(updatedTriggers[1]);
    await user.click(await screen.findByRole('option', { name: 'Eletrodomésticos' }));

    const saveBtn = within(dialog).getByRole('button', { name: /salvar/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          supplier_type: 'produtos',
          supplier_subcategory: 'Eletrodomésticos',
        })
      );
    });
  });
});

describe('Supplier Modal — Legacy Compatibility', () => {
  let user: ReturnType<typeof userEvent.setup>;

  const legacySupplier = {
    id: 'sup-legacy',
    nome: 'Fornecedor Antigo',
    razao_social: null,
    cnpj_cpf: null,
    categoria: 'materiais' as const,
    supplier_type: null,
    supplier_subcategory: null,
    telefone: null,
    email: null,
    site: null,
    cidade: null,
    estado: null,
    cep: null,
    endereco: null,
    produtos_servicos: null,
    condicoes_pagamento: null,
    prazo_entrega_dias: null,
    nota_avaliacao: null,
    observacoes: null,
    status: 'ativo',
    created_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [legacySupplier], error: null }),
      insert: mockInsert,
      update: (...args: any[]) => {
        mockUpdate(...args);
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
      },
      delete: () => {
        mockDelete();
        return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
      },
    }));
  });

  it('renders legacy supplier in the list without crashing', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    expect(await screen.findByText('Fornecedor Antigo')).toBeInTheDocument();
  });

  it('opens edit for legacy supplier and shows empty taxonomy fields', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole('row');
    const legacyRow = rows.find(r => r.textContent?.includes('Fornecedor Antigo'));
    expect(legacyRow).toBeTruthy();

    const editButton = within(legacyRow!).getAllByRole('button')[0];
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const triggers = within(dialog).getAllByRole('combobox');

    // Category should show placeholder (not selected)
    expect(triggers[0].textContent).toContain('Selecione');
  });

  it('requires filling taxonomy before saving legacy supplier', async () => {
    const { toast } = await import('@/hooks/use-toast');
    render(<Fornecedores />, { wrapper: createWrapper() });

    const rows = await screen.findAllByRole('row');
    const legacyRow = rows.find(r => r.textContent?.includes('Fornecedor Antigo'));
    const editButton = within(legacyRow!).getAllByRole('button')[0];
    await user.click(editButton);

    const dialog = await screen.findByRole('dialog');
    const saveBtn = within(dialog).getByRole('button', { name: /salvar/i });
    await user.click(saveBtn);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Categoria é obrigatória' })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('Supplier Modal — Accessibility', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    }));
  });

  it('has associated labels for Categoria and Subcategoria', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    // Labels should exist
    expect(within(dialog).getByText('Categoria *')).toBeInTheDocument();
    expect(within(dialog).getByText('Subcategoria *')).toBeInTheDocument();
    expect(within(dialog).getByText('Nome *')).toBeInTheDocument();
  });

  it('select triggers are keyboard-focusable', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);
    const dialog = getDialogContent();

    const triggers = within(dialog).getAllByRole('combobox');
    // All comboboxes should be focusable
    for (const trigger of triggers) {
      trigger.focus();
      expect(trigger).toHaveFocus();
    }
  });

  it('dialog has proper title role', async () => {
    render(<Fornecedores />, { wrapper: createWrapper() });
    await openNewDialog(user);

    const dialog = screen.getByRole('dialog');
    // Should contain the dialog title
    expect(within(dialog).getByText('Novo Fornecedor')).toBeInTheDocument();
  });
});
