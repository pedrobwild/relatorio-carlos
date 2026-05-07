import { corsResponse, jsonResponse } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SERVICE_CATEGORIES = [
  'Técnico de Ar-Condicionado',
  'Gesseiro',
  'Pintor',
  'Instalador de Piso',
  'Serviços Gerais',
  'Eletricista',
  'Marcenaria',
  'Empreiteira',
];

const _ITEM_CATEGORIES = [
  'Eletrodomésticos',
  'Móveis',
  'Iluminação',
  'Vidros e Espelhos',
  'Acessórios',
  'Revestimentos',
  'Pisos',
  'Enxoval',
];

interface ParsedItem {
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  estimated_cost: number | null;
  description: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const { project_id, storage_path, user_id } = await req.json();
    if (!project_id || !storage_path || !user_id) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Download the budget file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('project-documents')
      .download(storage_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return jsonResponse({ error: 'Failed to download budget file' }, 500);
    }

    // Convert file to text for AI processing
    let fileContent = '';
    const fileName = storage_path.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      fileContent = await fileData.text();
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      // For Excel files, convert to base64 for AI
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileContent = `[Arquivo Excel em base64 - analise o conteúdo]\n${btoa(binary).substring(0, 50000)}`;
    } else {
      // PDF or other - convert to base64
      const buffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      fileContent = `[Arquivo PDF em base64 - analise o conteúdo]\n${btoa(binary).substring(0, 50000)}`;
    }

    // Use AI to extract items from the budget
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      // Fallback: create default service items without AI parsing
      return await createDefaultItems(supabase, project_id, user_id);
    }

    const systemPrompt = `Você é um assistente especializado em orçamentos de reforma de imóveis.
Analise o orçamento fornecido e extraia TODOS os itens, classificando cada um nas categorias corretas.

CATEGORIAS DE ITENS INDIVIDUAIS (extrair cada item separadamente com nome, quantidade, unidade e custo):
- Eletrodomésticos (geladeira, fogão, micro-ondas, lava-louças, etc.)
- Móveis (sofá, mesa, cadeira, cama, estante, rack, etc.)
- Iluminação (lustre, pendente, arandela, spot, fita LED, etc.)
- Vidros e Espelhos (box, espelho, porta de vidro, etc.)
- Acessórios (puxadores, torneiras, metais, porta-toalha, etc.)
- Revestimentos (azulejo, pastilha, papel de parede, etc.)
- Pisos (porcelanato, vinílico, laminado, etc.)
- Enxoval (cortina, persiana, tapete, roupa de cama, toalhas, etc.)

CATEGORIAS DE SERVIÇOS (listar apenas o serviço, com custo total se disponível):
- Técnico de Ar-Condicionado
- Gesseiro
- Pintor
- Instalador de Piso
- Serviços Gerais
- Eletricista
- Marcenaria
- Empreiteira

Retorne um JSON com o seguinte formato:
{
  "items": [
    {
      "item_name": "Nome do item ou serviço",
      "category": "Nome exato da categoria",
      "quantity": 1,
      "unit": "un",
      "estimated_cost": 1500.00,
      "description": "Descrição breve ou null"
    }
  ]
}

REGRAS:
- Para itens individuais, extraia CADA produto separadamente
- Para serviços, liste apenas UMA entrada por categoria de serviço encontrada
- Se não encontrar custo, use null
- Unidades comuns: un, m², m, kg, cx, pc, rolo
- Retorne APENAS o JSON, sem texto adicional`;

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
          { role: 'user', content: `Analise este orçamento e extraia os itens:\n\n${fileContent}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', await aiResponse.text());
      return await createDefaultItems(supabase, project_id, user_id);
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content;
    
    if (!content) {
      return await createDefaultItems(supabase, project_id, user_id);
    }

    let parsed: { items: ParsedItem[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse AI response:', content);
      return await createDefaultItems(supabase, project_id, user_id);
    }

    if (!parsed.items || parsed.items.length === 0) {
      return await createDefaultItems(supabase, project_id, user_id);
    }

    // Insert parsed items into project_purchases
    const purchaseRows = parsed.items.map((item) => ({
      project_id,
      item_name: item.item_name,
      category: item.category,
      quantity: item.quantity || 1,
      unit: item.unit || 'un',
      estimated_cost: item.estimated_cost,
      actual_cost: null,
      description: item.description,
      lead_time_days: 7,
      required_by_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      created_by: user_id,
    }));

    const { error: insertError } = await supabase
      .from('project_purchases')
      .insert(purchaseRows);

    if (insertError) {
      console.error('Insert error:', insertError);
      return jsonResponse({ error: 'Failed to insert purchases' }, 500);
    }

    return jsonResponse({ 
      success: true, 
      items_count: purchaseRows.length,
      message: `${purchaseRows.length} itens extraídos do orçamento` 
    });

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});

async function createDefaultItems(supabase: any, project_id: string, user_id: string) {
  // Create default service items when AI parsing fails
  const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const serviceRows = SERVICE_CATEGORIES.map((name) => ({
    project_id,
    item_name: name,
    category: name,
    quantity: 1,
    unit: 'serviço',
    estimated_cost: null,
    actual_cost: null,
    lead_time_days: 7,
    required_by_date: defaultDate,
    status: 'pending',
    created_by: user_id,
  }));

  const { error } = await supabase.from('project_purchases').insert(serviceRows);
  
  if (error) {
    console.error('Default items insert error:', error);
    return jsonResponse({ error: 'Failed to create default items' }, 500);
  }

  return jsonResponse({ 
    success: true, 
    items_count: serviceRows.length,
    message: 'Itens de serviço padrão criados (orçamento não pôde ser processado)',
    fallback: true,
  });
}
