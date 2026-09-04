/**
 * Registro de erro de cliente.
 *
 * Existe porque um erro pontual em um único usuário era, até aqui,
 * infalsificável: o `errorLogger` só escrevia no console do navegador dele, e
 * quando o relato chegava não havia como confirmar nem descartar nada.
 *
 * REGRAS DE OURO deste módulo, todas por um motivo:
 *  1. Nunca lança. Um erro ao registrar erro não pode virar um segundo erro.
 *  2. Nunca bloqueia. É disparado e esquecido; ninguém espera por ele.
 *  3. Nunca recorre. Falhou, descartou — senão uma rede ruim (justamente o
 *     cenário que queremos medir) vira uma avalanche de tentativas.
 *  4. Tem teto por sessão. Um loop de render com erro não pode inundar a tabela
 *     nem o gargalo do PostgREST.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ClientErrorInput {
  context?: string;
  message: string;
  errorCode?: string;
  httpStatus?: number;
  extra?: Record<string, unknown>;
}

/** Teto de registros por carregamento de página. */
const MAX_POR_SESSAO = 20;

/** Não registra o mesmo contexto+código mais de uma vez nesta janela. */
const JANELA_DEDUPE_MS = 30_000;

/** `message` é truncada: queremos diagnosticar, não arquivar texto. */
const MAX_MESSAGE = 500;

let enviadosNestaSessao = 0;
const ultimoEnvioPorChave = new Map<string, number>();

/** Zera o estado — usado nos testes. */
export function resetClientErrorThrottle(): void {
  enviadosNestaSessao = 0;
  ultimoEnvioPorChave.clear();
}

function podeEnviar(chave: string, agora: number): boolean {
  if (enviadosNestaSessao >= MAX_POR_SESSAO) return false;
  const ultimo = ultimoEnvioPorChave.get(chave);
  if (ultimo != null && agora - ultimo < JANELA_DEDUPE_MS) return false;
  return true;
}

/**
 * Grava um erro de cliente. Devolve `true` se chegou a enviar.
 *
 * Não é `async` para o chamador: quem chama não deve nem poder esperar.
 */
export async function recordClientError(
  input: ClientErrorInput,
): Promise<boolean> {
  try {
    const agora = Date.now();
    const chave = `${input.context ?? ""}|${input.errorCode ?? ""}|${input.httpStatus ?? ""}`;
    if (!podeEnviar(chave, agora)) return false;

    // A policy exige `user_id = auth.uid()`. Sem sessão carregada o INSERT
    // seria recusado — não adianta tentar.
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;

    enviadosNestaSessao += 1;
    ultimoEnvioPorChave.set(chave, agora);

    // `as any`: src/integrations/supabase/types.ts é gerado e ainda não inclui
    // esta tabela (migração 20260904140000). Mesmo recurso já usado nas RPCs
    // novas do repositório; sai quando os tipos forem regerados.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from as any)("client_error_logs").insert({
      user_id: userId,
      context: input.context ?? null,
      message: input.message.slice(0, MAX_MESSAGE),
      error_code: input.errorCode ?? null,
      http_status: input.httpStatus ?? null,
      // Só o pathname: query string carrega parâmetro que não queremos guardar.
      route:
        typeof window !== "undefined" ? window.location.pathname : null,
      online: typeof navigator !== "undefined" ? navigator.onLine : null,
      user_agent:
        typeof navigator !== "undefined"
          ? navigator.userAgent.slice(0, 300)
          : null,
      extra: input.extra ?? {},
    });

    // Regra 3: falhou, acabou. Nada de retry.
    return !error;
  } catch {
    // Regra 1: silêncio absoluto.
    return false;
  }
}
