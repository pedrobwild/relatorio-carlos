/**
 * Testes Deno para a edge function `extract-boleto-code`.
 *
 * Cobertura:
 * 1) CORS preflight (OPTIONS) → 200
 * 2) Body inválido (sem fileBase64) → 400
 * 3) LOVABLE_API_KEY ausente → 500
 * 4) Sucesso: tool_call retorna 47 dígitos → resposta { code, raw }
 * 5) Sanitização: tool_call retorna com pontos/espaços → code deve ser apenas dígitos
 * 6) Rate limit do gateway (429) → repassa 429
 * 7) Créditos esgotados (402) → repassa 402
 * 8) IA retorna sem tool_call → code = ''
 *
 * Como rodar:
 *   deno test --allow-net --allow-env --allow-read supabase/functions/extract-boleto-code/index.test.ts
 */

import {
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

// ---------- Helpers ----------

const FUNCTION_PATH = new URL('./index.ts', import.meta.url).href;

const originalFetch: typeof fetch = globalThis.fetch;
let fetchCalls: Array<{ url: string; init?: RequestInit }> = [];

function mockGatewayResponse(payload: unknown, init: ResponseInit = { status: 200 }) {
  fetchCalls = [];
  // @ts-expect-error - sobrescrita global durante o teste
  globalThis.fetch = async (input: string | URL | Request, requestInit?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: requestInit });
    return new Response(JSON.stringify(payload), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  };
}

function makeAiToolCallResponse(code: string) {
  return {
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: {
                name: 'return_boleto_code',
                arguments: JSON.stringify({ code }),
              },
            },
          ],
        },
      },
    ],
  };
}

async function importHandler() {
  // Capturar o handler passado para Deno.serve
  let captured: ((req: Request) => Response | Promise<Response>) | null = null;
  const originalServe = Deno.serve;
  // @ts-expect-error monkey-patch
  Deno.serve = (handler: (req: Request) => Response | Promise<Response>) => {
    captured = handler;
    // Retornar um stub mínimo (não usado nos testes)
    return { finished: Promise.resolve(), shutdown: () => Promise.resolve() } as unknown as ReturnType<typeof Deno.serve>;
  };

  // Importar com cache-buster para garantir re-execução do top-level
  await import(`${FUNCTION_PATH}?t=${Date.now()}`);

  Deno.serve = originalServe;
  if (!captured) throw new Error('Handler não capturado de Deno.serve');
  return captured as (req: Request) => Promise<Response>;
}

function makeRequest(body: unknown, method = 'POST') {
  return new Request('http://local/extract-boleto-code', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'OPTIONS' ? null : JSON.stringify(body),
  });
}

// ---------- Setup global ----------

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// ---------- Tests ----------

Deno.test('CORS preflight responde 200 com headers CORS', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  const handler = await importHandler();

  const res = await handler(new Request('http://local/extract-boleto-code', { method: 'OPTIONS' }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  await res.text(); // consumir body
});

Deno.test('retorna 400 quando fileBase64 está ausente', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  const handler = await importHandler();

  const res = await handler(makeRequest({ mimeType: 'application/pdf' }));
  assertEquals(res.status, 400);
  const body = await res.json();
  assertStringIncludes(body.error, 'fileBase64');
});

Deno.test('retorna 500 quando LOVABLE_API_KEY não está configurada', async () => {
  Deno.env.delete('LOVABLE_API_KEY');
  const handler = await importHandler();

  const res = await handler(
    makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertStringIncludes(body.error, 'LOVABLE_API_KEY');
});

Deno.test('sucesso: extrai código de 47 dígitos via tool_call', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  const expectedCode = '00190000090337447700806550034184489160000045678'; // 47 dígitos
  mockGatewayResponse(makeAiToolCallResponse(expectedCode));

  try {
    const handler = await importHandler();
    const res = await handler(
      makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.code, expectedCode);
    assertEquals(body.raw, expectedCode);

    // Verificar que o gateway foi chamado com tool_choice e modelo correto
    assertEquals(fetchCalls.length, 1);
    const sent = JSON.parse(fetchCalls[0].init?.body as string);
    assertEquals(sent.model, 'google/gemini-2.5-flash');
    assertEquals(sent.tool_choice.function.name, 'return_boleto_code');
  } finally {
    restoreFetch();
  }
});

Deno.test('sanitiza pontos e espaços do código retornado pela IA', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  const noisy = '00190.00009 03374.477008 06550.034184 4 89160000045678';
  mockGatewayResponse(makeAiToolCallResponse(noisy));

  try {
    const handler = await importHandler();
    const res = await handler(
      makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
    );
    const body = await res.json();
    assertEquals(body.code, '00190000090337447700806550034184489160000045678');
    assertEquals(body.raw, noisy);
  } finally {
    restoreFetch();
  }
});

Deno.test('repassa 429 quando o gateway retorna rate limit', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  mockGatewayResponse({ error: 'rate limited' }, { status: 429 });

  try {
    const handler = await importHandler();
    const res = await handler(
      makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
    );
    assertEquals(res.status, 429);
    const body = await res.json();
    assertStringIncludes(body.error.toLowerCase(), 'requisi');
  } finally {
    restoreFetch();
  }
});

Deno.test('repassa 402 quando créditos da IA estão esgotados', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  mockGatewayResponse({ error: 'payment required' }, { status: 402 });

  try {
    const handler = await importHandler();
    const res = await handler(
      makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
    );
    assertEquals(res.status, 402);
    const body = await res.json();
    assertStringIncludes(body.error.toLowerCase(), 'crédito');
  } finally {
    restoreFetch();
  }
});

Deno.test('retorna code vazio quando IA não invoca a tool', async () => {
  Deno.env.set('LOVABLE_API_KEY', 'test-key');
  mockGatewayResponse({ choices: [{ message: { content: 'não consegui ler' } }] });

  try {
    const handler = await importHandler();
    const res = await handler(
      makeRequest({ fileBase64: 'data:application/pdf;base64,JVBERi1m', mimeType: 'application/pdf' }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.code, '');
  } finally {
    restoreFetch();
  }
});
