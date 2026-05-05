/* eslint-disable no-console */
import { Resend } from "https://esm.sh/resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface MeetingNotificationRequest {
  slotId: string;
  projectName: string;
  customerName: string;
  customerEmail: string;
  slotDatetime: string;
  stageName: string;
}

const logoUrl = "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const { slotId, projectName, customerName, customerEmail, slotDatetime, stageName }: MeetingNotificationRequest = await req.json();

    if (!slotId || !projectName || !customerName || !slotDatetime) {
      throw new Error("Missing required fields: slotId, projectName, customerName, slotDatetime");
    }

    console.log(`Sending meeting notification for slot ${slotId}, project: ${projectName}`);

    // Format datetime for display in Brazil timezone
    const dateObj = new Date(slotDatetime);
    const formattedDate = dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Sao_Paulo',
    });
    const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with purple gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #6B21A8 0%, #7C3AED 50%, #8B5CF6 100%); padding: 40px 32px; text-align: center;">
              <img src="${logoUrl}" alt="Bwild" width="140" style="display: block; margin: 0 auto 16px auto;" />
              <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0;">Transformando espaços em experiências</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0 0 8px 0;">
                📅 Nova Reunião Agendada
              </h1>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Um cliente agendou uma reunião pelo portal.
              </p>
              
              <!-- Meeting Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #1a1a1a; font-size: 15px; margin: 0 0 12px 0;">
                      <strong>Cliente:</strong> ${customerName}
                    </p>
                    <p style="color: #1a1a1a; font-size: 15px; margin: 0 0 12px 0;">
                      <strong>Email:</strong> ${customerEmail || 'Não informado'}
                    </p>
                    <p style="color: #1a1a1a; font-size: 15px; margin: 0 0 12px 0;">
                      <strong>Projeto:</strong> ${projectName}
                    </p>
                    <p style="color: #1a1a1a; font-size: 15px; margin: 0 0 12px 0;">
                      <strong>Etapa:</strong> ${stageName}
                    </p>
                    <hr style="border: none; border-top: 1px solid #e9d5ff; margin: 16px 0;" />
                    <p style="color: #7c3aed; font-size: 18px; font-weight: 600; margin: 0 0 4px 0;">
                      ${formattedDate}
                    </p>
                    <p style="color: #6B21A8; font-size: 24px; font-weight: 700; margin: 0;">
                      ${formattedTime}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 24px 32px; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 8px 0;">
                © ${new Date().getFullYear()} Bwild Arquitetura & Design. Todos os direitos reservados.
              </p>
              <p style="color: #6b7280; font-size: 11px; margin: 0;">
                Este é um email automático enviado pelo Portal Bwild.
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

    // Send to internal team
    const emailResponse = await resend.emails.send({
      from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
      to: ["contato@bfreitasdesign.com.br"],
      subject: `📅 Nova reunião agendada - ${projectName}`,
      html: emailHtml,
    });

    console.log("Meeting notification sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in send-meeting-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
