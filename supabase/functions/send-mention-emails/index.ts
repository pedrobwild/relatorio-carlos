import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";
import { diaEmSaoPaulo, horaDeLembrete, pendenciaAtrasada } from "../_shared/diasUteis.ts";
import {
  assuntoDoEmail,
  htmlDoEmail,
  textoDoEmail,
  type MencaoEmailKind,
} from "../_shared/mencaoEmail.ts";

/**
 * send-mention-emails
 *
 * Envia os e-mails das marcações em observações internas (só equipe):
 * "marcaram você", "resolveram o que você pediu" e o lembrete diário das
 * pendências abertas há mais de 24 horas úteis.
 *
 * Chamada pelo banco (gatilho e pg_cron) com x-mention-email-token, ou com a
 * chave de serviço. Não aceita chamada de usuário.
 *
 * Segredos: RESEND_API_KEY (obrigatório), MENTION_EMAIL_FROM e PORTAL_URL (opcionais).
 *
 * O cliente nunca recebe: só envia para usuário ATIVO que seja equipe (is_staff).
 */

const REMETENTE_PADRAO = "Bwild Workflow <noreply@updates.bfreitasdesign.com.br>";

interface FilaRow {
  id: string;
  mention_id: string;
  kind: MencaoEmailKind;
  to_user_id: string;
  cc_user_id: string | null;
  attempts: number;
}
interface Mencao {
  id: string;
  note_id: string;
  project_id: string;
  mentioned_user_id: string;
  mentioned_name: string;
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolution_note: string | null;
  archived_at: string | null;
}
interface Perfil { id: string; nome: string | null; email: string | null; status: string | null }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Use POST" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── só o banco ou a chave de serviço chamam ──
  const token = req.headers.get("x-mention-email-token");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let autorizado = false;
  if (token) {
    const { data, error } = await admin.rpc("internal_mention_email_token_ok", { p_token: token });
    autorizado = !error && data === true;
  } else if (bearer && bearer === serviceKey) {
    autorizado = true;
  }
  if (!autorizado) return jsonResponse({ error: "Não autorizado" }, 401);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Nada é marcado como tentado: a fila espera a chave ser configurada.
    return jsonResponse({ error: "RESEND_API_KEY não configurada", faltando: ["RESEND_API_KEY"] }, 503);
  }
  const remetente = Deno.env.get("MENTION_EMAIL_FROM") || REMETENTE_PADRAO;
  const portal = (Deno.env.get("PORTAL_URL") || "https://bwildworkflow.com").replace(/\/+$/, "");
  const agora = new Date();
  const resumo = { lembretes: 0, enviados: 0, ignorados: 0, falharam: 0 };

  try {
    // ── 1) lembretes do dia (dia útil, 9h–18h de São Paulo) ──
    if (horaDeLembrete(agora)) {
      const { data: abertas, error } = await admin
        .from("project_internal_note_mentions")
        .select("id, project_id, mentioned_user_id, requested_by, created_at")
        .is("resolved_at", null)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw new Error(`Leitura das pendências falhou: ${error.message}`);
      const atrasadas = (abertas ?? []).filter((m) => pendenciaAtrasada(m.created_at, agora));
      if (atrasadas.length > 0) {
        const { data: obras } = await admin
          .from("projects")
          .select("id, painel_responsavel_id")
          .in("id", [...new Set(atrasadas.map((m) => m.project_id))]);
        const responsavel = new Map((obras ?? []).map((o) => [o.id, o.painel_responsavel_id as string | null]));
        const dia = diaEmSaoPaulo(agora);
        const linhas = atrasadas.map((m) => {
          const resp = responsavel.get(m.project_id) ?? null;
          return {
            mention_id: m.id,
            kind: "lembrete",
            dia,
            to_user_id: m.mentioned_user_id,
            cc_user_id: resp && resp !== m.mentioned_user_id ? resp : null,
          };
        });
        const { data: novas, error: insErr } = await admin
          .from("internal_mention_emails")
          .upsert(linhas, { onConflict: "mention_id,kind,dia", ignoreDuplicates: true })
          .select("id");
        if (insErr) throw new Error(`Fila de lembretes falhou: ${insErr.message}`);
        resumo.lembretes = novas?.length ?? 0;
      }
    }

    // ── 2) envia a fila ──
    const { data: lote, error: claimErr } = await admin.rpc("internal_mention_emails_claim", { p_limit: 30 });
    if (claimErr) throw new Error(`Fila falhou: ${claimErr.message}`);
    const fila = (lote ?? []) as FilaRow[];
    if (fila.length === 0) return jsonResponse({ ok: true, ...resumo });

    const { data: mencoes } = await admin
      .from("project_internal_note_mentions")
      .select("id, note_id, project_id, mentioned_user_id, mentioned_name, requested_by, requested_by_name, created_at, resolved_at, resolved_by_name, resolution_note, archived_at")
      .in("id", [...new Set(fila.map((f) => f.mention_id))]);
    const mencaoPorId = new Map(((mencoes ?? []) as Mencao[]).map((m) => [m.id, m]));

    const { data: notas } = await admin
      .from("project_internal_notes")
      .select("id, body")
      .in("id", [...new Set([...mencaoPorId.values()].map((m) => m.note_id))]);
    const notaPorId = new Map((notas ?? []).map((n) => [n.id as string, (n.body as string) ?? ""]));

    const { data: projetos } = await admin
      .from("projects")
      .select("id, name")
      .in("id", [...new Set([...mencaoPorId.values()].map((m) => m.project_id))]);
    const obraPorId = new Map((projetos ?? []).map((p) => [p.id as string, (p.name as string) ?? "Obra"]));

    const pessoas = [...new Set(fila.flatMap((f) => [f.to_user_id, f.cc_user_id]).filter(Boolean) as string[])];
    const { data: perfis } = await admin
      .from("users_profile")
      .select("id, nome, email, status")
      .in("id", pessoas);
    const perfilPorId = new Map(((perfis ?? []) as Perfil[]).map((p) => [p.id, p]));

    // Só equipe ativa recebe. Conferido no banco, pessoa por pessoa.
    const equipe = new Map<string, boolean>();
    for (const id of pessoas) {
      const p = perfilPorId.get(id);
      if (!p?.email || p.status !== "ativo") { equipe.set(id, false); continue; }
      const { data: isStaff } = await admin.rpc("is_staff", { _user_id: id });
      equipe.set(id, isStaff === true);
    }

    const fechar = async (id: string, status: "enviado" | "falhou" | "ignorado", erro?: string) => {
      await admin
        .from("internal_mention_emails")
        .update({ status, error: erro ? erro.slice(0, 500) : null, sent_at: status === "enviado" ? new Date().toISOString() : null })
        .eq("id", id);
    };

    for (const f of fila) {
      const m = mencaoPorId.get(f.mention_id);
      const para = perfilPorId.get(f.to_user_id);
      const obsoleto =
        !m || !!m.archived_at ||
        (f.kind !== "resolvido" && !!m.resolved_at) ||
        (f.kind === "resolvido" && !m.resolved_at);
      if (obsoleto || !para?.email || !equipe.get(f.to_user_id)) {
        await fechar(f.id, "ignorado", obsoleto ? "pendência não está mais nesse estado" : "destinatário não é equipe ativa");
        resumo.ignorados++;
        continue;
      }
      const cc = f.cc_user_id && equipe.get(f.cc_user_id) ? perfilPorId.get(f.cc_user_id)?.email ?? null : null;
      const dados = {
        kind: f.kind,
        destinatarioNome: para.nome || para.email,
        obra: obraPorId.get(m.project_id) ?? "Obra",
        pediu: m.requested_by_name,
        marcado: f.kind === "resolvido" ? (m.resolved_by_name || m.mentioned_name) : m.mentioned_name,
        texto: notaPorId.get(m.note_id) ?? "",
        resposta: m.resolution_note,
        diasAberta: Math.max(1, Math.floor((agora.getTime() - new Date(m.created_at).getTime()) / 86_400_000)),
        link: f.kind === "resolvido" ? `${portal}/obra/${m.project_id}` : `${portal}/gestao/minha-semana`,
      };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            // Reenvio da mesma linha não duplica o e-mail.
            "Idempotency-Key": `mencao-${f.id}`,
          },
          body: JSON.stringify({
            from: remetente,
            to: [para.email],
            ...(cc && cc !== para.email ? { cc: [cc] } : {}),
            subject: assuntoDoEmail(dados),
            html: htmlDoEmail(dados),
            text: textoDoEmail(dados),
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
        await fechar(f.id, "enviado");
        resumo.enviados++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[send-mention-emails]", f.id, msg);
        await fechar(f.id, "falhou", msg);
        resumo.falharam++;
      }
    }
    return jsonResponse({ ok: true, ...resumo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-mention-emails]", msg);
    return jsonResponse({ ok: false, error: msg, ...resumo }, 500);
  }
});
