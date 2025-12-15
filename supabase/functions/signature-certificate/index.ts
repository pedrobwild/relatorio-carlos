import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PARTY_TYPE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  company: 'Representante da Empresa',
};

function formatDateTime(dateString: string): { date: string; time: string; iso: string } {
  const d = new Date(dateString);
  return {
    date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    iso: d.toISOString(),
  };
}

function parseUserAgent(ua: string | null): { browser: string; os: string; device: string } {
  if (!ua) return { browser: 'Desconhecido', os: 'Desconhecido', device: 'Desconhecido' };
  
  let browser = 'Desconhecido';
  let os = 'Desconhecido';
  let device = 'Desktop';

  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
  else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) device = 'Dispositivo Móvel';
  else if (ua.includes('iPad') || ua.includes('Tablet')) device = 'Tablet';

  return { browser, os, device };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { formalization_id, party_id } = await req.json();

    if (!formalization_id || !party_id) {
      return new Response(
        JSON.stringify({ error: 'formalization_id and party_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating signature certificate for party ${party_id} in formalization ${formalization_id}`);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Fetch formalization
    const { data: formalization, error: fetchError } = await supabase
      .from('formalizations_public_customer')
      .select('*')
      .eq('id', formalization_id)
      .maybeSingle();

    if (fetchError || !formalization) {
      console.error('Error fetching formalization:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Formalization not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parties = (formalization.parties as any[]) || [];
    const acknowledgements = (formalization.acknowledgements as any[]) || [];

    // Find the specific party and acknowledgement
    const party = parties.find((p: any) => p.id === party_id);
    const ack = acknowledgements.find((a: any) => a.party_id === party_id);

    if (!party) {
      return new Response(
        JSON.stringify({ error: 'Party not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ack) {
      return new Response(
        JSON.stringify({ error: 'No acknowledgement found for this party' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found party: ${party.display_name}, acknowledged at: ${ack.acknowledged_at}`);

    // Create PDF Certificate
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

    // ===== HEADER WITH BORDER =====
    doc.setDrawColor(75, 85, 99);
    doc.setLineWidth(0.5);
    doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - margin * 2 + 10);

    // Title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('CERTIFICADO DE ASSINATURA', pageWidth / 2, y + 10, { align: 'center' });
    y += 20;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('DIGITAL', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Decorative line
    doc.setDrawColor(147, 51, 234);
    doc.setLineWidth(1);
    doc.line(margin + 30, y, pageWidth - margin - 30, y);
    y += 15;

    // ===== DOCUMENT INFO =====
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('DOCUMENTO', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Título: ${formalization.title || '-'}`, margin, y);
    y += 5;
    doc.text(`Tipo: ${formalization.type || '-'}`, margin, y);
    y += 5;
    doc.text(`ID: ${formalization_id}`, margin, y);
    y += 12;

    // ===== SIGNATORY INFO =====
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('SIGNATÁRIO', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Nome: ${party.display_name}`, margin, y);
    y += 5;
    doc.text(`Função: ${party.role_label || PARTY_TYPE_LABELS[party.party_type] || party.party_type}`, margin, y);
    y += 5;
    doc.text(`E-mail: ${ack.acknowledged_by_email || party.email || '-'}`, margin, y);
    y += 12;

    // ===== SIGNATURE STATEMENT =====
    if (ack.signature_text) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('DECLARAÇÃO', margin, y);
      y += 7;

      doc.setFont('helvetica', 'italic');
      doc.setTextColor(60, 60, 60);
      const statementLines = doc.splitTextToSize(`"${ack.signature_text}"`, contentWidth);
      doc.text(statementLines, margin, y);
      y += statementLines.length * 5 + 7;
    }

    // ===== TIMESTAMP INFO =====
    const dateTime = formatDateTime(ack.acknowledged_at);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('DATA E HORA DA ASSINATURA', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Data: ${dateTime.date}`, margin, y);
    y += 5;
    doc.text(`Hora: ${dateTime.time}`, margin, y);
    y += 5;
    doc.text(`Timestamp ISO 8601: ${dateTime.iso}`, margin, y);
    y += 5;
    doc.text(`Fuso horário: America/Sao_Paulo (UTC-3)`, margin, y);
    y += 12;

    // ===== TECHNICAL INFO =====
    const deviceInfo = parseUserAgent(ack.user_agent);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('DADOS TÉCNICOS DE IDENTIFICAÇÃO', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(`Endereço IP: ${ack.ip_address || 'Não capturado'}`, margin, y);
    y += 5;
    doc.text(`Navegador: ${deviceInfo.browser}`, margin, y);
    y += 5;
    doc.text(`Sistema Operacional: ${deviceInfo.os}`, margin, y);
    y += 5;
    doc.text(`Tipo de Dispositivo: ${deviceInfo.device}`, margin, y);
    y += 12;

    // ===== HASH INFO =====
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('VERIFICAÇÃO CRIPTOGRÁFICA', margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);

    if (formalization.locked_hash) {
      doc.text('Hash do Documento (SHA-256):', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.text(formalization.locked_hash, margin, y);
      y += 7;
    }

    if (ack.signature_hash) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Hash da Assinatura (SHA-256):', margin, y);
      y += 5;
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.text(ack.signature_hash, margin, y);
      y += 10;
    }

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const hashNote = 'O hash da assinatura é calculado a partir do hash do documento, ID da parte, timestamp, identificador do usuário, endereço IP e user agent.';
    const hashNoteLines = doc.splitTextToSize(hashNote, contentWidth);
    doc.text(hashNoteLines, margin, y);
    y += hashNoteLines.length * 4 + 15;

    // ===== LEGAL NOTICE =====
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    doc.text('VALIDADE JURÍDICA', margin, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);

    const legalText = [
      'Este certificado de assinatura eletrônica possui validade jurídica nos termos da Lei nº 14.063/2020,',
      'que dispõe sobre o uso de assinaturas eletrônicas em interações com entes públicos, em atos de pessoas',
      'jurídicas e em questões de saúde, e da Medida Provisória nº 2.200-2/2001, que institui a Infraestrutura',
      'de Chaves Públicas Brasileira (ICP-Brasil).',
      '',
      'A integridade do documento é garantida por função hash criptográfica SHA-256. Os dados de identificação',
      '(endereço IP, dispositivo, navegador, data e hora) são coletados automaticamente no momento da assinatura',
      'e servem como evidência de autenticidade e não-repúdio.',
      '',
      'A verificação da autenticidade deste certificado pode ser realizada através da comparação dos hashes',
      'criptográficos com os registros armazenados no sistema de origem.',
    ];

    for (const line of legalText) {
      doc.text(line, margin, y);
      y += 3.5;
    }

    // ===== FOOTER =====
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Certificado gerado em ${new Date().toLocaleString('pt-BR')} | Formalização: ${formalization_id.substring(0, 8)}`,
      pageWidth / 2,
      pageHeight - 12,
      { align: 'center' }
    );

    // QR-like box (placeholder for future QR code)
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(250, 250, 250);
    doc.rect(pageWidth - margin - 25, pageHeight - 35, 25, 25, 'FD');
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('Verificação', pageWidth - margin - 12.5, pageHeight - 12, { align: 'center' });

    const pdfOutput = doc.output('arraybuffer');

    console.log(`Signature certificate generated for party: ${party.display_name}`);

    return new Response(pdfOutput, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificado-assinatura-${party.display_name.replace(/\s+/g, '-').toLowerCase()}.pdf"`,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating signature certificate:', errorMessage);
    return new Response(
      JSON.stringify({ error: 'Failed to generate certificate', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
