/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@4.0.0";
import { corsHeaders } from "../_shared/cors.ts";

interface SignatureRequestPayload {
  formalizationId: string;
  portalUrl: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const resend = new Resend(resendApiKey);

    const { formalizationId, portalUrl }: SignatureRequestPayload = await req.json();

    if (!formalizationId) {
      throw new Error("formalizationId is required");
    }

    console.log(`Sending signature request emails for formalization: ${formalizationId}`);

    // Get formalization details
    const { data: formalization, error: formError } = await supabase
      .from("formalizations")
      .select("id, title, summary, type, project_id")
      .eq("id", formalizationId)
      .single();

    if (formError || !formalization) {
      throw new Error(`Formalization not found: ${formError?.message}`);
    }

    // Get project name if exists
    let projectName = "Seu Projeto";
    if (formalization.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", formalization.project_id)
        .single();
      if (project) {
        projectName = project.name;
      }
    }

    // Get parties that must sign
    const { data: parties, error: partiesError } = await supabase
      .from("formalization_parties")
      .select("id, display_name, email, party_type, must_sign")
      .eq("formalization_id", formalizationId)
      .eq("must_sign", true);

    if (partiesError) {
      throw new Error(`Error fetching parties: ${partiesError.message}`);
    }

    if (!parties || parties.length === 0) {
      console.log("No parties require signature");
      return new Response(
        JSON.stringify({ success: true, emailsSent: 0, message: "No parties require signature" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signatureUrl = `${portalUrl}/obra/${formalization.project_id}/formalizacoes/${formalizationId}`;
    const logoUrl = "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";

    // Type label mapping
    const typeLabels: Record<string, string> = {
      budget_item_swap: "Troca de Item de Orçamento",
      meeting_minutes: "Ata de Reunião",
      exception_custody: "Termo de Responsabilidade",
      scope_change: "Alteração de Escopo",
      additive: "Aditivo Contratual",
    };

    const typeLabel = typeLabels[formalization.type] || formalization.type;

    let emailsSent = 0;
    const errors: string[] = [];

    for (const party of parties) {
      if (!party.email) {
        console.log(`Skipping party ${party.display_name}: no email`);
        continue;
      }

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
                Olá, ${party.display_name}!
              </h1>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Você tem um documento aguardando sua assinatura digital.
              </p>
              
              <!-- Document Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #7c3aed; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px 0;">
                      ${typeLabel}
                    </p>
                    <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">
                      ${formalization.title}
                    </h2>
                    <p style="color: #666666; font-size: 14px; line-height: 1.5; margin: 0 0 12px 0;">
                      ${formalization.summary || ""}
                    </p>
                    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                      Projeto: <strong style="color: #6b7280;">${projectName}</strong>
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${signatureUrl}" 
                       target="_blank"
                       style="display: inline-block; background: linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                      Acessar e Assinar Documento
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 24px 0 0 0;">
                Ou copie e cole este link no navegador:<br/>
                <a href="${signatureUrl}" style="color: #7c3aed; word-break: break-all;">${signatureUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px;">
                    <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
                      🔒 <strong>Assinatura digital segura:</strong> Sua assinatura será registrada com data, hora, IP e identificação única para garantir autenticidade e validade jurídica.
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
                Este email foi enviado porque você foi adicionado como parte interessada em um documento formal.
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

      try {
        const { error: emailError } = await resend.emails.send({
          from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
          to: [party.email],
          subject: `Assinatura Pendente: ${formalization.title}`,
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Failed to send email to ${party.email}:`, emailError);
          errors.push(`${party.email}: ${emailError.message}`);
        } else {
          console.log(`Email sent successfully to ${party.email}`);
          emailsSent++;
        }
      } catch (emailErr) {
        console.error(`Error sending email to ${party.email}:`, emailErr);
        errors.push(`${party.email}: ${emailErr instanceof Error ? emailErr.message : 'Unknown error'}`);
      }
    }

    // Log domain event for emails sent
    if (emailsSent > 0) {
      await supabase.from("formalization_events").insert({
        formalization_id: formalizationId,
        event_type: "notification_sent",
        meta: { emails_sent: emailsSent, parties_notified: parties.filter(p => p.email).map(p => p.email) },
      });
    }

    console.log(`Signature request emails complete: ${emailsSent} sent, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent, 
        errors: errors.length > 0 ? errors : undefined 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-signature-request:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
