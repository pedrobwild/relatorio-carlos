/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FORMALIZATION_TYPE_LABELS: Record<string, string> = {
  budget_item_swap: 'Troca de Item de Orçamento',
  meeting_minutes: 'Ata de Reunião',
  exception_custody: 'Custódia de Item',
  scope_change: 'Alteração de Escopo',
  general: 'Formalização Geral',
};

const FORMALIZATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  pending_signatures: 'Aguardando Assinaturas',
  signed: 'Assinado',
  voided: 'Anulado',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Simple markdown to plain text conversion
function markdownToPlainText(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '\n$1\n')
    .replace(/^## (.+)$/gm, '\n$1\n')
    .replace(/^# (.+)$/gm, '\n$1\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/\n{3,}/g, '\n\n');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formalization_id } = await req.json();

    if (!formalization_id) {
      console.error('Missing formalization_id');
      return new Response(
        JSON.stringify({ error: 'formalization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating PDF for formalization: ${formalization_id}`);

    // Get auth header from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth context (RLS will apply)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Fetch formalization with all related data using the view
    const { data: formalization, error: fetchError } = await supabase
      .from('formalizations_public_customer')
      .select('*')
      .eq('id', formalization_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching formalization:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch formalization', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!formalization) {
      console.error('Formalization not found or access denied');
      return new Response(
        JSON.stringify({ error: 'Formalization not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found formalization: ${formalization.title}, status: ${formalization.status}`);

    const parties = (formalization.parties as any[]) || [];
    const acknowledgements = (formalization.acknowledgements as any[]) || [];
    const evidenceLinks = (formalization.evidence_links as any[]) || [];
    const attachments = (formalization.attachments as any[]) || [];

    // Create PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // Helper to add watermark if not signed
    const addWatermark = () => {
      if (formalization.status !== 'signed') {
        doc.setFontSize(60);
        doc.setTextColor(200, 200, 200);
        doc.text('PENDENTE', pageWidth / 2, pageHeight / 2, {
          align: 'center',
          angle: 45,
        });
        doc.setTextColor(0, 0, 0);
      }
    };

    // Helper to check page break
    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        addWatermark();
        y = margin;
      }
    };

    // Add watermark to first page
    addWatermark();

    // ===== HEADER =====
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('FORMALIZAÇÃO', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(formalization.title || '', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Type and Status badges
    doc.setFontSize(10);
    const typeLabel = FORMALIZATION_TYPE_LABELS[formalization.type as string] || formalization.type;
    const statusLabel = FORMALIZATION_STATUS_LABELS[formalization.status as string] || formalization.status;
    doc.text(`${typeLabel} | ${statusLabel}`, pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Date info
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const createdAt = formatDate(formalization.created_at);
    const lockedAt = formalization.locked_at ? formatDate(formalization.locked_at) : null;
    doc.text(`Criado em: ${createdAt}${lockedAt ? ` | Travado em: ${lockedAt}` : ''}`, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // ===== SUMMARY =====
    if (formalization.summary) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      const summaryLines = doc.splitTextToSize(formalization.summary, contentWidth);
      checkPageBreak(summaryLines.length * 5);
      doc.text(summaryLines, margin, y);
      y += summaryLines.length * 5 + 8;
    }

    // ===== CONTENT =====
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    checkPageBreak(10);
    doc.text('CONTEÚDO', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const bodyText = markdownToPlainText(formalization.body_md || '');
    const bodyLines = doc.splitTextToSize(bodyText, contentWidth);
    
    for (const line of bodyLines) {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 10;

    // ===== SIGNATURES =====
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    checkPageBreak(10);
    doc.text('ASSINATURAS', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    if (parties.length === 0) {
      doc.text('Nenhuma parte definida.', margin, y);
      y += 6;
    } else {
      for (const party of parties) {
        checkPageBreak(20);
        
        const ack = acknowledgements.find((a: any) => a.party_id === party.id);
        const partyType = party.party_type === 'customer' ? 'Cliente' : 'Empresa';
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${party.display_name}`, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(` (${party.role_label || partyType})`, margin + doc.getTextWidth(`${party.display_name} `), y);
        y += 5;

        if (ack) {
          doc.setTextColor(0, 128, 0);
          doc.text(`✓ Assinado em: ${formatDate(ack.acknowledged_at)}`, margin + 5, y);
          y += 4;
          if (ack.acknowledged_by_email) {
            doc.text(`  Email: ${ack.acknowledged_by_email}`, margin + 5, y);
            y += 4;
          }
          doc.setTextColor(0, 0, 0);
        } else {
          doc.setTextColor(200, 100, 0);
          doc.text('○ Pendente de assinatura', margin + 5, y);
          doc.setTextColor(0, 0, 0);
          y += 4;
        }
        y += 4;
      }
    }
    y += 5;

    // ===== DOCUMENT HASH =====
    if (formalization.locked_hash) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      checkPageBreak(25);
      doc.text('INTEGRIDADE DO DOCUMENTO', margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Hash SHA-256:', margin, y);
      y += 5;
      
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      // Split hash into two lines for better readability
      const hash = formalization.locked_hash;
      doc.text(hash.substring(0, 32), margin, y);
      y += 4;
      doc.text(hash.substring(32), margin, y);
      y += 6;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(150, 0, 0);
      doc.text('Qualquer alteração no conteúdo invalida este hash.', margin, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    }

    // ===== EVIDENCE LINKS =====
    if (evidenceLinks.length > 0) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      checkPageBreak(10);
      doc.text('LINKS DE EVIDÊNCIA', margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      for (const link of evidenceLinks) {
        checkPageBreak(10);
        const label = link.description || link.kind;
        doc.text(`• ${label}`, margin, y);
        y += 4;
        doc.setTextColor(0, 0, 200);
        doc.text(`  ${link.url}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 5;
      }
      y += 5;
    }

    // ===== ATTACHMENTS =====
    if (attachments.length > 0) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      checkPageBreak(10);
      doc.text('ANEXOS', margin, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      for (const attachment of attachments) {
        checkPageBreak(6);
        doc.text(`• ${attachment.original_filename}`, margin, y);
        y += 5;
      }
      y += 5;
    }

    // ===== FOOTER =====
    const footerY = pageHeight - 10;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Documento gerado em ${new Date().toLocaleString('pt-BR')} | ID: ${formalization_id}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );

    // Generate PDF as base64
    const pdfOutput = doc.output('arraybuffer');

    console.log(`PDF generated successfully for formalization: ${formalization_id}`);

    return new Response(pdfOutput, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="formalizacao-${formalization_id.substring(0, 8)}.pdf"`,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating PDF:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to generate PDF', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
