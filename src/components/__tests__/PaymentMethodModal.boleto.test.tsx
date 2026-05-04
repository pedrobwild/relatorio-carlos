/**
 * Testes do fluxo de anexar boleto + extração via IA no PaymentMethodModal.
 *
 * Fluxo coberto:
 * 1) Usuário seleciona arquivo → upload para storage (mock) ✓
 * 2) Após upload, edge function `extract-boleto-code` é invocada com base64 + mimeType ✓
 * 3) Quando a IA retorna `code` válido (>=47 dígitos), o input boleto_code é preenchido
 *    automaticamente e persistido via `update` em project_payments ✓
 * 4) Quando a IA retorna parcialmente, mostra aviso e preenche parcial ✓
 * 5) Quando a IA falha (erro), exibe erro e não persiste ✓
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ----- Mocks devem ser declarados ANTES dos imports do componente -----
// Usamos vi.hoisted para que as referências fiquem disponíveis dentro das factories.

const h = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockUpdateEq: vi.fn(),
  mockFromUpdate: vi.fn(),
  mockFunctionsInvoke: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastWarning: vi.fn(),
  mockToastInfo: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: h.mockUpload,
        remove: vi.fn().mockResolvedValue({ error: null }),
        download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      })),
    },
    from: vi.fn(() => ({
      update: h.mockFromUpdate,
    })),
    functions: {
      invoke: h.mockFunctionsInvoke,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => h.mockToastSuccess(...a),
    warning: (...a: unknown[]) => h.mockToastWarning(...a),
    info: (...a: unknown[]) => h.mockToastInfo(...a),
    error: (...a: unknown[]) => h.mockToastError(...a),
  },
}));

vi.mock("@/lib/errorLogger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

// validateBoletoLine has its own dedicated tests (boletoValidation.test.ts).
// Here we only care about the upload + extract + persist flow, so we stub it
// to accept any 47+ digit string as a valid cobrança boleto.
vi.mock("@/lib/boletoValidation", () => ({
  validateBoletoLine: (raw: string) => {
    const digits = (raw ?? "").replace(/\D/g, "");
    if (digits.length === 0) {
      return { valid: false, error: "vazio" };
    }
    if (digits.length < 47) {
      return { valid: false, error: "curto", digits };
    }
    return { valid: true, type: "cobranca", digits };
  },
}));

// ----- Imports após mocks -----
import { PaymentMethodModal } from "@/components/PaymentMethodModal";

// ----- Helpers -----

function renderModal(
  overrides: Partial<React.ComponentProps<typeof PaymentMethodModal>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const props: React.ComponentProps<typeof PaymentMethodModal> = {
    open: true,
    onOpenChange: vi.fn(),
    paymentId: "pay-123",
    projectId: "proj-abc",
    installmentNumber: 1,
    description: "Parcela teste",
    initialMethod: "boleto",
    initialPixKey: null,
    initialBoletoCode: null,
    initialBoletoPath: null,
    onSaved: vi.fn(),
    ...overrides,
  };

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <PaymentMethodModal {...props} />
    </QueryClientProvider>,
  );
  return { ...utils, props };
}

function makePdfFile() {
  return new File(["%PDF-fake-bytes"], "boleto.pdf", {
    type: "application/pdf",
  });
}

// jsdom não tem FileReader.readAsDataURL retornando dataURL real — patch
beforeEach(() => {
  vi.clearAllMocks();
  // Reconfigurar a chain do `update(...).eq(...)` após cada clearAllMocks
  h.mockFromUpdate.mockImplementation(() => ({ eq: h.mockUpdateEq }));
  h.mockUpload.mockResolvedValue({
    data: { path: "proj-abc/pay-123.pdf" },
    error: null,
  });
  h.mockUpdateEq.mockResolvedValue({ error: null });

  class StubFileReader {
    onload: ((ev: ProgressEvent<FileReader>) => void) | null = null;
    onerror: ((ev: ProgressEvent<FileReader>) => void) | null = null;
    result: string | ArrayBuffer | null = null;
    readAsDataURL(_file: Blob) {
      this.result = "data:application/pdf;base64,JVBERi1mYWtl";
      // Disparar de forma assíncrona, como o real
      setTimeout(() => this.onload?.({} as ProgressEvent<FileReader>), 0);
    }
  }
  // @ts-expect-error stub global
  global.FileReader = StubFileReader;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ----- Testes -----

describe("PaymentMethodModal — fluxo de boleto + IA", () => {
  it("faz upload, invoca a edge function com base64 + mimeType e preenche boleto_code quando IA retorna 47+ dígitos", async () => {
    const aiCode = "00190000090337447700806550034184489160000045678"; // 47 dígitos
    h.mockFunctionsInvoke.mockResolvedValue({
      data: { code: aiCode, raw: aiCode },
      error: null,
    });

    const { container } = renderModal();

    const file = makePdfFile();
    const input = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    fireEvent.change(input, { target: { files: [file] } });

    // 1) Upload chamado
    await waitFor(() => {
      expect(h.mockUpload).toHaveBeenCalledTimes(1);
      const [path, uploadedFile] = h.mockUpload.mock.calls[0];
      expect(path).toBe("proj-abc/pay-123.pdf");
      expect(uploadedFile).toBe(file);
    });

    // 2) Edge function invocada com payload correto
    await waitFor(() => {
      expect(h.mockFunctionsInvoke).toHaveBeenCalledWith(
        "extract-boleto-code",
        {
          body: {
            fileBase64: "data:application/pdf;base64,JVBERi1mYWtl",
            mimeType: "application/pdf",
          },
        },
      );
    });

    // 3) project_payments.update chamado com boleto_code extraído (apenas dígitos)
    await waitFor(() => {
      expect(h.mockFromUpdate).toHaveBeenCalledWith({ boleto_code: aiCode });
      expect(h.mockUpdateEq).toHaveBeenCalledWith("id", "pay-123");
    });

    // 4) Toast de sucesso da extração
    await waitFor(() => {
      expect(h.mockToastSuccess).toHaveBeenCalledWith(
        expect.stringMatching(/extraído/i),
      );
    });

    // 5) Input do código do boleto deve ter o valor formatado
    const codeInput = screen.getByLabelText(
      /Código do boleto/i,
    ) as HTMLInputElement;
    const onlyDigits = codeInput.value.replace(/\D/g, "");
    expect(onlyDigits).toBe(aiCode);
  });

  it("mostra aviso e preenche parcialmente quando IA retorna menos de 47 dígitos", async () => {
    const partial = "12345";
    h.mockFunctionsInvoke.mockResolvedValue({
      data: { code: partial },
      error: null,
    });

    const { container } = renderModal();
    const input = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makePdfFile()] } });

    await waitFor(() => expect(h.mockFunctionsInvoke).toHaveBeenCalled());

    await waitFor(() => {
      expect(h.mockToastWarning).toHaveBeenCalledWith(
        expect.stringMatching(/parcial/i),
      );
    });
    // Não deve persistir boleto_code (apenas persiste quando >=47)
    expect(h.mockFromUpdate).not.toHaveBeenCalledWith({ boleto_code: partial });
  });

  it("mostra info quando IA retorna string vazia", async () => {
    h.mockFunctionsInvoke.mockResolvedValue({
      data: { code: "" },
      error: null,
    });

    const { container } = renderModal();
    const input = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makePdfFile()] } });

    await waitFor(() => expect(h.mockFunctionsInvoke).toHaveBeenCalled());
    await waitFor(() => {
      expect(h.mockToastInfo).toHaveBeenCalledWith(
        expect.stringMatching(/manualmente/i),
      );
    });
    expect(h.mockFromUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ boleto_code: expect.anything() }),
    );
  });

  it("exibe erro e não persiste quando a edge function falha", async () => {
    h.mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("AI gateway down"),
    });

    const { container } = renderModal();
    const input = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makePdfFile()] } });

    await waitFor(() => expect(h.mockFunctionsInvoke).toHaveBeenCalled());
    await waitFor(() => {
      expect(h.mockToastError).toHaveBeenCalledWith(
        expect.stringMatching(/extrair/i),
      );
    });
    expect(h.mockFromUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ boleto_code: expect.anything() }),
    );
  });

  it("não invoca a edge function se o upload falhar", async () => {
    h.mockUpload.mockResolvedValue({
      data: null,
      error: new Error("storage 500"),
    });

    const { container } = renderModal();
    const input = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makePdfFile()] } });

    await waitFor(() => expect(h.mockUpload).toHaveBeenCalled());
    // Pequeno delay para garantir que o invoke não foi chamado por engano
    await new Promise((r) => setTimeout(r, 50));
    expect(h.mockFunctionsInvoke).not.toHaveBeenCalled();
  });
});
