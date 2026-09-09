import { describe, expect, it, vi } from "vitest";

vi.mock("@/infra/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getSession: vi.fn() },
  },
}));

import { readFunctionError } from "@/infra/edgeFunctions";

/**
 * `supabase.functions.invoke` transforma qualquer resposta não-2xx em um
 * FunctionsHttpError com mensagem genérica em inglês. A mensagem que o usuário
 * precisa ler está no corpo JSON da Response guardada em `context`.
 */
describe("readFunctionError", () => {
  it("usa a mensagem do corpo da edge function em vez da genérica", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response(
        JSON.stringify({ error: "Serviço de IA não configurado (ANTHROPIC_API_KEY)" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    };

    await expect(readFunctionError(error)).resolves.toBe(
      "Serviço de IA não configurado (ANTHROPIC_API_KEY)",
    );
  });

  it("não consome o corpo da Response original", async () => {
    const context = new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
      status: 402,
    });
    const error = { message: "generic", context };

    await readFunctionError(error);

    expect(context.bodyUsed).toBe(false);
  });

  it("cai na mensagem do erro quando o corpo não traz 'error'", async () => {
    const error = {
      message: "Failed to fetch",
      context: new Response(JSON.stringify({ ok: true }), { status: 500 }),
    };

    await expect(readFunctionError(error)).resolves.toBe("Failed to fetch");
  });

  it("cai na mensagem do erro quando o corpo não é JSON", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: new Response("<html>502</html>", { status: 502 }),
    };

    await expect(readFunctionError(error)).resolves.toBe(
      "Edge Function returned a non-2xx status code",
    );
  });

  it("usa o fallback quando não há contexto nem mensagem", async () => {
    await expect(readFunctionError({}, "Erro ao importar orçamento")).resolves.toBe(
      "Erro ao importar orçamento",
    );
    await expect(readFunctionError(null, "Erro ao importar orçamento")).resolves.toBe(
      "Erro ao importar orçamento",
    );
  });
});
