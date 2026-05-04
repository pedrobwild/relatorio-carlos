/**
 * Copy de erro.
 *
 * Mensagens humanas para o usuário. O detalhe técnico vai pro log
 * (`captureError` / `errorLogger`) ou pra um bloco `<details>` colapsado
 * — nunca exposto cru na UI.
 *
 * Ver `docs/TOM_DE_VOZ.md`.
 */

export interface ErrorCopy {
  title: string;
  description: string;
  /** CTA opcional (ex.: "Tentar de novo"). */
  cta?: string;
}

export const errorLabels = {
  /** Erro genérico — fallback quando nada mais bate. */
  generic: {
    title: "Algo travou aqui",
    description:
      "Já registramos o problema. Atualize a página em alguns segundos.",
    cta: "Atualizar",
  },
  network: {
    title: "Falha de conexão",
    description: "Verifique sua internet e tente de novo.",
    cta: "Tentar de novo",
  },
  timeout: {
    title: "Demorou demais para responder",
    description:
      "A operação ainda pode estar processando. Aguarde um pouco e atualize.",
  },
  saveFailed: {
    title: "Não consegui salvar agora",
    description:
      "Tenta de novo em alguns segundos. Suas alterações estão preservadas no formulário.",
    cta: "Tentar de novo",
  },
  loadFailed: {
    title: "Não consegui carregar os dados",
    description: "Verifique sua conexão ou atualize a página.",
    cta: "Atualizar",
  },
  uploadFailed: {
    title: "Falha no envio do arquivo",
    description:
      "Tente novamente. Se persistir, tente um arquivo menor ou em outro formato.",
  },
  permissionDenied: {
    title: "Sem permissão para esta ação",
    description: "Fale com o gestor da obra se precisar de acesso.",
  },
  sessionExpired: {
    title: "Sua sessão expirou",
    description: "Entre de novo para continuar.",
    cta: "Entrar",
  },
  validation: {
    title: "Confira os campos destacados",
    description: "Há informações pendentes ou inválidas no formulário.",
  },
  duplicateRecord: {
    title: "Registro já existe",
    description:
      "Confira a lista — talvez ele tenha sido criado por outra pessoa.",
  },
  foreignKeyConstraint: {
    title: "Não dá para excluir",
    description:
      "Existem registros vinculados. Remova os vínculos antes ou arquive em vez de excluir.",
  },
  rateLimited: {
    title: "Muitas tentativas seguidas",
    description: "Aguarde alguns segundos antes de tentar de novo.",
  },
  notFound: {
    title: "Não encontramos esse registro",
    description: "Talvez tenha sido removido. Atualize a lista para conferir.",
  },
  serverError: {
    title: "Problema no servidor",
    description: "Já fomos avisados. Tente de novo em alguns minutos.",
  },
  invalidFile: {
    title: "Arquivo não aceito",
    description: "Confira o tipo e o tamanho permitidos para este envio.",
  },
} as const satisfies Record<string, ErrorCopy>;

export type ErrorKey = keyof typeof errorLabels;

/**
 * Helper para combinar a mensagem humana com um detalhe técnico opcional
 * (que ficará num `<details>` na UI ou no log).
 */
export function formatError(
  key: ErrorKey,
  technicalDetail?: string,
): {
  title: string;
  description: string;
  technicalDetail?: string;
} {
  const copy = errorLabels[key];
  return {
    title: copy.title,
    description: copy.description,
    technicalDetail,
  };
}
