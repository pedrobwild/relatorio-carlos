import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";

const SOURCE_PROJECT_ID = "dabca3ea-341a-45d8-94a0-204b1230f6e3"; // Lucia Eid
const DEMO_EMAIL = "demo@bwild.com.br";
const DEMO_PASSWORD = "Demo@2026!Bwild";
const DEMO_NAME = "Cliente Demonstração";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const integrationKey = req.headers.get("x-integration-key");
    const expectedKey = Deno.env.get("INTEGRATION_API_KEY");

    let actorUserId: string;
    let supabaseAdmin: ReturnType<typeof createClient>;

    if (integrationKey && expectedKey && integrationKey === expectedKey) {
      // Internal/admin invocation path
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      supabaseAdmin = createClient(supabaseUrl, serviceKey);
      const body = await req.clone().json().catch(() => ({}));
      actorUserId = body.actor_user_id;
      if (!actorUserId) {
        // Fallback: pick any active admin
        const { data: admin } = await supabaseAdmin
          .from("users_profile")
          .select("id")
          .eq("perfil", "admin")
          .eq("status", "ativo")
          .limit(1)
          .single();
        actorUserId = admin?.id;
      }
      if (!actorUserId) return jsonResponse({ error: "No admin available" }, 500);
    } else {
      const auth = await authenticateRequest(req);
      supabaseAdmin = auth.supabaseAdmin;
      actorUserId = auth.user.id;
      const { data: isStaff } = await supabaseAdmin.rpc("is_staff", { _user_id: actorUserId });
      if (!isStaff) return jsonResponse({ error: "Staff access required" }, 403);
    }

    // For brevity below we keep the variable name `user.id` semantics:
    const user = { id: actorUserId };

    // ─── 1. Provision demo customer user ──────────────────────────────
    let demoUserId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("users_profile")
      .select("id")
      .eq("email", DEMO_EMAIL)
      .maybeSingle();

    if (existing) {
      demoUserId = existing.id;
      // Reset password so user can re-login
      await supabaseAdmin.auth.admin.updateUserById(demoUserId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: DEMO_NAME, role: "customer" },
      });
      if (createErr || !created.user) {
        return jsonResponse({ error: createErr?.message || "Failed to create demo user" }, 500);
      }
      demoUserId = created.user.id;
    }

    // Ensure profile is correct
    await supabaseAdmin.from("users_profile").update({
      perfil: "customer",
      nome: DEMO_NAME,
      status: "ativo",
    }).eq("id", demoUserId);

    // ─── 2. Load source project ───────────────────────────────────────
    const { data: src, error: srcErr } = await supabaseAdmin
      .from("projects")
      .select("*")
      .eq("id", SOURCE_PROJECT_ID)
      .single();
    if (srcErr || !src) return jsonResponse({ error: "Source project not found" }, 404);

    // ─── 3. Create new project (clone) ────────────────────────────────
    const newProjectName = "DEMO | Apartamento Modelo Brooklin";
    const newUnitName = "1502 - Demo";

    const insertProject: Record<string, unknown> = {
      ...src,
      name: newProjectName,
      unit_name: newUnitName,
      created_by: user.id,
      client_name: DEMO_NAME,
      client_email: DEMO_EMAIL,
    };
    delete insertProject.id;
    delete insertProject.created_at;
    delete insertProject.updated_at;

    const { data: newProj, error: newProjErr } = await supabaseAdmin
      .from("projects")
      .insert(insertProject)
      .select()
      .single();
    if (newProjErr || !newProj) {
      return jsonResponse({ error: `Project clone failed: ${newProjErr?.message}` }, 500);
    }
    const newProjectId = newProj.id as string;

    // ─── 4. Customer record ───────────────────────────────────────────
    await supabaseAdmin.from("project_customers").insert({
      project_id: newProjectId,
      customer_name: DEMO_NAME,
      customer_email: DEMO_EMAIL,
      customer_user_id: demoUserId,
      invitation_accepted_at: new Date().toISOString(),
    });

    // ─── 5. Clone activities @ ~85% progress ──────────────────────────
    const { data: srcActs } = await supabaseAdmin
      .from("project_activities")
      .select("*")
      .eq("project_id", SOURCE_PROJECT_ID)
      .order("sort_order");

    if (srcActs && srcActs.length) {
      // Mark first 17/20 activities as fully complete (~85%)
      const COMPLETE_UNTIL = Math.ceil(srcActs.length * 0.85);
      const newActs = srcActs.map((a: any, idx: number) => {
        const isComplete = idx < COMPLETE_UNTIL;
        const isInProgress = idx === COMPLETE_UNTIL;
        return {
          project_id: newProjectId,
          description: a.description,
          planned_start: a.planned_start,
          planned_end: a.planned_end,
          actual_start: isComplete || isInProgress ? a.planned_start : null,
          actual_end: isComplete ? a.planned_end : null,
          weight: a.weight,
          sort_order: a.sort_order,
          etapa: a.etapa,
          detailed_description: a.detailed_description,
          created_by: user.id,
        };
      });
      await supabaseAdmin.from("project_activities").insert(newActs);
    }

    // ─── 6. Clone payments (mark first 2 paid) ────────────────────────
    const { data: srcPays } = await supabaseAdmin
      .from("project_payments")
      .select("*")
      .eq("project_id", SOURCE_PROJECT_ID)
      .order("installment_number");

    if (srcPays && srcPays.length) {
      const newPays = srcPays.map((p: any, idx: number) => ({
        project_id: newProjectId,
        installment_number: p.installment_number,
        description: p.description,
        amount: p.amount,
        due_date: p.due_date,
        paid_at: idx < 2 ? new Date().toISOString() : null,
        payment_method: idx < 2 ? "PIX" : null,
      }));
      await supabaseAdmin.from("project_payments").insert(newPays);
    }

    // ─── 7. Journey: mark stages as completed (project is in execução) ─
    const { data: jStages } = await supabaseAdmin
      .from("journey_stages")
      .select("id, sort_order")
      .eq("project_id", newProjectId)
      .order("sort_order");

    if (jStages && jStages.length) {
      // All journey stages (pre-construction) are done since obra está 85%
      for (const s of jStages) {
        await supabaseAdmin.from("journey_stages").update({
          status: "completed",
          confirmed_start: "2025-09-01",
          confirmed_end: "2025-12-15",
        }).eq("id", s.id);
      }
    }

    // ─── 8. Project members (add demo customer + current staff) ───────
    await supabaseAdmin.from("project_members").insert([
      { project_id: newProjectId, user_id: user.id, role: "owner" },
      { project_id: newProjectId, user_id: demoUserId, role: "viewer" },
    ]);

    // ─── 9. Inspections + items ───────────────────────────────────────
    const inspections = [
      {
        title: "Vistoria de Pintura - 1ª demão",
        type: "rotina",
        date: "2026-02-13",
        status: "completed",
        items: [
          { desc: "Cobertura uniforme em paredes", result: "approved" },
          { desc: "Acabamento de cantos e rodapés", result: "approved" },
          { desc: "Proteção de pisos e mobiliário", result: "approved" },
        ],
      },
      {
        title: "Vistoria de Piso Vinílico",
        type: "rotina",
        date: "2026-03-03",
        status: "completed",
        items: [
          { desc: "Nivelamento do contrapiso", result: "approved" },
          { desc: "Alinhamento das réguas", result: "approved" },
          { desc: "Acabamento de soleiras", result: "with_observation" },
        ],
      },
      {
        title: "Vistoria de Climatização",
        type: "rotina",
        date: "2026-03-20",
        status: "completed",
        items: [
          { desc: "Fixação dos equipamentos", result: "approved" },
          { desc: "Teste de funcionamento", result: "approved" },
          { desc: "Acabamento da tubulação", result: "approved" },
        ],
      },
    ];

    for (const insp of inspections) {
      const { data: inspRow } = await supabaseAdmin.from("inspections").insert({
        project_id: newProjectId,
        inspector_id: user.id,
        inspector_user_id: user.id,
        inspection_date: insp.date,
        inspection_type: insp.type,
        status: insp.status,
        notes: insp.title,
        completed_at: new Date(insp.date).toISOString(),
      }).select().single();

      if (inspRow) {
        await supabaseAdmin.from("inspection_items").insert(
          insp.items.map((it, idx) => ({
            inspection_id: inspRow.id,
            description: it.desc,
            result: it.result,
            sort_order: idx + 1,
          }))
        );
      }
    }

    // ─── 10. Non-conformities ─────────────────────────────────────────
    await supabaseAdmin.from("non_conformities").insert([
      {
        project_id: newProjectId,
        title: "Soleira do banheiro com pequeno desnível",
        description: "Identificado durante vistoria de piso vinílico. Necessário ajuste de 2mm na soleira da entrada do banheiro.",
        severity: "low",
        status: "closed",
        category: "Acabamento",
        responsible_user_id: user.id,
        deadline: "2026-03-10",
        corrective_action: "Refazer soleira com nivelamento correto e nova régua de transição.",
        resolution_notes: "Soleira refeita e aprovada em vistoria de acompanhamento.",
        resolved_at: "2026-03-08T14:00:00Z",
        resolved_by: user.id,
        verified_at: "2026-03-09T10:00:00Z",
        verified_by: user.id,
        approved_at: "2026-03-09T10:30:00Z",
        approved_by: user.id,
        created_by: user.id,
      },
      {
        project_id: newProjectId,
        title: "Tonalidade da tinta divergente da amostra aprovada",
        description: "Cliente apontou diferença sutil entre a tinta aplicada na sala e a amostra aprovada. Em análise pela equipe técnica.",
        severity: "medium",
        status: "in_treatment",
        category: "Pintura",
        responsible_user_id: user.id,
        deadline: "2026-04-25",
        corrective_action: "Solicitar nova mistura junto ao fornecedor com correção de pigmentação. Reaplicar 2ª demão na parede afetada.",
        created_by: user.id,
      },
    ]);

    // ─── 11. Pending items (decisões do cliente) ──────────────────────
    const orgId = newProj.org_id || newProj.created_by;
    await supabaseAdmin.from("pending_items").insert([
      {
        project_id: newProjectId,
        customer_org_id: orgId,
        type: "decision",
        title: "Aprovar acabamento de marcenaria do closet",
        description: "Equipe de marcenaria precisa de definição final do acabamento (laca acetinada vs. madeira natural) para iniciar produção.",
        options: [
          { label: "Laca acetinada off-white", impact: "Prazo padrão, valor incluído no contrato" },
          { label: "Madeira natural Freijó", impact: "Prazo +7 dias, custo adicional R$ 2.400" },
        ],
        impact: "Atraso na produção da marcenaria pode impactar entrega final em até 5 dias úteis.",
        due_date: "2026-04-25",
        status: "pending",
        action_url: `/obra/${newProjectId}/pendencias`,
      },
      {
        project_id: newProjectId,
        customer_org_id: orgId,
        type: "decision",
        title: "Definir modelo de persiana da sala",
        description: "Fornecedor de persianas precisa de aprovação até a próxima sexta para garantir entrega antes da limpeza fina.",
        options: [
          { label: "Rolô blackout cinza chumbo", impact: "Pronto-entrega, instalação imediata" },
          { label: "Romana plissada bege", impact: "Sob encomenda, prazo de 12 dias" },
        ],
        impact: "Sem definição até 30/04, o cronograma de mobiliário será reorganizado.",
        due_date: "2026-04-30",
        status: "pending",
        action_url: `/obra/${newProjectId}/pendencias`,
      },
    ]);

    // ─── 12. Weekly report ────────────────────────────────────────────
    await supabaseAdmin.from("weekly_reports").insert({
      project_id: newProjectId,
      week_number: 12,
      week_start: "2026-03-23",
      week_end: "2026-03-29",
      available_at: new Date().toISOString(),
      created_by: user.id,
      data: {
        summary: "Semana de avanço significativo: instalação completa dos equipamentos de climatização e início dos metais e acabamentos hidráulicos.",
        progress: 85,
        completedActivities: [
          "Instalação de equipamentos de climatização",
          "Conclusão da instalação de luminárias",
          "Acabamentos cerâmicos (backsplash) finalizados",
        ],
        nextSteps: [
          "Início da instalação de metais e acabamentos hidráulicos",
          "Medições executivas para marcenaria sob medida",
          "Preparação para finalização da pintura",
        ],
        risks: [
          {
            title: "Aprovação da marcenaria",
            description: "Necessária definição do cliente sobre acabamento do closet até 25/04 para não impactar cronograma final.",
            severity: "medium",
          },
        ],
        clientDecisions: [],
        photos: [],
        teamHighlights: "Equipe técnica manteve o ritmo de execução conforme planejado, com atenção especial à qualidade dos acabamentos.",
      },
    });

    return jsonResponse({
      success: true,
      project_id: newProjectId,
      project_name: newProjectName,
      demo_user: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        user_id: demoUserId,
      },
      stats: {
        activities: srcActs?.length || 0,
        payments: srcPays?.length || 0,
        inspections: 3,
        ncs: 2,
        pending_items: 2,
        weekly_reports: 1,
      },
    });
  } catch (err: any) {
    console.error("[seed-demo-project] error:", err);
    const status = err?.status || 500;
    return jsonResponse({ error: err?.message || String(err) }, status);
  }
});
