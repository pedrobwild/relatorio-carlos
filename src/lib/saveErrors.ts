/**
 * Classificação de erro de gravação: permanente x transitório.
 *
 * Um autosave que retenta um erro PERMANENTE nunca converge — só empilha
 * requisições, repete o toast e esconde o motivo real do usuário. Foi
 * exatamente isso que travou o cronograma em 31/08: a RPC devolvia
 * "Sem permissão para editar o cronograma desta obra" (P0001) e o cliente
 * ficava retentando a cada ~1,2s como se fosse instabilidade de rede.
 */

import { describeError, isBackendUnavailableError } from "@/lib/authRecovery";

/**
 * Códigos do Postgres em que tentar de novo com o mesmo payload dá o mesmo
 * resultado. P0001 é o `RAISE EXCEPTION` das nossas próprias funções — regra
 * de negócio ou permissão —, e a mensagem que vem junto já é escrita em PT-BR
 * para o usuário final.
 */
const PERMANENT_PG_CODES = new Set([
  "P0001", // raise_exception (nossas regras: permissão, duplicidade, payload)
  "42501", // insufficient_privilege
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
  "22P02", // invalid_text_representation (cast inválido, ex.: uuid malformado)
  "22008", // datetime_field_overflow
]);

/**
 * 401 fica DE FORA de propósito: sessão expirada é recuperável pela renovação
 * de token (src/lib/authRecovery.ts), então não é um beco sem saída.
 */
const PERMANENT_HTTP_STATUS = new Set([400, 403, 404, 409, 422]);

export function isPermanentSaveError(error: unknown): boolean {
  // Indisponibilidade de backend (5xx, PGRST002/PGRST003, pool, schema cache)
  // é sempre transitória — tem precedência sobre qualquer outra leitura.
  if (isBackendUnavailableError(error)) return false;

  const { code, status } = describeError(error);
  if (code && PERMANENT_PG_CODES.has(code)) return true;
  if (status != null && PERMANENT_HTTP_STATUS.has(status)) return true;
  return false;
}

export type SaveErrorDescription = {
  /** Mensagem para mostrar ao usuário, em PT-BR. */
  message: string;
  /** Se true, retentar é inútil: exige ação humana. */
  permanent: boolean;
};

const GENERIC_FALLBACK = "Não foi possível salvar. Tente novamente.";

/**
 * Extrai a mensagem que o usuário deve ler. Para erros permanentes vindos das
 * nossas funções SQL, a mensagem do Postgres já é a explicação correta e
 * acionável — repassar ela é melhor do que qualquer texto genérico nosso.
 */
export function describeSaveError(error: unknown): SaveErrorDescription {
  const permanent = isPermanentSaveError(error);
  const { code } = describeError(error);

  const raw =
    typeof error === "object" && error !== null
      ? (error as { message?: string }).message
      : typeof error === "string"
        ? error
        : undefined;

  const message = raw?.trim();

  // Só repassamos o texto do servidor quando ele foi escrito para humanos.
  // P0001 vem das nossas próprias funções, sempre em PT-BR.
  if (permanent && code === "P0001" && message) {
    return { message, permanent };
  }

  if (isBackendUnavailableError(error)) {
    return {
      message:
        "O servidor está instável no momento. Vamos tentar de novo automaticamente.",
      permanent: false,
    };
  }

  return { message: message || GENERIC_FALLBACK, permanent };
}
