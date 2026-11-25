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
 * A chave de idempotência (id da notificação) impede reenvio do mesmo aviso.
 *
 * Envio: serviço de e-mail nativo do Lovable (domínio bwildworkflow.com),
 * modelo `mencao-interna`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const portalUrl = Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com";
/** Janela em que a notificação ainda pode gerar e-mail. */
const MAX_AGE_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Missing SUPABASE env" }, 500);
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

    const result = await sendTemplateEmail("mencao-interna", profile.email, {
      idempotencyKey: `mencao-${notif.id}`,
      templateData: {
        recipientName: (profile.nome || "").split(" ")[0] || profile.email.split("@")[0],
        title: notif.title,
        body: notif.body ?? undefined,
        url: `${portalUrl}${notif.action_url || "/"}`,
      },
    });
    if (!result.sent) {
      return jsonResponse({ success: true, sent: 0, skipped: result.reason });
    }

    console.log(`send-mention-email: notificação ${notif.id} enviada`);
    return jsonResponse({ success: true, sent: 1 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-mention-email:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
