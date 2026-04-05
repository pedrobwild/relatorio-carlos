# Envision Build Guide — Integration Reference

## Overview

This document contains the reference implementation for the Envision side of the bidirectional supplier sync with Portal BWild.

## Secrets to configure in the Envision project

| Secret | Value |
|---|---|
| `INTEGRATION_API_KEY` | Same key used in Portal BWild |
| `PORTAL_BWILD_SUPABASE_URL` | `https://fvblcyzdcqkiihyhfrrw.supabase.co` |
| `PORTAL_BWILD_SERVICE_ROLE_KEY` | Service role key of Portal BWild |

## Database: integration_sync_log

Create the same table in the Envision project:

```sql
CREATE TABLE public.integration_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_system TEXT NOT NULL,
  target_system TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_id UUID,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB,
  error_message TEXT,
  attempts INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  synced_at TIMESTAMPTZ,
  UNIQUE(source_system, entity_type, source_id)
);

ALTER TABLE public.integration_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync logs"
  ON public.integration_sync_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

## Edge Function: sync-suppliers-inbound (for Envision)

Create `supabase/functions/sync-suppliers-inbound/index.ts` in the Envision project.
This function receives suppliers FROM Portal BWild and upserts into Envision's `suppliers` table.

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-integration-key',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const integrationKey = Deno.env.get("INTEGRATION_API_KEY");
    const incomingKey = req.headers.get("x-integration-key");
    if (!integrationKey || !incomingKey || incomingKey !== integrationKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();
    const { name, razao_social, cnpj_cpf, categoria, endereco, cidade, estado,
            email, telefone, site, condicoes_pagamento, prazo_entrega_dias,
            produtos_servicos, nota, is_active, _source_system, _source_id } = payload;

    // Check existing sync
    const { data: existingSync } = await supabaseAdmin
      .from("integration_sync_log")
      .select("id, target_id")
      .eq("source_system", _source_system)
      .eq("entity_type", "supplier")
      .eq("source_id", _source_id)
      .maybeSingle();

    const supplierData = {
      name, razao_social, cnpj_cpf, categoria, endereco, cidade, estado,
      email, telefone, site, condicoes_pagamento, prazo_entrega_dias,
      produtos_servicos, nota, is_active: is_active !== false,
    };

    let targetId;

    if (existingSync?.target_id) {
      await supabaseAdmin.from("suppliers").update(supplierData).eq("id", existingSync.target_id);
      targetId = existingSync.target_id;
    } else {
      const { data } = await supabaseAdmin.from("suppliers").insert(supplierData).select("id").single();
      targetId = data?.id;
    }

    // Log sync
    if (existingSync) {
      await supabaseAdmin.from("integration_sync_log").update({
        target_id: targetId, sync_status: "success", synced_at: new Date().toISOString(), payload,
      }).eq("id", existingSync.id);
    } else {
      await supabaseAdmin.from("integration_sync_log").insert({
        source_system: _source_system, target_system: "envision",
        entity_type: "supplier", source_id: _source_id,
        target_id: targetId, sync_status: "success",
        synced_at: new Date().toISOString(), payload,
      });
    }

    return new Response(JSON.stringify({ success: true, target_id: targetId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

## Edge Function: sync-suppliers-outbound (for Envision)

Create `supabase/functions/sync-suppliers-outbound/index.ts` in the Envision project.
This function pushes Envision suppliers TO Portal BWild.

```typescript
// Similar structure to Portal BWild's outbound function.
// Reads from Envision's `suppliers` table, calls Portal BWild's
// `sync-suppliers-inbound` edge function with the mapped payload.
// Uses PORTAL_BWILD_SUPABASE_URL and PORTAL_BWILD_SERVICE_ROLE_KEY.
```

## Field Mapping

| Portal BWild (fornecedores) | Envision (suppliers) |
|---|---|
| nome | name |
| razao_social | razao_social |
| cnpj_cpf | cnpj_cpf |
| categoria | categoria |
| endereco | endereco |
| cidade | cidade |
| estado | estado |
| email | email |
| telefone | telefone |
| site | site |
| condicoes_pagamento | condicoes_pagamento |
| prazo_entrega_dias | prazo_entrega_dias |
| produtos_servicos | produtos_servicos |
| nota_avaliacao | nota |
| status (ativo/inativo) | is_active (boolean) |
