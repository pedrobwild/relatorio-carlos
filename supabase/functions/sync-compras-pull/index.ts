import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * sync-compras-pull
 *
 * Lê o Bwild Compras (outro projeto Supabase) e atualiza a cópia somente
 * leitura no Workflow. NÃO escreve nada no Compras.
 *
 * Quem pode chamar:
 *  1. Agendamento (pg_cron) — cabeçalho x-compras-sync-token.
 *  2. Equipe interna logada — botão "Atualizar agora".
 *  3. Chave de serviço.
 *
 * Segredos (só no servidor, nunca no navegador):
 *  COMPRAS_SUPABASE_URL, COMPRAS_SUPABASE_ANON_KEY,
 *  COMPRAS_SYNC_EMAIL, COMPRAS_SYNC_PASSWORD  (conta só de leitura no Compras)
 *
 * Body opcional: { origem?: "agendado" | "manual" | "recarga" }
 * A rotina sempre lê a foto completa, então recarregar tudo é só rodar de novo.
 */

const PAGINA = 1000;
const LIMITE_LINHAS = 50000;

async function lerTudo(
  compras: SupabaseClient,
  tabela: string,
  colunas: string,
): Promise<Record<string, unknown>[]> {
  const linhas: Record<string, unknown>[] = [];
  for (let de = 0; de < LIMITE_LINHAS; de += PAGINA) {
    const { data, error } = await compras
      .from(tabela)
      .select(colunas)
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw new Error(`Leitura de ${tabela} falhou: ${error.message}`);
    linhas.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGINA) return linhas;
  }
  throw new Error(`${tabela} passou de ${LIMITE_LINHAS} linhas; rotina interrompida.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Use POST" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: "Configuração do servidor incompleta" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── quem está chamando ──
  let origem = "agendado";
  const cronToken = req.headers.get("x-compras-sync-token");
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  let autorizado = false;

  if (cronToken) {
    const { data, error } = await admin.rpc("compras_sync_token_ok", { p_token: cronToken });
    autorizado = !error && data === true;
  } else if (bearer && bearer === serviceKey) {
    autorizado = true;
  } else if (bearer && anonKey) {
    const comoUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await comoUsuario.auth.getUser();
    if (user) {
      const { data: isStaff } = await admin.rpc("is_staff", { _user_id: user.id });
      autorizado = isStaff === true;
      origem = "manual";
    }
  }
  if (!autorizado) return jsonResponse({ error: "Não autorizado" }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.origem === "recarga" && origem === "manual") origem = "recarga";
  } catch { /* sem corpo */ }

  // ── segredos do Compras ──
  const comprasUrl = Deno.env.get("COMPRAS_SUPABASE_URL");
  const comprasAnon = Deno.env.get("COMPRAS_SUPABASE_ANON_KEY");
  const comprasEmail = Deno.env.get("COMPRAS_SYNC_EMAIL");
  const comprasSenha = Deno.env.get("COMPRAS_SYNC_PASSWORD");
  if (!comprasUrl || !comprasAnon || !comprasEmail || !comprasSenha) {
    return jsonResponse({
      error: "Integração com o Compras ainda não configurada",
      faltando: [
        !comprasUrl && "COMPRAS_SUPABASE_URL",
        !comprasAnon && "COMPRAS_SUPABASE_ANON_KEY",
        !comprasEmail && "COMPRAS_SYNC_EMAIL",
        !comprasSenha && "COMPRAS_SYNC_PASSWORD",
      ].filter(Boolean),
    }, 503);
  }

  // ── abre a rodada (recusa se outra começou há menos de 60 s) ──
  const { data: execucao, error: inicioErr } = await admin.rpc("compras_sync_iniciar", { p_origem: origem });
  if (inicioErr) {
    console.error("[sync-compras-pull] iniciar:", inicioErr.message);
    return jsonResponse({ error: "Não foi possível iniciar a atualização" }, 500);
  }
  if (!execucao) return jsonResponse({ ok: true, pulado: true, motivo: "Atualizado há menos de 1 minuto" });

  try {
    const compras = createClient(comprasUrl, comprasAnon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: loginErr } = await compras.auth.signInWithPassword({
      email: comprasEmail,
      password: comprasSenha,
    });
    if (loginErr) throw new Error(`Login no Compras falhou: ${loginErr.message}`);

    // "*" de propósito: colunas novas do Compras não quebram a leitura;
    // só o que o Workflow conhece é gravado (ver compras_sync_aplicar).
    const [solicitacoes, itens, pedidos] = await Promise.all([
      lerTudo(compras, "painel_solicitacoes", "*"),
      lerTudo(compras, "solicitacao_itens", "*"),
      lerTudo(compras, "compras", "*"),
    ]);
    await compras.auth.signOut().catch(() => undefined);

    const { data: resumo, error: aplicarErr } = await admin.rpc("compras_sync_aplicar", {
      p_execucao: execucao,
      p_solicitacoes: solicitacoes,
      p_itens: itens,
      p_pedidos: pedidos,
    });
    if (aplicarErr) throw new Error(aplicarErr.message);

    return jsonResponse({ ok: true, origem, ...((resumo as Record<string, unknown>) ?? {}) });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    console.error("[sync-compras-pull]", mensagem);
    await admin.rpc("compras_sync_falhar", { p_execucao: execucao, p_erro: mensagem });
    return jsonResponse({ ok: false, error: "A atualização do Compras falhou", detalhe: mensagem }, 502);
  }
});
