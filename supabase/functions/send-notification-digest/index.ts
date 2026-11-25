import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";
import { corsHeaders } from "../_shared/cors.ts";

const portalUrl = Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com";

interface UnreadNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  project_id: string | null;
  created_at: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users with unread notifications (created in last 24h)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: unreadNotifs, error: notifErr } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, body, action_url, project_id, created_at")
      .is("read_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (notifErr) throw notifErr;

    if (!unreadNotifs || unreadNotifs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No unread notifications", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group by user
    const userMap = new Map<string, UnreadNotification[]>();
    for (const n of unreadNotifs) {
      if (!userMap.has(n.user_id)) userMap.set(n.user_id, []);
      userMap.get(n.user_id)!.push(n);
    }

    // Get user emails
    const userIds = [...userMap.keys()];
    const { data: profiles } = await supabase
      .from("users_profile")
      .select("id, nome, email")
      .in("id", userIds)
      // Quem foi desativado (ex-colaborador) não recebe resumo.
      .neq("status", "inativo");

    const profileMap = new Map(
      (profiles || []).map((p: { id: string; nome: string; email: string }) => [p.id, p])
    );

    const results = { sent: 0, skipped: 0, failed: 0 };
    const today = new Date().toISOString().slice(0, 10);

    for (const [userId, notifs] of userMap) {
      const profile = profileMap.get(userId);
      if (!profile?.email) {
        results.skipped++;
        continue;
      }

      try {
        // Serviço de e-mail nativo do Lovable (bwildworkflow.com). A chave de
        // idempotência evita mandar dois resumos no mesmo dia para a pessoa.
        const result = await sendTemplateEmail("resumo-notificacoes", profile.email, {
          idempotencyKey: `resumo-${userId}-${today}`,
          templateData: {
            recipientName: (profile.nome || "").split(" ")[0] || profile.email.split("@")[0],
            portalUrl: `${portalUrl}/`,
            // No máximo 10 por e-mail.
            items: notifs.slice(0, 10).map((n) => ({
              title: n.title,
              body: n.body ?? undefined,
              url: n.action_url ? `${portalUrl}${n.action_url}` : undefined,
            })),
          },
        });
        if (result.sent) results.sent++;
        else results.skipped++;
      } catch (emailErr) {
        console.error(`Failed to send digest to ${userId}:`, emailErr);
        results.failed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-notification-digest:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
