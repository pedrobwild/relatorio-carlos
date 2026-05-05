import { corsResponse, jsonResponse } from '../_shared/cors.ts';

interface ContractParseResult {
  customer: {
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    nacionalidade: string | null;
    estado_civil: string | null;
    profissao: string | null;
    cpf: string | null;
    rg: string | null;
    endereco_residencial: string | null;
    cidade: string | null;
    estado: string | null;
  };
  studio: {
    nome_do_empreendimento: string | null;
    endereco_completo: string | null;
    bairro: string | null;
    cidade: string | null;
    cep: string | null;
    complemento: string | null;
    tamanho_imovel_m2: string | null;
    tipo_de_locacao: string | null;
    data_recebimento_chaves: string | null;
    unit_name: string | null;
  };
  commercial: {
    contract_value: string | null;
    payment_method: string | null;
    payment_schedule: Array<{ description: string; value: number; due_date: string | null }>;
    contract_signed_at: string | null;
    document_type: string;
  };
  project: {
    suggested_project_name: string | null;
  };
  confidence: Record<string, number>;
  conflicts: Array<{ field: string; values: string[]; reason: string }>;
  missing_fields: string[];
}

const SYSTEM_PROMPT = `Você é um extrator de dados contratuais especializado em contratos de reforma e construção civil, especialmente da BWild Arquitetura e Reformas.

INSTRUÇÕES:
1. Extraia TODOS os dados estruturados do contrato PDF fornecido.
2. Priorize a qualificação formal das partes (CONTRATANTE e CONTRATADA).
3. Também analise ANEXOS quando trouxerem informações de unidade, metragem ou endereço do imóvel.
4. Use null para qualquer campo sem informação confiável — NUNCA invente dados.
5. Datas devem estar no formato YYYY-MM-DD.
6. Valores monetários devem ser numéricos em string, sem R$ ou pontos de milhar (ex: "85000.00").
7. CPF deve manter formato original com pontuação se presente.
8. Para metragem (tamanho_imovel_m2), extrair apenas o número.
9. Se encontrar informações conflitantes entre corpo do contrato e anexos, liste em "conflicts".
10. Liste campos que não foram encontrados em "missing_fields" usando os nomes dos campos do JSON.
11. Em "confidence", atribua de 0.0 a 1.0 para cada campo preenchido.

ATENÇÃO ESPECIAL — DADOS DO IMÓVEL (seção "studio"):
Os dados do imóvel a ser reformado frequentemente NÃO estão em uma seção separada.
Eles costumam aparecer em parágrafos descritivos como:
- "Imóvel-apartamento de nº 1014 ... empreendimento denominado Exalt Ibirapuera By EZ, na R. Borges Lagoa, 232 - Vila Clementino, São Paulo - SP, 04038-000"
- "unidade autônoma nº ... localizada no condomínio ..."
Você DEVE extrair desses parágrafos:
- nome_do_empreendimento: nome do edifício/condomínio (ex: "Exalt Ibirapuera By EZ")
- unit_name: número do apartamento/unidade (ex: "1014")
- endereco_completo: rua e número (ex: "R. Borges Lagoa, 232")
- bairro: bairro mencionado (ex: "Vila Clementino")
- cidade: cidade (ex: "São Paulo")
- cep: CEP se presente (ex: "04038-000")
NÃO confunda endereço residencial do contratante com endereço do imóvel da obra.

CAMPOS A EXTRAIR:

customer: dados do CONTRATANTE (pessoa que contrata a reforma)
- customer_name: nome completo
- customer_email: e-mail
- customer_phone: telefone/celular
- nacionalidade, estado_civil, profissao
- cpf, rg
- endereco_residencial: endereço residencial completo
- cidade, estado: da residência

studio: dados do IMÓVEL a ser reformado (pode diferir da residência do contratante)
- nome_do_empreendimento: nome do edifício/condomínio
- endereco_completo: endereço do imóvel
- bairro, cidade, cep, complemento
- tamanho_imovel_m2: metragem (apenas número)
- tipo_de_locacao: classificar em Residencial, Comercial, Apartamento, Casa, Studio, Cobertura ou Sala Comercial
- data_recebimento_chaves: formato YYYY-MM-DD
- unit_name: identificação da unidade (ex: "Apto 502")

commercial: dados financeiros
- contract_value: valor total como string numérica
- payment_method: pix, boleto, transferencia, cartao, financiamento ou outro
- payment_schedule: array de parcelas [{description, value, due_date}]
- contract_signed_at: data de assinatura YYYY-MM-DD
- document_type: sempre "contrato_cliente"

project:
- suggested_project_name: sugerir nome para o projeto baseado no empreendimento + unidade

Retorne APENAS JSON válido, sem markdown ou texto adicional.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const contentType = req.headers.get('content-type') || '';

    let fileBase64 = '';
    let fileName = 'contract.pdf';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return jsonResponse({ error: 'Nenhum arquivo enviado' }, 400);
      }

      if (file.size > 20 * 1024 * 1024) {
        return jsonResponse({ error: 'Arquivo excede 20MB' }, 400);
      }
      if (!file.type.includes('pdf')) {
        return jsonResponse({ error: 'Apenas arquivos PDF são aceitos' }, 400);
      }

      fileName = file.name;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileBase64 = btoa(binary);
    } else {
      const body = await req.json();
      if (!body.file_base64) {
        return jsonResponse({ error: 'Arquivo não fornecido' }, 400);
      }
      fileBase64 = body.file_base64;
      fileName = body.file_name || 'contract.pdf';
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'Serviço de IA não configurado (ANTHROPIC_API_KEY)' }, 500);
    }

    // Claude supports native PDF via base64 document type — no truncation needed
    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: fileBase64,
                },
              },
              {
                type: 'text',
                text: `Analise o contrato PDF "${fileName}" acima e extraia os dados estruturados conforme o formato especificado. Retorne APENAS o JSON.`,
              },
            ],
          },
        ],
        temperature: 0.05,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Anthropic API error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return jsonResponse({ error: 'Serviço sobrecarregado. Tente novamente em alguns segundos.' }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: 'Créditos de IA esgotados.' }, 402);
      }

      return jsonResponse({ error: 'Falha na análise do contrato' }, 500);
    }

    const aiResult = await aiResponse.json();
    // Anthropic response format: { content: [{ type: "text", text: "..." }] }
    const content = aiResult.content?.[0]?.text;

    if (!content) {
      return jsonResponse({ error: 'Resposta vazia da IA' }, 500);
    }

    let parsed: ContractParseResult;
    try {
      // Strip markdown code fences if present
      const cleanContent = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error('Failed to parse AI response as JSON:', content.substring(0, 500));
      return jsonResponse({ error: 'Resposta da IA em formato inválido' }, 500);
    }

    // Ensure required structure
    const result: ContractParseResult = {
      customer: {
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        nacionalidade: null,
        estado_civil: null,
        profissao: null,
        cpf: null,
        rg: null,
        endereco_residencial: null,
        cidade: null,
        estado: null,
        ...parsed.customer,
      },
      studio: {
        nome_do_empreendimento: null,
        endereco_completo: null,
        bairro: null,
        cidade: null,
        cep: null,
        complemento: null,
        tamanho_imovel_m2: null,
        tipo_de_locacao: null,
        data_recebimento_chaves: null,
        unit_name: null,
        ...parsed.studio,
      },
      commercial: {
        contract_value: null,
        payment_method: null,
        payment_schedule: [],
        contract_signed_at: null,
        document_type: 'contrato_cliente',
        ...parsed.commercial,
      },
      project: {
        suggested_project_name: null,
        ...parsed.project,
      },
      confidence: parsed.confidence || {},
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      missing_fields: Array.isArray(parsed.missing_fields) ? parsed.missing_fields : [],
    };

    console.log('parse-contract-prefill completed, fields extracted:', Object.keys(result.studio || {}).length, 'studio,', Object.keys(result.customer || {}).length, 'customer');
    return jsonResponse({ success: true, data: result });
  } catch (error) {
    console.error('parse-contract-prefill error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erro desconhecido' }, 500);
  }
});
