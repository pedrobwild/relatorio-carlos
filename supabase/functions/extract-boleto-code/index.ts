// Edge function: extract-boleto-code
// Recebe um arquivo (PDF/imagem) em base64 e usa IA (Lovable AI Gateway) para extrair a linha digitável do boleto.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  fileBase64: string; // dataURL completo (data:application/pdf;base64,...) ou só base64
  mimeType: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fileBase64, mimeType } = (await req.json()) as RequestBody;

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "fileBase64 e mimeType são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Garantir prefixo dataURL
    const dataUrl = fileBase64.startsWith("data:")
      ? fileBase64
      : `data:${mimeType};base64,${fileBase64}`;

    const systemPrompt =
      "Você é um extrator OCR de boletos bancários brasileiros. Sua única tarefa é localizar e retornar a LINHA DIGITÁVEL do boleto (47 ou 48 dígitos numéricos, podendo conter pontos e espaços). Ignore tudo o mais. Se não encontrar, retorne string vazia.";

    const userText =
      "Extraia a linha digitável deste boleto. Retorne SOMENTE o número (pode conter pontos e espaços, sem letras ou texto adicional). Se for um documento que não é boleto ou não houver linha digitável visível, retorne string vazia.";

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_boleto_code",
              description: "Retorna a linha digitável extraída do boleto",
              parameters: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    description:
                      "Linha digitável do boleto, apenas dígitos (47 ou 48 caracteres). String vazia se não encontrada.",
                  },
                },
                required: ["code"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_boleto_code" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos da IA esgotados. Adicione créditos no workspace Lovable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let code = "";
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        code = (args?.code || "").toString();
      } catch (e) {
        console.error("Falha ao parsear arguments do tool call", e);
      }
    }

    // Sanitizar: remover tudo que não é dígito
    const digitsOnly = code.replace(/\D/g, "");

    return new Response(JSON.stringify({ code: digitsOnly, raw: code }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-boleto-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
