import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

const logoUrl = "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";
const portalUrl = "https://portal-bwild.lovable.app";

interface UnreadNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  action_url: string | null;
  project_id: string | null;
  created_at: string;
}

interface UserDigest {
  user_id: string;
  email: string;
  name: string;
  notifications: UnreadNotification[];
}

function getTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    payment_due: "💰",
    payment_overdue: "🚨",
    formalization_pending: "✍️",
    document_uploaded: "📄",
    stage_changed: "🏗️",
    pending_item_created: "⚠️",
    report_published: "📊",
    general: "📌",
  };
  return map[type] || "📌";
}

function buildEmailHtml(digest: UserDigest): string {
  const notifRows = digest.notifications
    .map((n) => {
      const emoji = getTypeEmoji(n.type);
      const actionLink = n.action_url
        ? `<a href="${portalUrl}${n.action_url}" style="color: #7C3AED; text-decoration: none; font-size: 12px;">Ver detalhes →</a>`
        : "";
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid #f3f4f6;">
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #1a1a1a;">
              ${emoji} <strong>${n.title}</strong>
            </p>
            ${n.body ? `<p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280;">${n.body}</p>` : ""}
            ${actionLink}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B21A8 0%, #7C3AED 50%, #8B5CF6 100%); padding: 32px; text-align: center;">
              <img src="${logoUrl}" alt="Bwild" width="120" style="display: block; margin: 0 auto 12px auto;" />
              <h1 style="color: #ffffff; font-size: 20px; font-weight: 600; margin: 0;">Resumo de Notificações</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="color: #1a1a1a; font-size: 16px; margin: 0 0 8px 0;">
                Olá, <strong>${digest.name}</strong>!
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px 0;">
                Você tem <strong>${digest.notifications.length}</strong> notificação(ões) não lida(s):
              </p>
              
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; overflow: hidden;">
                ${notifRows}
              </table>
              
              <!-- CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}/minhas-obras" target="_blank"
                       style="display: inline-block; background: linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 14px rgba(124,58,237,0.4);">
                      Acessar Portal
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 20px 32px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 4px 0;">
                © ${new Date().getFullYear()} Bwild Arquitetura & Design
              </p>
              <p style="color: #6b7280; font-size: 11px; margin: 0;">
                Email automático · Não responda
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

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
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: { id: string; nome: string; email: string }) => [p.id, p])
    );

    const results = { sent: 0, skipped: 0, failed: 0 };

    for (const [userId, notifs] of userMap) {
      const profile = profileMap.get(userId);
      if (!profile?.email) {
        results.skipped++;
        continue;
      }

      const digest: UserDigest = {
        user_id: userId,
        email: profile.email,
        name: profile.nome || profile.email.split("@")[0],
        notifications: notifs.slice(0, 10), // Cap at 10 per email
      };

      try {
        await resend.emails.send({
          from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
          to: [digest.email],
          subject: `Você tem ${notifs.length} notificação(ões) no Portal Bwild`,
          html: buildEmailHtml(digest),
        });
        results.sent++;
      } catch (emailErr) {
        console.error(`Failed to send digest to ${digest.email}:`, emailErr);
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
