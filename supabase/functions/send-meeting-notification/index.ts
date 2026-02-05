 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { Resend } from "https://esm.sh/resend@2.0.0";
 
 const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 interface MeetingNotificationRequest {
   slotId: string;
   projectName: string;
   customerName: string;
   customerEmail: string;
   slotDatetime: string;
   stageName: string;
 }
 
 const handler = async (req: Request): Promise<Response> => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { slotId, projectName, customerName, customerEmail, slotDatetime, stageName }: MeetingNotificationRequest = await req.json();
 
     if (!slotId || !projectName || !customerName || !slotDatetime) {
       throw new Error("Missing required fields");
     }
 
     // Format datetime for display
     const dateObj = new Date(slotDatetime);
     const formattedDate = dateObj.toLocaleDateString('pt-BR', {
       weekday: 'long',
       year: 'numeric',
       month: 'long',
       day: 'numeric',
     });
     const formattedTime = dateObj.toLocaleTimeString('pt-BR', {
       hour: '2-digit',
       minute: '2-digit',
     });
 
     const emailResponse = await resend.emails.send({
       from: "BWild <noreply@lorenaalvesarq.com>",
       to: ["lorena@lorenaalvesarq.com"],
       subject: `📅 Nova reunião agendada - ${projectName}`,
       html: `
         <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
           <h1 style="color: #333;">Nova Reunião Agendada</h1>
           
           <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
             <p style="margin: 0 0 10px 0;"><strong>Cliente:</strong> ${customerName}</p>
             <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${customerEmail || 'Não informado'}</p>
             <p style="margin: 0 0 10px 0;"><strong>Projeto:</strong> ${projectName}</p>
             <p style="margin: 0 0 10px 0;"><strong>Etapa:</strong> ${stageName}</p>
             <p style="margin: 0 0 10px 0;"><strong>Data:</strong> ${formattedDate}</p>
             <p style="margin: 0;"><strong>Horário:</strong> ${formattedTime}</p>
           </div>
           
           <p style="color: #666; font-size: 14px;">
             Este é um email automático enviado pelo Portal BWild.
           </p>
         </div>
       `,
     });
 
     console.log("Meeting notification sent:", emailResponse);
 
     return new Response(JSON.stringify({ success: true, emailResponse }), {
       status: 200,
       headers: { "Content-Type": "application/json", ...corsHeaders },
     });
   } catch (error: any) {
     console.error("Error in send-meeting-notification:", error);
     return new Response(
       JSON.stringify({ error: error.message }),
       {
         status: 500,
         headers: { "Content-Type": "application/json", ...corsHeaders },
       }
     );
   }
 };
 
 serve(handler);