import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { projectId, weekNumber, weekStart, weekEnd } = await req.json();
    if (!projectId || !weekNumber) throw new Error("Missing projectId or weekNumber");

    // Fetch project info
    const { data: project } = await supabase
      .from("projects")
      .select("name, status, planned_start_date, planned_end_date, actual_start_date")
      .eq("id", projectId)
      .single();

    // Fetch activities
    const { data: activities } = await supabase
      .from("project_activities")
      .select("description, planned_start, planned_end, actual_start, actual_end, weight, sort_order")
      .eq("project_id", projectId)
      .order("sort_order");

    // Fetch journey stages
    const { data: stages } = await supabase
      .from("journey_stages")
      .select("name, status, sort_order, description, responsible, warning_text")
      .eq("project_id", projectId)
      .order("sort_order");

    // Fetch recent chat messages
    const { data: recentMessages } = await supabase
      .from("journey_stage_messages")
      .select("message, author_name, author_role, created_at")
      .eq("project_id", projectId)
      .gte("created_at", weekStart || new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch pending items
    const { data: pendingItems } = await supabase
      .from("pending_items")
      .select("title, type, status, due_date, impact")
      .eq("project_id", projectId)
      .eq("status", "pending")
      .limit(10);

    // Fetch recent stage records
    const { data: stageRecords } = await supabase
      .from("journey_stage_records")
      .select("title, description, category, record_date, responsible")
      .eq("project_id", projectId)
      .order("record_date", { ascending: false })
      .limit(15);

    const context = JSON.stringify({
      project,
      activities: activities || [],
      stages: stages || [],
      recentMessages: recentMessages || [],
      pendingItems: pendingItems || [],
      stageRecords: stageRecords || [],
      weekNumber,
      weekStart,
      weekEnd,
    });

    const systemPrompt = `Você é um engenheiro civil experiente gerando relatórios semanais de obra.
Gere APENAS um JSON válido (sem markdown, sem \`\`\`). O JSON deve ter esta estrutura exata:
{
  "executiveSummary": "Resumo executivo em HTML rico (2-3 parágrafos, use <b>, <br>, <ul>/<li>)",
  "lookaheadTasks": [{"id":"uuid","date":"YYYY-MM-DD","description":"...","prerequisites":"...","responsible":"...","risk":"baixo|médio|alto","riskReason":"..."}],
  "risksAndIssues": [{"id":"uuid","type":"risco|impedimento|problema","title":"...","description":"...","impact":{"time":"baixo|médio|alto","cost":"baixo|médio|alto","quality":"baixo|médio|alto"},"severity":"baixa|média|alta|crítica","actionPlan":"...","owner":"...","dueDate":"YYYY-MM-DD","status":"aberto|em acompanhamento"}],
  "clientDecisions": [{"id":"uuid","description":"...","options":["..."],"impactIfDelayed":"...","dueDate":"YYYY-MM-DD","status":"pending"}]
}

Regras:
- Gere IDs únicos no formato UUID v4
- Baseie-se nos dados reais do projeto fornecidos
- Resumo executivo deve mencionar progresso real, conquistas da semana e próximos passos
- Identifique riscos reais baseados em atrasos ou problemas nas atividades
- Lookahead deve cobrir os próximos 7 dias com tarefas realistas
- Decisões do cliente devem refletir pendências reais
- Escreva em português brasileiro profissional
- Não invente dados que não existem no contexto`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dados do projeto para semana ${weekNumber} (${weekStart} a ${weekEnd}):\n\n${context}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || "";
    
    // Clean markdown code fences if present
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    
    const generated = JSON.parse(content);

    return new Response(JSON.stringify({ success: true, data: generated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-weekly-report error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
