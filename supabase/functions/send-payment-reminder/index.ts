/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logoUrl = "https://fvblcyzdcqkiihyhfrrw.supabase.co/storage/v1/object/public/email-assets/bwild-logo.png?v=1";
const portalUrl = Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com";

serve(async (req: Request) => {
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

    // Get current date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate 5 days from now
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    const targetDate = fiveDaysFromNow.toISOString().split('T')[0];

    console.log(`Checking for payments due on ${targetDate}`);

    // Find payments due in 5 days with boleto attached and not yet notified
    const { data: payments, error: paymentsError } = await supabase
      .from('project_payments')
      .select(`
        id,
        description,
        amount,
        due_date,
        boleto_path,
        project_id
      `)
      .eq('due_date', targetDate)
      .not('boleto_path', 'is', null)
      .is('paid_at', null)
      .is('notification_sent_at', null);

    if (paymentsError) {
      console.error("Error fetching payments:", paymentsError);
      throw paymentsError;
    }

    console.log(`Found ${payments?.length || 0} payments to notify`);

    if (!payments || payments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No payments to notify", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const payment of payments) {
      // Get project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('name')
        .eq('id', payment.project_id)
        .single();

      if (projectError) {
        console.error(`Error fetching project for payment ${payment.id}:`, projectError);
        results.failed.push(payment.id);
        continue;
      }

      // Get customer email from project_customers
      const { data: customerData, error: customerError } = await supabase
        .from('project_customers')
        .select('customer_email, customer_name')
        .eq('project_id', payment.project_id)
        .limit(1)
        .maybeSingle();

      if (customerError || !customerData?.customer_email) {
        console.error(`No customer email for payment ${payment.id}:`, customerError);
        results.failed.push(payment.id);
        continue;
      }

      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(payment.amount);

      const formattedDate = new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR');

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
                Olá, ${customerData.customer_name || 'Cliente'}!
              </h1>
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Este é um lembrete de que você tem um boleto que vencerá em <strong>5 dias</strong>.
              </p>
              
              <!-- Payment Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px 0;">
                      Projeto: <strong style="color: #6b7280;">${projectData.name}</strong>
                    </p>
                    <h2 style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">
                      ${payment.description}
                    </h2>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td>
                          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px 0;">Valor</p>
                          <p style="color: #1a1a1a; font-size: 20px; font-weight: 700; margin: 0;">${formattedAmount}</p>
                        </td>
                        <td align="right">
                          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px 0;">Vencimento</p>
                          <p style="color: #7c3aed; font-size: 18px; font-weight: 600; margin: 0;">${formattedDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}/obra/${payment.project_id}/financeiro" 
                       target="_blank"
                       style="display: inline-block; background: linear-gradient(135deg, #6B21A8 0%, #7C3AED 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                      Acessar Portal e Baixar Boleto
                    </a>
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
                Este é um email automático. Caso tenha dúvidas, entre em contato com nossa equipe.
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
        const emailResponse = await resend.emails.send({
          from: "Bwild <noreply@updates.bfreitasdesign.com.br>",
          to: [customerData.customer_email],
          subject: `Lembrete: Boleto vence em 5 dias - ${projectData.name}`,
          html: emailHtml,
        });

        console.log(`Email sent for payment ${payment.id}:`, emailResponse);

        // Mark notification as sent
        const { error: updateError } = await supabase
          .from('project_payments')
          .update({ notification_sent_at: new Date().toISOString() })
          .eq('id', payment.id);

        if (updateError) {
          console.error(`Error updating notification status for ${payment.id}:`, updateError);
        }

        results.success.push(payment.id);
      } catch (emailError) {
        console.error(`Failed to send email for payment ${payment.id}:`, emailError);
        results.failed.push(payment.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment reminders processed",
        emailsSent: results.success.length,
        failed: results.failed.length,
        details: results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-payment-reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
