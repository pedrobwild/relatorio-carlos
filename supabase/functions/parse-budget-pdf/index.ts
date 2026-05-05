import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Download file
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('project-documents')
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return jsonResponse({ error: 'Failed to download file' }, 500);
    }

    // Convert to base64 for AI
    const buffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const fileBase64 = btoa(binary);

    // AI parsing
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: 'AI service not available' }, 500);
    }

    const systemPrompt = `Você é um especialista em orçamentos de reforma e construção civil.
Analise o orçamento fornecido (PDF em base64) e extraia TODOS os itens organizados em seções.

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
          "item_category": "Produto ou Prestador"
        }
      ]
    }
  ]
}

REGRAS:
- Agrupe os itens em seções lógicas (Marcenaria, Elétrica, Hidráulica, Pintura, Revestimentos, etc.)
- Extraia CADA item individualmente com nome, quantidade, unidade e preço
- Se o item é um produto/material, item_category = "Produto"
- Se o item é mão de obra/serviço, item_category = "Prestador"
- section_price deve ser a soma dos internal_total dos itens da seção
- Se não encontrar preço unitário mas encontrar total, calcule o unitário dividindo pela quantidade
- Se não encontrar quantidade, use 1
- Unidades comuns: un, m², m, m³, kg, cx, pc, rolo, vb (verba), cj (conjunto)
- Mantenha a ordem original do documento
- Retorne APENAS o JSON, sem texto adicional
- Seja preciso nos valores numéricos`;

    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analise este orçamento em PDF (base64) e extraia as seções e itens:\n\n${fileBase64.substring(0, 100000)}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI API error:', errText);
      return jsonResponse({ error: 'AI processing failed' }, 500);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: 'AI returned empty response' }, 500);
    }

    let parsed: { sections: ParsedSection[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content.substring(0, 500));
      return jsonResponse({ error: 'Failed to parse AI response' }, 500);
    }

    if (!parsed.sections || parsed.sections.length === 0) {
      return jsonResponse({ error: 'No sections extracted from budget' }, 422);
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

    if (orcError) {
      console.error('Create orcamento error:', orcError);
      return jsonResponse({ error: 'Failed to create budget' }, 500);
    }

    const orcamentoId = orcamento.id;
    let totalItems = 0;

    // Insert sections and items
    for (const sec of parsed.sections) {
      const { data: secData, error: secError } = await supabaseAdmin
        .from('orcamento_sections')
        .insert({
          orcamento_id: orcamentoId,
          title: sec.title,
          order_index: sec.order_index ?? 0,
          section_price: sec.section_price ?? null,
          is_optional: sec.is_optional ?? false,
        })
        .select('id')
        .single();

      if (secError) {
        console.error('Insert section error:', secError);
        continue;
      }

      if (Array.isArray(sec.items) && sec.items.length > 0) {
        const itemRows = sec.items
          .filter((item) => item.title?.trim())
          .map((item, idx) => ({
            section_id: secData.id,
            title: item.title,
            description: item.description ?? null,
            qty: item.qty ?? 1,
            unit: item.unit ?? 'un',
            internal_unit_price: item.internal_unit_price ?? null,
            internal_total: item.internal_total ?? null,
            bdi_percentage: item.bdi_percentage ?? 0,
            order_index: item.order_index ?? idx,
            item_category: item.item_category ?? null,
          }));

        if (itemRows.length > 0) {
          const { error: itemsError } = await supabaseAdmin
            .from('orcamento_items')
            .insert(itemRows);

          if (itemsError) {
            console.error('Insert items error:', itemsError);
          } else {
            totalItems += itemRows.length;
          }
        }
      }
    }

    return jsonResponse({
      success: true,
      orcamento_id: orcamentoId,
      sections_count: parsed.sections.length,
      items_count: totalItems,
      message: `${parsed.sections.length} seções e ${totalItems} itens importados com sucesso`,
    });
  } catch (error: any) {
    console.error('parse-budget-pdf error:', error);
    return jsonResponse({ error: error.message || 'Internal error' }, 500);
  }
});
