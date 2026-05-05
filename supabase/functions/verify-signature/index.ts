/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signature_hash } = await req.json();

    if (!signature_hash) {
      return new Response(
        JSON.stringify({ valid: false, error: 'signature_hash is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying signature hash: ${signature_hash.substring(0, 16)}...`);

    // Use service role key to bypass RLS for public verification
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find acknowledgement by signature hash
    const { data: acknowledgement, error: ackError } = await supabase
      .from('formalization_acknowledgements')
      .select('*')
      .eq('signature_hash', signature_hash)
      .maybeSingle();

    if (ackError) {
      console.error('Error fetching acknowledgement:', ackError);
      return new Response(
        JSON.stringify({ valid: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!acknowledgement) {
      console.log('Signature not found');
      return new Response(
        JSON.stringify({ valid: false, error: 'Assinatura não encontrada no sistema' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get party info
    const { data: party, error: partyError } = await supabase
      .from('formalization_parties')
      .select('*')
      .eq('id', acknowledgement.party_id)
      .maybeSingle();

    if (partyError) {
      console.error('Error fetching party:', partyError);
    }

    // Get formalization info (limited fields for public display)
    const { data: formalization, error: formError } = await supabase
      .from('formalizations')
      .select('id, title, type, status, locked_hash, locked_at')
      .eq('id', acknowledgement.formalization_id)
      .maybeSingle();

    if (formError) {
      console.error('Error fetching formalization:', formError);
    }

    console.log(`Signature verified for: ${party?.display_name || 'Unknown'}`);

    return new Response(
      JSON.stringify({
        valid: true,
        formalization: formalization ? {
          id: formalization.id,
          title: formalization.title,
          type: formalization.type,
          status: formalization.status,
          locked_hash: formalization.locked_hash,
          locked_at: formalization.locked_at,
        } : null,
        party: party ? {
          display_name: party.display_name,
          role_label: party.role_label,
          party_type: party.party_type,
          email: party.email,
        } : null,
        acknowledgement: {
          acknowledged_at: acknowledgement.acknowledged_at,
          acknowledged_by_email: acknowledgement.acknowledged_by_email,
          signature_hash: acknowledgement.signature_hash,
          ip_address: acknowledgement.ip_address,
          user_agent: acknowledgement.user_agent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error verifying signature:', errorMessage);
    return new Response(
      JSON.stringify({ valid: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
