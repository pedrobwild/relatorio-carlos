import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface PaymentWithProject {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  boleto_path: string;
  project_id: string;
  project_name: string;
  customer_email: string;
  customer_name: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
        JSON.stringify({ message: "No payments to notify", count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

    for (const payment of payments) {
      // Get project details and customer email
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
        .single();

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

      try {
        const emailResponse = await resend.emails.send({
          from: "Bwild <noreply@bwild.com.br>",
          to: [customerData.customer_email],
          subject: `Lembrete: Boleto vence em 5 dias - ${projectData.name}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; margin-bottom: 20px;">Lembrete de Pagamento</h2>
              
              <p style="color: #555;">Olá ${customerData.customer_name || 'Cliente'},</p>
              
              <p style="color: #555;">Este é um lembrete de que você tem um boleto que vencerá em <strong>5 dias</strong>.</p>
              
              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0; color: #333;"><strong>Obra:</strong> ${projectData.name}</p>
                <p style="margin: 0 0 10px 0; color: #333;"><strong>Parcela:</strong> ${payment.description}</p>
                <p style="margin: 0 0 10px 0; color: #333;"><strong>Valor:</strong> ${formattedAmount}</p>
                <p style="margin: 0; color: #333;"><strong>Vencimento:</strong> ${formattedDate}</p>
              </div>
              
              <p style="color: #555;">Acesse o portal para baixar o boleto e efetuar o pagamento.</p>
              
              <p style="color: #888; font-size: 12px; margin-top: 30px;">
                Este é um email automático enviado pelo sistema Bwild.
              </p>
            </div>
          `,
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
        message: "Payment reminders processed",
        success: results.success.length,
        failed: results.failed.length,
        details: results
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-payment-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
