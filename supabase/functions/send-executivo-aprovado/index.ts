/* eslint-disable no-console */
/**
 * send-executivo-aprovado — e-mail imediato quando uma obra entra na etapa
 * "Executivo Aprovado" no Painel de Obras.
 *
 * Quem chama: o trigger `notify_executivo_aprovado` (via pg_net), logo depois
 * de inserir as notificações do sino. Antes, o e-mail dependia do resumo
 * diário (`send-notification-digest`), que nunca foi agendado no cron — na
 * prática ninguém recebia aviso por e-mail.
 *
 * Segurança: a função é pública (chave anon), então NÃO aceita e-mails no
 * payload. Recebe `project_id` + `user_ids` e só envia para perfis ATIVOS
 * de `users_profile`, e só se a obra estiver de fato na etapa. Assim, o pior
 * que alguém com a chave anon consegue é reenviar um aviso legítimo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const logoUrl =
  "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";
const portalUrl = Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com";
const ETAPA = "Executivo Aprovado";

interface Payload {
  project_id?: string;
  user_ids?: string[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(opts: {
  recipientName: string;
  projectName: string;
  unitName: string | null;
  customerName: string | null;
  projectUrl: string;
}): string {
  const meta = [
    opts.unitName ? `Unidade: ${escapeHtml(opts.unitName)}` : null,
    opts.customerName ? `Cliente: ${escapeHtml(opts.customerName)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:linear-gradient(135deg,#0B3D91 0%,#1D4ED8 100%);padding:32px;text-align:center;">
            <img src="${logoUrl}" alt="Bwild" width="120" style="display:block;margin:0 auto 12px auto;" />
            <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;">Projeto executivo aprovado</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px 0;font-size:15px;color:#1a1a1a;">Olá, ${escapeHtml(opts.recipientName)}.</p>
            <p style="margin:0 0 16px 0;font-size:15px;color:#1a1a1a;">
              A obra <strong>${escapeHtml(opts.projectName)}</strong> acabou de entrar na etapa
              <strong>${ETAPA}</strong> no Painel de Obras.
            </p>
            ${meta ? `<p style="margin:0 0 24px 0;font-size:13px;color:#6b7280;">${meta}</p>` : ""}
            <p style="margin:0 0 24px 0;font-size:14px;color:#374151;">
              Ela já pode entrar no cronograma de contas e nas próximas etapas de planejamento.
            </p>
            <a href="${opts.projectUrl}" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Abrir a obra no portal</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px 32px;font-size:12px;color:#9ca3af;">
            Aviso automático do Portal Bwild. Você está recebendo porque é responsável por esta etapa.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!resendApiKey || !supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Missing RESEND_API_KEY / SUPABASE env" }, 500);
    }

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const projectId = typeof payload.project_id === "string" ? payload.project_id : "";
    const userIds = Array.isArray(payload.user_ids)
      ? payload.user_ids.filter((u): u is string => typeof u === "string").slice(0, 20)
      : [];
    if (!projectId || userIds.length === 0) {
      return jsonResponse({ error: "project_id e user_ids são obrigatórios" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // A obra precisa estar mesmo na etapa — evita disparo forjado.
    const { data: project, error: projectErr } = await admin
      .from("projects")
      .select("id, name, unit_name, painel_etapa, project_customers(customer_name)")
      .eq("id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (projectErr) throw projectErr;
    if (!project || String(project.painel_etapa) !== ETAPA) {
      return jsonResponse({ success: true, sent: 0, skipped: "project_not_in_stage" });
    }

    // Só perfis ativos do portal recebem — nunca e-mails vindos do payload.
    const { data: profiles, error: profErr } = await admin
      .from("users_profile")
      .select("id, nome, email, status")
      .in("id", userIds)
      .eq("status", "ativo");
    if (profErr) throw profErr;

    const resend = new Resend(resendApiKey);
    const projectName = (project.name || "").trim() || "obra sem nome";
    const customers = (project.project_customers ?? []) as Array<{ customer_name: string | null }>;
    const customerName = customers[0]?.customer_name ?? null;
    const projectUrl = `${portalUrl}/obra/${project.id}`;

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const p of profiles ?? []) {
      if (!p.email) continue;
      try {
        await resend.emails.send({
          from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
          to: [p.email],
          subject: `✅ Executivo aprovado — ${projectName}`,
          html: buildHtml({
            recipientName: (p.nome || "").split(" ")[0] || p.email.split("@")[0],
            projectName,
            unitName: project.unit_name ?? null,
            customerName,
            projectUrl,
          }),
        });
        results.push({ email: p.email, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`send-executivo-aprovado: falha para ${p.email}:`, message);
        results.push({ email: p.email, ok: false, error: message });
      }
    }

    console.log(`send-executivo-aprovado: obra ${project.id}, ${results.filter((r) => r.ok).length}/${results.length} enviados`);
    return jsonResponse({ success: true, sent: results.filter((r) => r.ok).length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-executivo-aprovado:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
