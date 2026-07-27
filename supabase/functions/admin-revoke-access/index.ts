/* eslint-disable no-console */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * Operação administrativa: revoga o acesso de um usuário (bloqueio + logout
 * global de todos os aparelhos), sem apagar a conta. Protegida por
 * ADMIN_OPS_KEY (header x-admin-ops-key).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const opsKey = Deno.env.get("ADMIN_OPS_KEY");
  if (!opsKey || req.headers.get("x-admin-ops-key") !== opsKey) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const { user_id, action } = await req.json();
  if (!user_id) return jsonResponse({ error: "user_id is required" }, 400);

  const banDuration = action === "restore" ? "none" : "876000h"; // ~100 anos

  const { error: updErr } = await admin.auth.admin.updateUserById(user_id, {
    ban_duration: banDuration,
  });
  if (updErr) return jsonResponse({ error: updErr.message }, 400);

  if (action !== "restore") {
    const { error: soErr } = await admin.auth.admin.signOut(user_id, "global");
    if (soErr) console.error("signOut error", soErr.message);
  }

  return jsonResponse({ success: true, user_id, ban_duration: banDuration });
});
