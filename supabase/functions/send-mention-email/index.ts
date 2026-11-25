/* eslint-disable no-console */
/**
 * send-mention-email — e-mail imediato quando alguém é marcado numa
 * observação interna (ou quando a pendência marcada é resolvida).
 *
 * Quem chama: o trigger `trg_notifications_mention_email` (via pg_net), logo
 * depois de a notificação `internal_mention` entrar no sino.
 *
 * Segurança: a função é pública (chave anon), então NÃO aceita e-mail nem
 * texto no payload. Recebe só `notification_id` e lê tudo do banco: precisa
 * ser uma menção criada há poucos minutos, para um perfil ATIVO da equipe.
 * O pior que alguém com a chave anon consegue é reenviar um aviso legítimo
 * dentro dessa janela.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const logoUrl =
  "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";
const portalUrl = Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com";
/** Janela em que a notificação ainda pode gerar e-mail. */
const MAX_AGE_MS = 10 * 60 * 1000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(opts: {
  recipientName: string;
  title: string;
  body: string | null;
  url: string;
}): string {
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
            <h1 style="color:#ffffff;font-size:20px;font-weight:600;margin:0;">Você foi marcado no portal</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px 0;font-size:15px;color:#1a1a1a;">Olá, ${escapeHtml(opts.recipientName)}.</p>
            <p style="margin:0 0 16px 0;font-size:15px;color:#1a1a1a;"><strong>${escapeHtml(opts.title)}</strong></p>
            ${
              opts.body
                ? `<p style="margin:0 0 24px 0;font-size:14px;color:#374151;background:#f3f4f6;border-radius:10px;padding:14px 16px;white-space:pre-wrap;">${escapeHtml(opts.body)}</p>`
                : ""
            }
            <a href="${opts.url}" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Abrir no portal</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px 32px;font-size:12px;color:#9ca3af;">
            Aviso automático do Portal Bwild · Não responda este e-mail.
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

    const payload = (await req.json().catch(() => ({}))) as { notification_id?: unknown };
    const notificationId =
      typeof payload.notification_id === "string" ? payload.notification_id : "";
    if (!notificationId) {
      return jsonResponse({ error: "notification_id é obrigatório" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: notif, error: notifErr } = await admin
      .from("notifications")
      .select("id, user_id, type, title, body, action_url, created_at")
      .eq("id", notificationId)
      .maybeSingle();
    if (notifErr) throw notifErr;
    if (!notif || notif.type !== "internal_mention") {
      return jsonResponse({ success: true, sent: 0, skipped: "not_a_mention" });
    }
    if (Date.now() - new Date(notif.created_at).getTime() > MAX_AGE_MS) {
      return jsonResponse({ success: true, sent: 0, skipped: "too_old" });
    }

    // Só perfis ativos do portal recebem — nunca e-mails vindos do payload.
    const { data: profile, error: profErr } = await admin
      .from("users_profile")
      .select("id, nome, email, status")
      .eq("id", notif.user_id)
      .eq("status", "ativo")
      .maybeSingle();
    if (profErr) throw profErr;
    if (!profile?.email) {
      return jsonResponse({ success: true, sent: 0, skipped: "no_active_recipient" });
    }

    const resend = new Resend(resendApiKey);
    // Resend v4 não lança em erro de API: devolve { error }.
    const { error: sendErr } = await resend.emails.send({
      from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
      to: [profile.email],
      subject: notif.title,
      html: buildHtml({
        recipientName: (profile.nome || "").split(" ")[0] || profile.email.split("@")[0],
        title: notif.title,
        body: notif.body,
        url: `${portalUrl}${notif.action_url || "/"}`,
      }),
    });
    if (sendErr) {
      console.error(`send-mention-email: falha para ${notif.id}:`, sendErr.message);
      return jsonResponse({ success: false, error: sendErr.message }, 502);
    }

    console.log(`send-mention-email: notificação ${notif.id} enviada`);
    return jsonResponse({ success: true, sent: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-mention-email:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
