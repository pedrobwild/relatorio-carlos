import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface ParsedSection {
  title: string;
  order_index: number;
  section_price: number | null;
  is_optional: boolean;
  items: ParsedItem[];
}

interface ParsedItem {
  title: string;
  description: string | null;
  qty: number | null;
  unit: string | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  bdi_percentage: number;
  order_index: number;
  item_category: string | null;
}

/** Base64 em blocos — evita montar a string byte a byte em arquivos grandes. */
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Aceita 1234.56, "1.234,56", "R$ 1.234,56" e devolve número ou null. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[^\d,.-]/g, '').trim();
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized: string;

  if (lastComma > lastDot) {
    // Formato pt-BR: ponto é milhar, vírgula é decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato en-US: vírgula é milhar
    normalized = cleaned.replace(/,/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Normaliza texto vindo da IA — que às vezes devolve número onde pedimos string. */
function toText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

const SYSTEM_PROMPT = `Você é um especialista em orçamentos de reforma e construção civil.
Analise o orçamento fornecido e extraia TODOS os itens organizados em seções.

Retorne um JSON com o seguinte formato:
{
  "sections": [
    {
      "title": "Nome da Seção (ex: Marcenaria, Elétrica, Hidráulica, Pintura)",
      "order_index": 0,
      "section_price": 24900.00,
      "is_optional": false,
      "items": [
        {
          "title": "Nome do item",
          "description": "Descrição detalhada ou null",
          "qty": 1,
          "unit": "un",
          "internal_unit_price": 3500.00,
          "internal_total": 3500.00,
          "bdi_percentage": 0,
          "order_index": 0,
          "item_category": "Produto"
        }
      ]
    }
  ]
}

REGRAS:
- Use as seções do próprio documento quando existirem; só agrupe por conta própria (Marcenaria, Elétrica, Hidráulica, Pintura, Revestimentos, etc.) se o orçamento não trouxer divisões.
- Extraia CADA item individualmente com nome, quantidade, unidade e preço. Não resuma, não agrupe itens distintos e não invente itens.
- Se o item é um produto/material, item_category = "Produto"
- Se o item é mão de obra/serviço, item_category = "Prestador"
- Marque is_optional = true em seções apresentadas como opcionais/alternativas/"a critério do cliente"
- section_price deve ser a soma dos internal_total dos itens da seção
- Se não encontrar preço unitário mas encontrar total, calcule o unitário dividindo pela quantidade
- Se não encontrar quantidade, use 1
- Valores numéricos devem ser números puros (3500.00), sem "R$" e sem separador de milhar
- Unidades comuns: un, m², m, m³, kg, cx, pc, rolo, vb (verba), cj (conjunto)
- Mantenha a ordem original do documento
- Ignore capa, condições comerciais, formas de pagamento e textos jurídicos — extraia apenas o escopo orçado
- Retorne APENAS o JSON, sem texto adicional e sem blocos de código`;

interface StreamEvent {
  type?: string;
  delta?: { type?: string; text?: string; stop_reason?: string };
  error?: { message?: string };
}

/** Consome o SSE da Anthropic e devolve o texto concatenado + stop_reason. */
async function readAnthropicStream(
  body: ReadableStream<Uint8Array>,
): Promise<{ text: string; stopReason: string | null }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let stopReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      let event: StreamEvent;
      try {
        event = JSON.parse(payload) as StreamEvent;
      } catch {
        continue;
      }

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text ?? '';
      } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
        stopReason = event.delta.stop_reason;
      } else if (event.type === 'error') {
        throw new Error(event.error?.message || 'Erro no streaming da IA');
      }
    }
  }

  return { text, stopReason };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { project_id, storage_path, project_name, client_name } = await req.json();
    if (!project_id || !storage_path) {
      return jsonResponse({ error: 'project_id and storage_path are required' }, 400);
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return jsonResponse({ error: 'Serviço de IA não configurado (ANTHROPIC_API_KEY)' }, 500);
    }

    // Download file
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('project-documents')
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return jsonResponse({ error: 'Não foi possível ler o arquivo enviado' }, 500);
    }

    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) {
      return jsonResponse({ error: 'O arquivo enviado está vazio' }, 400);
    }
    if (bytes.length > MAX_FILE_BYTES) {
      return jsonResponse({ error: 'Arquivo excede 20MB' }, 400);
    }

    const fileName = storage_path.split('/').pop() || 'orcamento';
    const lowerName = fileName.toLowerCase();

    // Monta o conteúdo conforme o tipo: PDF vai como documento nativo (íntegro,
    // sem truncar); planilha e CSV viram texto tabular.
    const content: Record<string, unknown>[] = [];

    if (lowerName.endsWith('.pdf')) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: toBase64(bytes),
        },
      });
      content.push({
        type: 'text',
        text: `Analise o orçamento em PDF "${fileName}" acima e extraia as seções e itens conforme o formato especificado. Retorne APENAS o JSON.`,
      });
    } else {
      let tabular: string;

      if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
        try {
          // Import sob demanda: uma falha ao carregar o parser de planilha não
          // pode derrubar o caminho do PDF, que é o formato principal.
          const XLSX = await import('https://esm.sh/xlsx@0.18.5');
          const workbook = XLSX.read(bytes, { type: 'array' });
          tabular = workbook.SheetNames
            .map(
              (name: string) =>
                `### Planilha: ${name}\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`,
            )
            .join('\n\n')
            .trim();
        } catch (err) {
          console.error('XLSX parse error:', err);
          return jsonResponse(
            { error: 'Não foi possível ler a planilha. Converta para PDF ou CSV.' },
            400,
          );
        }
      } else {
        tabular = new TextDecoder('utf-8').decode(bytes).trim();
      }

      if (!tabular) {
        return jsonResponse({ error: 'Não foi encontrado conteúdo legível no arquivo' }, 422);
      }

      content.push({
        type: 'text',
        text: `Analise o orçamento "${fileName}" abaixo e extraia as seções e itens conforme o formato especificado. Retorne APENAS o JSON.\n\n${tabular}`,
      });
    }

    const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        temperature: 0.05,
        stream: true,
      }),
    });

    if (!aiResponse.ok || !aiResponse.body) {
      const errText = await aiResponse.text().catch(() => '');
      console.error('Anthropic API error:', aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return jsonResponse(
          { error: 'Serviço sobrecarregado. Tente novamente em alguns segundos.' },
          429,
        );
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: 'Créditos de IA esgotados.' }, 402);
      }
      return jsonResponse({ error: 'Falha na análise do orçamento pela IA' }, 500);
    }

    let aiText: string;
    let stopReason: string | null;
    try {
      ({ text: aiText, stopReason } = await readAnthropicStream(aiResponse.body));
    } catch (err) {
      console.error('Anthropic stream error:', err);
      return jsonResponse({ error: 'A análise do orçamento foi interrompida. Tente novamente.' }, 502);
    }

    if (stopReason === 'max_tokens') {
      return jsonResponse(
        {
          error:
            'O orçamento é grande demais para ser importado de uma vez. Divida o arquivo e importe por partes.',
        },
        422,
      );
    }

    if (!aiText.trim()) {
      return jsonResponse({ error: 'A IA não retornou conteúdo para este arquivo' }, 500);
    }

    let parsed: { sections?: ParsedSection[] } | ParsedSection[];
    try {
      const clean = aiText
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error('Failed to parse AI response as JSON:', aiText.slice(0, 500));
      return jsonResponse({ error: 'Resposta da IA em formato inválido' }, 500);
    }

    const sections = Array.isArray(parsed) ? parsed : parsed.sections;
    if (!Array.isArray(sections) || sections.length === 0) {
      return jsonResponse(
        {
          error:
            'Nenhuma seção foi identificada neste orçamento. Confira se o arquivo contém a planilha de itens.',
        },
        422,
      );
    }

    // Create orcamento
    const { data: orcamento, error: orcError } = await supabaseAdmin
      .from('orcamentos')
      .insert({
        project_id,
        project_name: project_name || 'Orçamento importado',
        client_name: client_name || '',
        internal_status: 'in_progress',
        priority: 'normal',
      })
      .select('id')
      .single();

    if (orcError || !orcamento) {
      console.error('Create orcamento error:', orcError);
      return jsonResponse({ error: 'Falha ao criar o orçamento' }, 500);
    }

    const orcamentoId = orcamento.id;
    let totalItems = 0;
    let insertedSections = 0;

    for (const [secIdx, sec] of sections.entries()) {
      const rawItems = Array.isArray(sec.items) ? sec.items : [];
      const itemRows = rawItems
        .map((item, idx) => {
          const title = toText(item?.title);
          if (!title) return null;

          const qty = toNumber(item.qty) ?? 1;
          const unitPrice = toNumber(item.internal_unit_price);
          const total =
            toNumber(item.internal_total) ?? (unitPrice !== null ? unitPrice * qty : null);

          return {
            title,
            description: toText(item.description),
            qty,
            unit: toText(item.unit) ?? 'un',
            internal_unit_price: unitPrice ?? (total !== null && qty ? total / qty : null),
            internal_total: total,
            bdi_percentage: toNumber(item.bdi_percentage) ?? 0,
            order_index: toNumber(item.order_index) ?? idx,
            item_category: toText(item.item_category),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Fecha o total da seção a partir dos itens quando a IA não informar.
      const itemsTotal = itemRows.reduce((sum, item) => sum + (item.internal_total ?? 0), 0);
      const sectionPrice = toNumber(sec.section_price) ?? (itemsTotal > 0 ? itemsTotal : null);

      const { data: secData, error: secError } = await supabaseAdmin
        .from('orcamento_sections')
        .insert({
          orcamento_id: orcamentoId,
          title: toText(sec.title) ?? `Seção ${secIdx + 1}`,
          order_index: toNumber(sec.order_index) ?? secIdx,
          section_price: sectionPrice,
          is_optional: sec.is_optional === true,
        })
        .select('id')
        .single();

      if (secError || !secData) {
        console.error('Insert section error:', secError);
        continue;
      }
      insertedSections++;

      if (itemRows.length > 0) {
        const { error: itemsError } = await supabaseAdmin
          .from('orcamento_items')
          .insert(itemRows.map((item) => ({ ...item, section_id: secData.id })));

        if (itemsError) {
          console.error('Insert items error:', itemsError);
        } else {
          totalItems += itemRows.length;
        }
      }
    }

    if (insertedSections === 0) {
      await supabaseAdmin.from('orcamentos').delete().eq('id', orcamentoId);
      return jsonResponse({ error: 'Falha ao gravar as seções do orçamento' }, 500);
    }

    return jsonResponse({
      success: true,
      orcamento_id: orcamentoId,
      sections_count: insertedSections,
      items_count: totalItems,
      message: `${insertedSections} seções e ${totalItems} itens importados com sucesso`,
    });
  } catch (error: any) {
    console.error('parse-budget-pdf error:', error);
    return jsonResponse({ error: error.message || 'Internal error' }, 500);
  }
});
